import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { updateServerPhysicsEngine, BackendPhysicsContext } from './services/physicsEngine.js';
import { Schedule } from './models/Schedule.js';
import { Participant } from './models/Participant.js';
import { Sphere, GameStatus } from '../types.js';
import { ARENA_WIDTH, ARENA_HEIGHT, COLOR_PALETTE } from '../constants.js';

// Extend Express Request to include io
declare global {
    namespace Express {
        interface Request {
            io: Server;
        }
    }
}

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for now (dev)
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Attach IO to request for routes
app.use((req: Request, _res: Response, next: NextFunction) => {
    req.io = io;
    next();
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sphereroyale';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api', apiRoutes);

app.get('/', (_req: Request, res: Response) => {
    res.send('Sphere Royale API is running');
});

let serverGameState = {
    status: GameStatus.IDLE as GameStatus,
    spheres: [] as Sphere[],
    nextGameTime: null as Date | null,
    totalPlayers: 8
};

// Game Loop Setup
let lastTime = Date.now();
setInterval(() => {
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
            }
        };

        updateServerPhysicsEngine(dt, context);
        serverGameState.spheres = context.currentSpheres;

        // Broadcast state at ~20fps (50ms)
        io.emit('gameStateUpdate', {
            spheres: serverGameState.spheres,
            status: serverGameState.status
        });
    }

    // Check schedule
    if (serverGameState.status === GameStatus.IDLE || serverGameState.status === GameStatus.WAITING) {
        if (serverGameState.nextGameTime && now >= serverGameState.nextGameTime.getTime()) {
            startGameSequence();
        }
    }
}, 50);

async function startGameSequence() {
    serverGameState.status = GameStatus.GENERATING;
    io.emit('gameEvent', { type: 'info', text: 'INITIALIZING PROTOCOL...' });

    try {
        const participants = await Participant.find().sort({ joinedAt: 1 }).lean();
        const humanCount = participants.length;
        const botsNeeded = Math.max(0, serverGameState.totalPlayers - humanCount);

        let botData: any[] = [];
        if (botsNeeded > 0) {
            // Simplified bot generation
            botData = Array.from({ length: botsNeeded }).map((_, i) => ({
                name: `BOT-${i}`,
                personality: 'Robot'
            }));
        }

        const combinedData = [
            ...participants.map((p: any) => ({ name: p.username, personality: 'Human', walletAddress: p.walletAddress, chain: p.chain })),
            ...botData
        ];

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

        serverGameState.status = GameStatus.PLAYING;
        io.emit('gameStarted'); // Signal all clients to navigate to the battle view
        io.emit('gameEvent', { type: 'info', text: 'BATTLE INITIATED. FULL ARENA ACTIVE.' });
        io.emit('systemLog', `Game started with ${combinedData.length} entities (${humanCount} human, ${botsNeeded} bots).`);

        // Clear nextGameTime from DB
        await Schedule.findOneAndUpdate({ type: 'main' }, { nextGameTime: null });
        serverGameState.nextGameTime = null;

    } catch (e) {
        console.error("Error starting game", e);
        io.emit('systemLog', `ERROR: Failed to start game sequence: ${(e as Error).message}`);
        serverGameState.status = GameStatus.IDLE;
    }
}

// Initial Sync
Schedule.findOne({ type: 'main' }).then(s => {
    if (s && s.nextGameTime) {
        serverGameState.nextGameTime = new Date(s.nextGameTime);
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

    // Admin commands
    socket.on('adminStartGame', (token) => {
        // Validate token ideally, assume valid for demo if it reaches here and frontend checked,
        // but better check env.
        if (token === 'sp-admin-token-777') {
            io.emit('systemLog', `Admin invoked manual override: Start Game`);
            startGameSequence();
        }
    });

    socket.on('adminResetGame', (token) => {
        if (token === 'sp-admin-token-777') {
            io.emit('systemLog', `Admin invoked system reset.`);
            serverGameState.status = GameStatus.IDLE;
            serverGameState.spheres = [];
            io.emit('gameStateUpdate', { spheres: [], status: GameStatus.IDLE });
        }
    });
});

// Start Server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
