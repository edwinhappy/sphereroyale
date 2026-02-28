import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { Participant } from '../models/Participant.js';
import { Schedule } from '../models/Schedule.js';
import { verifySolanaTransaction, verifyTonTransaction } from '../services/verification.js';

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

// POST /api/register
router.post('/register', async (req: Request, res: Response): Promise<any> => {
    try {
        const { username, walletAddress, chain, paymentTxHash } = req.body;

        // 1. Basic Validation
        if (!username || !walletAddress || !chain || !paymentTxHash) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 2. Check for duplicate username
        const existingUser = await Participant.findOne({ username }).collation({ locale: 'en', strength: 2 });
        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // 3. Check wallet limit (Max 8)
        const walletCount = await Participant.countDocuments({ walletAddress });
        if (walletCount >= 8) {
            return res.status(403).json({ error: 'Maximum 8 players per wallet limit reached' });
        }

        // 4. Check for duplicate transaction hash
        const existingTx = await Participant.findOne({ paymentTxHash });
        if (existingTx) {
            return res.status(409).json({ error: 'Transaction hash already used' });
        }

        // 4.5 Verify Transaction
        let isValidTx = false;
        if (chain === 'SOL') {
            isValidTx = await verifySolanaTransaction(paymentTxHash, walletAddress);
        } else if (chain === 'TON') {
            isValidTx = await verifyTonTransaction(paymentTxHash, walletAddress);
        }

        if (!isValidTx) {
            return res.status(400).json({ error: 'Transaction verification failed. Please ensure the transaction is confirmed.' });
        }

        // 5. Create Participant
        const newParticipant = new Participant({
            username,
            walletAddress,
            chain,
            paymentTxHash
        });

        await newParticipant.save();

        // 6. Real-time Broadcast
        // reliable io attachment via middleware
        if (req.io) {
            req.io.emit('playerJoined', newParticipant);
            req.io.emit('systemLog', `New combating registered: ${username} via ${chain}`);
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
router.post('/admin/login', (req: Request, res: Response): any => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        const hash = crypto.createHash('sha256').update(password).digest('hex');
        // Match against backend env var
        const expectedHash = process.env.ADMIN_PASSWORD_HASH || process.env.VITE_ADMIN_PASSWORD_HASH;

        if (hash === expectedHash) {
            res.json({ token: 'sp-admin-token-777' }); // Simplified token for demo purposes
        } else {
            res.status(401).json({ error: 'Invalid admin credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/stats
router.get('/admin/stats', async (req: Request, res: Response): Promise<any> => {
    try {
        const token = req.query.token as string || req.headers['authorization']?.split(' ')[1];
        if (token !== 'sp-admin-token-777') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

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
router.post('/schedule', async (req: Request, res: Response): Promise<any> => {
    try {
        const { nextGameTime, totalPlayers, token } = req.body;

        if (token !== 'sp-admin-token-777') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!nextGameTime || !totalPlayers) {
            return res.status(400).json({ error: 'Missing schedule data' });
        }

        const updated = await Schedule.findOneAndUpdate(
            { type: 'main' },
            { nextGameTime: new Date(nextGameTime), totalPlayers, updatedAt: new Date() },
            { upsert: true, new: true }
        );

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

export default router;
