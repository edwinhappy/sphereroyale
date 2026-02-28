import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { Participant } from '../models/Participant.js';
import { Schedule } from '../models/Schedule.js';
import { Match } from '../models/Match.js';
import { verifySolanaTransaction, verifyTonTransaction } from '../services/verification.js';
import { signAdminToken, requireAdmin, verifyAdminToken } from '../middleware/auth.js';
import {
    authLimiter,
    registerLimiter,
    progressiveBackoffCheck,
    recordLoginFailure,
    clearLoginBackoff,
} from '../middleware/rateLimiter.js';
import { validate, registerSchema, loginSchema, scheduleSchema } from '../middleware/validation.js';
import { config } from '../config.js';
import { scheduleGameStart, cancelScheduledGames } from '../services/scheduler.js';
import { pubClient } from '../services/redis.js';

const router = express.Router();
router.get('/participants', async (_req: Request, res: Response) => {
    try {
        const participants = await Participant.find().sort({ joinedAt: 1 });
        res.json(participants);
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/game/current — return the active gameId
router.get('/game/current', (_req: Request, res: Response) => {
    // gameId is attached by the io middleware from serverGameState
    const gameId = (global as any).__currentGameId || 'default';
    res.json({ gameId });
});

// POST /api/register
router.post('/register', registerLimiter, validate(registerSchema), async (req: Request, res: Response): Promise<any> => {
    try {
        const { username, walletAddress, chain, paymentTxHash } = req.body;
        const gameId: string = (global as any).__currentGameId || 'default';

        // 1. Compute normalized transaction identity for cross-chain replay prevention
        const normalizedTxId = `${chain}:${paymentTxHash.toLowerCase()}`;

        // 2. Check for duplicate normalizedTxId (replay prevention)
        const existingTx = await Participant.findOne({ normalizedTxId });
        if (existingTx) {
            return res.status(409).json({ error: 'Transaction hash already used' });
        }

        // 3. Check for duplicate username within this game
        const existingUser = await Participant.findOne({ username, gameId }).collation({ locale: 'en', strength: 2 });
        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // 4. Check wallet limit per game (Max 8, only CONFIRMED count)
        const walletCount = await Participant.countDocuments({ walletAddress, gameId, status: 'CONFIRMED' });
        if (walletCount >= 8) {
            return res.status(403).json({ error: 'Maximum 8 players per wallet limit reached' });
        }

        // 5. Create participant as PENDING
        const newParticipant = new Participant({
            username,
            walletAddress,
            chain,
            paymentTxHash,
            normalizedTxId,
            gameId,
            status: 'PENDING',
        });
        await newParticipant.save();

        // 6. Verify Transaction
        let isValidTx = false;
        if (chain === 'SOL') {
            isValidTx = await verifySolanaTransaction(paymentTxHash, walletAddress);
        } else if (chain === 'TON') {
            isValidTx = await verifyTonTransaction(paymentTxHash, walletAddress);
        }

        if (!isValidTx) {
            // Transition to FAILED
            await Participant.updateOne(
                { _id: newParticipant._id },
                { status: 'FAILED', statusReason: 'Transaction verification failed' },
            );
            return res.status(400).json({ error: 'Transaction verification failed. Please ensure the transaction is confirmed.' });
        }

        // 7. Transition to CONFIRMED
        newParticipant.status = 'CONFIRMED';
        await Participant.updateOne(
            { _id: newParticipant._id },
            { status: 'CONFIRMED' },
        );

        // 8. Real-time Broadcast
        if (req.io) {
            req.io.emit('playerJoined', newParticipant);
            req.io.emit('systemLog', `New combatant registered: ${username} via ${chain}`);
        }

        res.status(201).json(newParticipant);

    } catch (error: any) {
        console.error('Registration error:', error);
        // Handle duplicate key checks just in case race condition
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Duplicate entry detected' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Admin & Schedule Routes ---

// GET /api/schedule
router.get('/schedule', async (_req: Request, res: Response) => {
    try {
        const schedule = await Schedule.findOne({ type: 'main' });
        if (schedule) {
            res.json(schedule);
        } else {
            res.status(404).json({ error: 'No schedule found' });
        }
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/login
router.post('/admin/login', authLimiter, progressiveBackoffCheck, validate(loginSchema), (req: Request, res: Response): any => {
    try {
        const { password } = req.body;

        const hash = crypto.createHash('sha256').update(password).digest('hex');
        // Match against backend env var
        const expectedHash = config.ADMIN_PASSWORD_HASH;

        if (hash === expectedHash) {
            clearLoginBackoff(req.ip || 'unknown');
            const { token, expiresIn } = signAdminToken();
            res.json({ token, expiresIn });
        } else {
            recordLoginFailure(req.ip || 'unknown');
            res.status(401).json({ error: 'Invalid admin credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/stats
router.get('/admin/stats', requireAdmin, async (req: Request, res: Response): Promise<any> => {
    try {
        const activeConnections = req.io ? req.io.engine.clientsCount : 0;
        const memoryUsage = process.memoryUsage();
        const networkLoad = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
        const uptime = process.uptime();

        res.json({
            activeConnections,
            networkLoad,
            uptime
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/schedule
router.post('/schedule', requireAdmin, validate(scheduleSchema), async (req: Request, res: Response): Promise<any> => {
    try {
        const { nextGameTime, totalPlayers } = req.body;

        const updated = await Schedule.findOneAndUpdate(
            { type: 'main' },
            { nextGameTime: new Date(nextGameTime), totalPlayers, updatedAt: new Date() },
            { upsert: true, new: true }
        );

        // Update Agenda Job Queue
        if (nextGameTime) {
            await scheduleGameStart(new Date(nextGameTime));
        } else {
            await cancelScheduledGames();
        }

        if (req.io) {
            req.io.emit('scheduleUpdated', updated);
            req.io.emit('systemLog', `Admin updated schedule: ${nextGameTime} for ${totalPlayers}`);
        }

        res.json(updated);
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/refresh
router.post('/admin/refresh', async (req: Request, res: Response): Promise<any> => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

        if (!token) {
            return res.status(401).json({ error: 'Missing authorization token' });
        }

        // Verify current token is still valid
        let payload;
        try {
            payload = await verifyAdminToken(token);
        } catch {
            return res.status(401).json({ error: 'Token invalid or expired' });
        }

        // Blacklist the old token instantly so it can't be used twice for a window replay
        const now = Math.floor(Date.now() / 1000);
        const ttl = payload.exp - now;
        if (ttl > 0) {
            await pubClient.setEx(`blacklist:${payload.jti}`, ttl, 'true');
        }

        // Issue a fresh token
        const { token: newToken, expiresIn } = signAdminToken();
        res.json({ token: newToken, expiresIn });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/logout
router.post('/admin/logout', async (req: Request, res: Response): Promise<any> => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

        if (!token) {
            return res.status(401).json({ error: 'Missing authorization token' });
        }

        let payload;
        try {
            payload = await verifyAdminToken(token);
        } catch {
            // Already logged out or expired, perfectly fine outcome
            return res.status(200).json({ success: true });
        }

        const now = Math.floor(Date.now() / 1000);
        const ttl = payload.exp - now;

        // Blacklist token in Redis securely
        if (ttl > 0) {
            await pubClient.setEx(`blacklist:${payload.jti}`, ttl, 'true');
        }

        // Emit global disconnect logic for active admin sockets if required, 
        // since the token powers UI elements they will naturally cleanly fail.

        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Match History ---

// GET /api/matches — list recent matches
router.get('/matches', async (_req: Request, res: Response) => {
    try {
        const matches = await Match.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .select('-events')  // exclude verbose event log from listing
            .lean();
        res.json(matches);
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/matches/:gameId — get a specific match with full events
router.get('/matches/:gameId', async (req: Request, res: Response): Promise<any> => {
    try {
        const match = await Match.findOne({ gameId: req.params.gameId }).lean();
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        res.json(match);
    } catch (error) {
        console.error('Error fetching match:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
