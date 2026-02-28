export const ARENA_WIDTH = 1200;
export const ARENA_HEIGHT = 800;
export const FPS = 60;
export const FRICTION = 0.995;
export const ELASTICITY = 0.8;
export const WALL_DAMPING = 0.7;

interface ViteImportMeta {
    env?: Record<string, string | undefined>;
}

const viteMeta = import.meta as unknown as ViteImportMeta;
const viteEnv = viteMeta.env || {};

export const REGISTRATION_FEE_USDT = 2;
export const TON_USDT_JETTON_MASTER = viteEnv.VITE_TON_USDT_JETTON_MASTER ?? '';
export const SOL_USDT_MINT = viteEnv.VITE_SOL_USDT_MINT ?? '';
export const TON_RECIPIENT_ADDRESS = viteEnv.VITE_TON_RECIPIENT_ADDRESS ?? '';
export const SOL_RECIPIENT_ADDRESS = viteEnv.VITE_SOL_RECIPIENT_ADDRESS ?? '';
export const SOL_RPC_ENDPOINT = viteEnv.VITE_SOL_RPC_ENDPOINT ?? 'https://api.mainnet-beta.solana.com';

export const COLOR_PALETTE = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#84cc16',
    '#10b981',
    '#06b6d4',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#d946ef',
    '#f43f5e',
];
