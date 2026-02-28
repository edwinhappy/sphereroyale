import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import crypto from 'crypto';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from './config.js';
import apiRoutes from './routes/api.js';
import { updateServerPhysicsEngine, BackendPhysicsContext } from './services/physicsEngine.js';
import { verifySocketAdminToken } from './middleware/auth.js';
import { generalLimiter, allowSocketEvent, recordSocketAuthFailure, resetSocketAuth } from './middleware/rateLimiter.js';
import { Schedule } from './models/Schedule.js';
import { Participant } from './models/Participant.js';
import { Match } from './models/Match.js';
import { Sphere, GameStatus } from '../types.js';
import { ARENA_WIDTH, ARENA_HEIGHT, COLOR_PALETTE } from '../constants.js';
import { agenda } from './services/scheduler.js';
import { initRedis, pubClient, subClient } from './services/redis.js';

const INSTANCE_ID = crypto.randomUUID();

// Extend Express Request to include io
declare global {
    namespace Express {
        interface Request {
            io: Server;
        }
    }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for now (dev)
        methods: ["GET", "POST"]
    }
});
io.adapter(createAdapter(pubClient, subClient));

// Middleware
app.use(cors());
app.use(express.json());

// Attach IO to request for routes
app.use((req: Request, _res: Response, next: NextFunction) => {
    req.io = io;
    next();
});

