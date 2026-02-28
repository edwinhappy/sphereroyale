import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { pubClient } from '../services/redis.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRY = config.JWT_EXPIRY;

// ---------------------------------------------------------------------------
// Payload shape
// ---------------------------------------------------------------------------
interface AdminTokenPayload {
    role: 'admin';
    jti: string;
    iat: number;
    exp: number;
}

// ---------------------------------------------------------------------------
// Sign / Verify helpers
// ---------------------------------------------------------------------------

/**
 * Create a signed JWT for an admin user.
 */
export function signAdminToken(): { token: string; expiresIn: string } {
    const jti = crypto.randomUUID();
    const token = jwt.sign({ role: 'admin', jti }, JWT_SECRET, {
        expiresIn: JWT_EXPIRY as any,
    });
    return { token, expiresIn: JWT_EXPIRY as string };
}

/**
 * Verify and decode an admin JWT against the secret and the active Redis blacklist.
 * Throws on invalid, expired, or explicitly logged-out tokens.
 */
export async function verifyAdminToken(token: string): Promise<AdminTokenPayload> {
    const payload = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;

    // Explicit server-side invalidation check
    const isBlacklisted = await pubClient.get(`blacklist:${payload.jti}`);
    if (isBlacklisted) {
        throw new Error('Token has been revoked/logged out');
    }

    return payload;
}

/**
 * Boolean wrapper for socket handlers — returns true when valid.
 */
export async function verifySocketAdminToken(token: string): Promise<boolean> {
    try {
        const payload = await verifyAdminToken(token);
        return payload.role === 'admin';
    } catch {
        return false;
    }
}

/**
 * Check whether a token is within a grace window (≤2 min from expiry)
 * and therefore eligible for refresh. Note: Must be async now.
 */
export async function isTokenRefreshable(token: string): Promise<boolean> {
    try {
        const payload = await verifyAdminToken(token);
        const now = Math.floor(Date.now() / 1000);
        const remaining = payload.exp - now;
        // Allow refresh when ≤ 2 minutes remain
        return remaining > 0 && remaining <= 120;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that requires a valid admin JWT in the
 * `Authorization: Bearer <token>` header.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
        res.status(401).json({ error: 'Missing authorization token' });
        return;
    }

    try {
        const payload = await verifyAdminToken(token);
        if (payload.role !== 'admin') {
            res.status(403).json({ error: 'Insufficient privileges' });
            return;
        }
        next();
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            res.status(401).json({ error: 'Token expired' });
        } else if (err.message.includes('revoked')) {
            res.status(401).json({ error: 'Session explicitly terminated' });
        } else {
            res.status(401).json({ error: 'Invalid token' });
        }
    }
}
