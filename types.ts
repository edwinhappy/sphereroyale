
export interface Vector2 {
    x: number;
    y: number;
}

export type WalletChain = 'TON' | 'SOL';

export interface Participant {
    username: string;
    walletAddress: string;
    chain: WalletChain;
    paymentTxHash?: string;
}

export interface Sphere {
    id: string;
    name: string;
    personality: string;
    walletAddress?: string; // Optional wallet address for human players
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    mass: number;
    color: string;
    health: number;
    maxHealth: number;
    damageTaken: number;
    isEliminated: boolean;
    kills: number;
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

export enum GameStatus {
    IDLE = 'IDLE',
    WAITING = 'WAITING',
    GENERATING = 'GENERATING',
    PLAYING = 'PLAYING',
    FINISHED = 'FINISHED',
}

export interface GameSettings {
    sphereCount: number;
    arenaShrinkRate: number;
}

export interface LogEntry {
    id: string;
    text: string;
    type: 'info' | 'combat' | 'elimination' | 'win';
    timestamp: number;
}
