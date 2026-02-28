import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Generic validation middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns Express middleware that parses `req.body` against the given Zod
 * schema.  On success the body is replaced with the sanitised output.
 * On failure a 400 response with structured errors is returned.
 */
export function validate<T extends ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const formatted = result.error.issues.map(i => ({
                field: i.path.join('.'),
                message: i.message,
            }));
            res.status(400).json({ error: 'Validation failed', details: formatted });
            return;
        }

        // Replace body with the cleaned & transformed data
        req.body = result.data;
        next();
    };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * POST /api/register
 *
 * - username: trimmed, lowercased, 3–20 chars, alphanumeric + underscores only
 * - walletAddress: trimmed, 1–128 chars
 * - chain: strict enum 'SOL' | 'TON'
 * - paymentTxHash: trimmed, 1–256 chars, alphanumeric/hex-safe
 */
export const registerSchema = z.object({
    username: z
        .string({ message: 'Username is required' })
        .trim()
        .toLowerCase()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be at most 20 characters')
        .regex(/^[a-z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),

    walletAddress: z
        .string({ message: 'Wallet address is required' })
        .trim()
        .min(1, 'Wallet address is required')
        .max(128, 'Wallet address is too long'),

    chain: z
        .enum(['SOL', 'TON'], {
            message: 'Chain must be SOL or TON',
        }),

    paymentTxHash: z
        .string({ message: 'Payment transaction hash is required' })
        .trim()
        .min(1, 'Payment transaction hash is required')
        .max(256, 'Transaction hash is too long')
        .regex(/^[a-zA-Z0-9_\-+/=]+$/, 'Transaction hash contains invalid characters'),
}).strict();   // reject unexpected fields

/**
 * POST /api/admin/login
 */
export const loginSchema = z.object({
    password: z
        .string({ message: 'Password is required' })
        .min(1, 'Password is required')
        .max(256, 'Password is too long'),
}).strict();

/**
 * POST /api/schedule
 *
 * - nextGameTime: ISO 8601 string → transformed to Date, must be in the future
 * - totalPlayers: integer 2–2000
 */
export const scheduleSchema = z.object({
    nextGameTime: z
        .union([
            z.string()
                .datetime({ message: 'nextGameTime must be a valid ISO 8601 datetime' })
                .transform(s => new Date(s))
                .refine(d => d.getTime() > Date.now(), {
                    message: 'nextGameTime must be in the future',
                }),
            z.null(),
        ]),

    totalPlayers: z
        .number({ message: 'Total players must be a number' })
        .int('Total players must be an integer')
        .min(2, 'Total players must be at least 2')
        .max(2000, 'Total players must be at most 2000'),
}).strict();