// Database Connection
mongoose.connect(config.MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        // Initialize Redis
        await initRedis();
        // Start Agenda
        await agenda.start();
        console.log('✅ Agenda job scheduler started');
        // Crash recovery: cancel any matches stuck in PLAYING or GENERATING
        const staleMatches = await Match.updateMany(
            { status: { $in: ['PLAYING', 'GENERATING'] } },
            { status: 'CANCELLED', cancelReason: 'Server restarted', endedAt: new Date() },
        );
        if (staleMatches.modifiedCount > 0) {
            console.warn(`⚠️  Crash recovery: cancelled ${staleMatches.modifiedCount} stale match(es).`);
        }
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes (general rate limit on all /api endpoints)
app.use('/api', generalLimiter, apiRoutes);

app.get('/', (_req: Request, res: Response) => {
    res.send('Sphere Royale API is running');
});

export let serverGameState = {
    status: GameStatus.IDLE as GameStatus,
    spheres: [] as Sphere[],
    nextGameTime: null as Date | null,
    totalPlayers: 8,
    currentGameId: 'default',
    /** Track the previous status so we can detect transitions in the game loop */
    _prevStatus: GameStatus.IDLE as GameStatus,
};

// Expose currentGameId globally so routes can access it without circular imports
(global as any).__currentGameId = serverGameState.currentGameId;

// Game Loop Leader Election
let isLeader = false;

setInterval(async () => {
    try {
        const acquired = await pubClient.set('game_engine_lock', INSTANCE_ID, { PX: 2000, NX: true });
        if (acquired) {
            isLeader = true;
        } else {
            // Already locked, check if we own it to renew
            const currentOwner = await pubClient.get('game_engine_lock');
            if (currentOwner === INSTANCE_ID) {
                await pubClient.pExpire('game_engine_lock', 2000);
                isLeader = true;
            } else {
                isLeader = false;
            }
        }
    } catch (e) {
        console.error('Leader election error:', e);
        isLeader = false;
    }
}, 1000);

let lastTime = Date.now();
setInterval(() => {
    if (!isLeader) return; // Only the leader runs the physics loop

    const now = Date.now();
    const dt = now - lastTime;
    lastTime = now;

    if (serverGameState.status === GameStatus.PLAYING) {
        const context: BackendPhysicsContext = {
            currentSpheres: serverGameState.spheres,
            gameStatus: serverGameState.status,
            setGameStatus: (s) => { serverGameState.status = s; },
            onEvent: (ev) => {
                io.emit('gameEvent', ev);
                // Persist key events to Match doc
                if (['eliminated', 'win', 'draw'].includes(ev.type)) {
                    const text = ev.type === 'win' ? `Winner: ${ev.winner}`
                        : ev.type === 'draw' ? 'Match ended in a draw'
                            : `${ev.target} eliminated`;
                    Match.updateOne(
                        { gameId: serverGameState.currentGameId },
                        { $push: { events: { type: ev.type, text, timestamp: new Date() } } },
                    ).catch(e => console.error('Failed to persist match event:', e));
                }
            }
        };

        updateServerPhysicsEngine(dt, context);
        serverGameState.spheres = context.currentSpheres;

        // Read current status after physics update (setGameStatus may have changed it)
        // Cast to string to bypass TS control-flow narrowing — the callback mutates status at runtime
        const currentStatus = serverGameState.status as string;

        // Detect transition to FINISHED
        if (serverGameState._prevStatus === GameStatus.PLAYING && currentStatus === GameStatus.FINISHED) {
            const aliveSpheres = serverGameState.spheres.filter(s => !s.isEliminated);
            const isDraw = aliveSpheres.length === 0;
            const winner = !isDraw && aliveSpheres.length === 1
                ? { name: aliveSpheres[0].name, walletAddress: aliveSpheres[0].walletAddress }
                : undefined;

            Match.updateOne(
                { gameId: serverGameState.currentGameId },
                {
                    status: 'FINISHED',
                    endedAt: new Date(),
                    isDraw,
                    ...(winner ? { winner } : {}),
                },
            ).catch(e => console.error('Failed to persist match result:', e));
        }
        serverGameState._prevStatus = serverGameState.status;

        // Broadcast state at ~20fps (50ms)
        io.emit('gameStateUpdate', {
            spheres: serverGameState.spheres,
            status: serverGameState.status
        });
    }

}, 50);

export async function startGameSequence() {
    // Explicit State Machine Guard: only start if IDLE
    if (serverGameState.status !== GameStatus.IDLE) {
        console.warn(`⚠️ Blocked duplicate startGameSequence. Current status: ${serverGameState.status}`);
        return;
    }
    // Generate a new gameId for this round
    serverGameState.currentGameId = `game-${Date.now()}`;
    (global as any).__currentGameId = serverGameState.currentGameId;

    serverGameState.status = GameStatus.GENERATING;
    serverGameState._prevStatus = GameStatus.GENERATING;
    io.emit('gameEvent', { type: 'info', text: 'INITIALIZING PROTOCOL...' });

    try {
        // Create Match doc in GENERATING state
        const matchDoc = new Match({
            gameId: serverGameState.currentGameId,
            status: 'GENERATING',
            scheduledAt: serverGameState.nextGameTime || new Date(),
            totalPlayers: serverGameState.totalPlayers,
        });
        await matchDoc.save();

        const participants = await Participant.find({ gameId: serverGameState.currentGameId, status: 'CONFIRMED' }).sort({ joinedAt: 1 }).lean();
        const humanCount = participants.length;
        const botsNeeded = Math.max(0, serverGameState.totalPlayers - humanCount);

        let botData: any[] = [];
        if (botsNeeded > 0) {
            botData = Array.from({ length: botsNeeded }).map((_, i) => ({
                name: `BOT-${i}`,
                personality: 'Robot'
            }));
        }

        const combinedData = [
            ...participants.map((p: any) => ({ name: p.username, personality: 'Human', walletAddress: p.walletAddress, chain: p.chain })),
            ...botData
        ];

        // Snapshot participants into Match doc
        const participantSnapshot = combinedData.map(d => ({
            name: d.name,
            walletAddress: d.walletAddress,
            chain: d.chain,
            isBot: d.personality === 'Robot',
        }));

        serverGameState.spheres = combinedData.map((data, index) => {
            const radius = 25;
            return {
                id: `sphere-${index}`,
                name: data.name || `Unit-${index}`,
                personality: data.personality || 'Neutral',
                walletAddress: data.walletAddress,
                x: 100 + Math.random() * (ARENA_WIDTH - 200),
                y: 100 + Math.random() * (ARENA_HEIGHT - 200),
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                radius: radius,
                mass: radius,
                color: index < humanCount ? '#00f3ff' : COLOR_PALETTE[index % COLOR_PALETTE.length],
                health: 100,
                maxHealth: 100,
                damageTaken: 0,
                isEliminated: false,
                kills: 0,
            };
        });

        // Transition Match to PLAYING
        await Match.updateOne(
            { gameId: serverGameState.currentGameId },
            {
                status: 'PLAYING',
                startedAt: new Date(),
                participants: participantSnapshot,
                $push: { events: { type: 'info', text: `Battle started with ${combinedData.length} entities (${humanCount} human, ${botsNeeded} bots).`, timestamp: new Date() } },
            },
        );

        serverGameState.status = GameStatus.PLAYING;
        serverGameState._prevStatus = GameStatus.PLAYING;
        io.emit('gameStarted');
        io.emit('gameEvent', { type: 'info', text: 'BATTLE INITIATED. FULL ARENA ACTIVE.' });
        io.emit('systemLog', `Game started with ${combinedData.length} entities (${humanCount} human, ${botsNeeded} bots).`);

        // Clear nextGameTime from DB
        await Schedule.findOneAndUpdate({ type: 'main' }, { nextGameTime: null });
        serverGameState.nextGameTime = null;

    } catch (e) {
        console.error("Error starting game", e);
        io.emit('systemLog', `ERROR: Failed to start game sequence: ${(e as Error).message}`);
        // Cancel the match doc if it was created
        await Match.updateOne(
            { gameId: serverGameState.currentGameId },
            { status: 'CANCELLED', cancelReason: `Start failed: ${(e as Error).message}`, endedAt: new Date() },
        ).catch(() => { });
        serverGameState.status = GameStatus.IDLE;
    }
}

// Initial Sync - now handled largely by Agenda, we just boot the server
// The client will query /api/schedule anyway for display.
Schedule.findOne({ type: 'main' }).then(s => {
    if (s) {
        serverGameState.nextGameTime = s.nextGameTime ? new Date(s.nextGameTime) : null;
        serverGameState.totalPlayers = s.totalPlayers;
    }
});

// Socket.io Logic
io.on('connection', (socket: Socket) => {
    console.log(`🔌 User connected: ${socket.id}`);
    io.emit('systemLog', `New connection established: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
        io.emit('systemLog', `Connection dropped: ${socket.id}`);
    });

    // Send initial state
    socket.emit('gameStateUpdate', { spheres: serverGameState.spheres, status: serverGameState.status });

    // Admin commands — throttled & progressive backoff on auth failures
    socket.on('adminStartGame', async (token) => {
        if (!allowSocketEvent(socket, 'adminStartGame')) return;

        if (await verifySocketAdminToken(token)) {
            resetSocketAuth(socket);
            io.emit('systemLog', `Admin invoked manual override: Start Game`);
            startGameSequence();
        } else {
            const locked = recordSocketAuthFailure(socket);
            socket.emit('systemLog', locked
                ? 'ERROR: Too many failed attempts — temporarily locked out.'
                : 'ERROR: Invalid or expired admin token');
        }
    });

    socket.on('adminResetGame', async (token) => {
        if (!allowSocketEvent(socket, 'adminResetGame')) return;

        if (await verifySocketAdminToken(token)) {
            resetSocketAuth(socket);
            io.emit('systemLog', `Admin invoked system reset.`);

            // Cancel any in-progress match
            if (serverGameState.status === GameStatus.PLAYING || serverGameState.status === GameStatus.GENERATING) {
                Match.updateOne(
                    { gameId: serverGameState.currentGameId },
                    { status: 'CANCELLED', cancelReason: 'Admin reset', endedAt: new Date() },
                ).catch(e => console.error('Failed to cancel match:', e));
            }

            // Explicit State Machine transition
            serverGameState.status = GameStatus.IDLE;

            serverGameState.spheres = [];

            // Clear schedule from DB and cancel jobs
            await Schedule.findOneAndUpdate({ type: 'main' }, { nextGameTime: null });
            serverGameState.nextGameTime = null;
            await agenda.cancel({ name: 'start-game' });
            io.emit('scheduleUpdated', { nextGameTime: null, totalPlayers: serverGameState.totalPlayers });

            io.emit('gameStateUpdate', { spheres: [], status: GameStatus.IDLE });
        } else {
            const locked = recordSocketAuthFailure(socket);
            socket.emit('systemLog', locked
                ? 'ERROR: Too many failed attempts — temporarily locked out.'
                : 'ERROR: Invalid or expired admin token');
        }
    });
});

// Start Server
const PORT = config.PORT;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
