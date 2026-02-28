import { z } from 'zod';
import dotenv from 'dotenv';

// Load server/.env BEFORE validation
dotenv.config();

// ---------------------------------------------------------------------------
// Schema — every env var the server needs, validated at boot
// ---------------------------------------------------------------------------

const envSchema = z.object({
    // Core
    PORT: z.string().default('3001'),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    REDIS_URI: z.string().min(1, "REDIS_URI is required"),

    // Auth
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long for security"),
    JWT_EXPIRY: z.string().default('5m'),
    ADMIN_PASSWORD_HASH: z.string().min(1, 'ADMIN_PASSWORD_HASH is required'),

    // Payment — Solana
    SOL_RECIPIENT_ADDRESS: z.string().min(1, 'SOL_RECIPIENT_ADDRESS is required'),
    SOL_USDT_MINT: z.string().min(1, 'SOL_USDT_MINT is required'),
    SOL_RPC_ENDPOINTS: z.string()
        .default('https://api.mainnet-beta.solana.com,https://solana-api.projectserum.com')
        .transform(val => val.split(',').map(s => s.trim()).filter(Boolean)),

    // Payment — TON
    TON_RECIPIENT_ADDRESS: z.string().min(1, 'TON_RECIPIENT_ADDRESS is required'),
    TON_USDT_JETTON_MASTER: z.string().min(1, 'TON_USDT_JETTON_MASTER is required'),
    TON_RPC_ENDPOINTS: z.string()
        .default('https://toncenter.com/api/v3,https://go.getblock.io/xxx')
        .transform(val => val.split(',').map(s => s.trim()).filter(Boolean)),

    // Registration
    REGISTRATION_FEE_USDT: z.string().default('2').transform(Number),
});

// ---------------------------------------------------------------------------
// Parse & fail-fast
// ---------------------------------------------------------------------------

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Server config validation failed. Fix your server/.env:');
    for (const issue of parsed.error.issues) {
        console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
}

/**
 * Typed, validated server configuration.
 * Import this instead of reading `process.env` directly.
 */
export const config = parsed.data;
