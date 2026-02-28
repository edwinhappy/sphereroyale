export const ARENA_WIDTH = 1200;
export const ARENA_HEIGHT = 800;
export const FPS = 60;
export const FRICTION = 0.995; // Air resistance
export const ELASTICITY = 0.8; // Bounciness
export const WALL_DAMPING = 0.7;
export const MIN_SPEED_DAMAGE_THRESHOLD = 2;
export const DAMAGE_MULTIPLIER = 2.5;
export const MAX_PARTICLES = 100;

// --- Payment Configuration (from .env) ---
export const REGISTRATION_FEE_USDT = 2;
// @ts-ignore
export const TON_USDT_JETTON_MASTER = import.meta.env.VITE_TON_USDT_JETTON_MASTER ?? '';
// @ts-ignore
export const SOL_USDT_MINT = import.meta.env.VITE_SOL_USDT_MINT ?? '';
// @ts-ignore
export const TON_RECIPIENT_ADDRESS = import.meta.env.VITE_TON_RECIPIENT_ADDRESS ?? '';
// @ts-ignore
export const SOL_RECIPIENT_ADDRESS = import.meta.env.VITE_SOL_RECIPIENT_ADDRESS ?? '';
// @ts-ignore
export const SOL_RPC_ENDPOINT = import.meta.env.VITE_SOL_RPC_ENDPOINT ?? 'https://api.mainnet-beta.solana.com';

export const COLOR_PALETTE = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#d946ef', // Fuchsia
    '#f43f5e', // Rose
];