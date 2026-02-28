import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Express rate limiters (per-IP by default via express-rate-limit)
// ---------------------------------------------------------------------------

/**
 * General API limiter — relaxed default for all /api routes.
 * 100 requests per 15-minute window per IP.
 */
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

/**
 * Auth limiter — strict limiter for POST /api/admin/login.
 * 5 requests per 15-minute window per IP.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' },
});

/**
 * Registration limiter — 10 requests per 15-minute window.
 * Key is composite: IP + wallet + username from body (falls back to IP only).
 */
export const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
        const ip = req.ip || 'unknown';
        const wallet = req.body?.walletAddress || '';
        const user = req.body?.username || '';
        return `${ip}|${wallet}|${user}`;
    },
    message: { error: 'Too many registration attempts, please try again later.' },
});

// ---------------------------------------------------------------------------
// Progressive backoff for admin login (in-memory, per-IP)
// ---------------------------------------------------------------------------

interface BackoffEntry {
    failures: number;
    blockedUntil: number;     // epoch-ms
}

const backoffMap = new Map<string, BackoffEntry>();

const BACKOFF_BASE_MS = 30_000;   // 30 seconds
const BACKOFF_CAP_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Middleware: reject immediately if the IP is still in a backoff window.
 */
export function progressiveBackoffCheck(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip || 'unknown';
    const entry = backoffMap.get(ip);

    if (entry && Date.now() < entry.blockedUntil) {
        const retryAfterSec = Math.ceil((entry.blockedUntil - Date.now()) / 1000);
        res.set('Retry-After', String(retryAfterSec));
        res.status(429).json({
            error: 'Too many failed login attempts. Please try again later.',
            retryAfterSeconds: retryAfterSec,
        });
        return;
    }

    next();
}

/**
 * Record a failed admin login attempt — doubles the backoff window each time.
 */
export function recordLoginFailure(ip: string): void {
    const entry = backoffMap.get(ip) || { failures: 0, blockedUntil: 0 };
    entry.failures += 1;
    const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, entry.failures - 1), BACKOFF_CAP_MS);
    entry.blockedUntil = Date.now() + delay;
    backoffMap.set(ip, entry);
}

/**
 * Clear backoff state on successful login.
 */
export function clearLoginBackoff(ip: string): void {
    backoffMap.delete(ip);
}

// ---------------------------------------------------------------------------
// Socket event throttling helpers (per-connection, per-event)
// ---------------------------------------------------------------------------

interface SocketThrottleState {
    /** Last-call timestamp per event name */
    lastCall: Map<string, number>;
    /** Auth failure count */
    authFailures: number;
    /** Blocked until epoch-ms (progressive) */
    blockedUntil: number;
}

const socketStateMap = new WeakMap<object, SocketThrottleState>();

const SOCKET_COOLDOWN_MS = 2_000;            // 2 s between duplicate events
const SOCKET_AUTH_FAIL_LIMIT = 3;
const SOCKET_BACKOFF_BASE_MS = 60_000;       // 60 s initial lockout
const SOCKET_BACKOFF_CAP_MS = 5 * 60_000;  // 5 min cap

function getSocketState(socket: object): SocketThrottleState {
    let state = socketStateMap.get(socket);
    if (!state) {
        state = { lastCall: new Map(), authFailures: 0, blockedUntil: 0 };
        socketStateMap.set(socket, state);
    }
    return state;
}

/**
 * Returns `true` if the event should be allowed through (not throttled).
 * Returns `false` if the event should be silently dropped.
 */
export function allowSocketEvent(socket: object, eventName: string): boolean {
    const state = getSocketState(socket);
    const now = Date.now();

    // Check progressive lockout first
    if (now < state.blockedUntil) {
        return false;
    }

    // Per-event cooldown
    const last = state.lastCall.get(eventName) || 0;
    if (now - last < SOCKET_COOLDOWN_MS) {
        return false;
    }

    state.lastCall.set(eventName, now);
    return true;
}

/**
 * Record a socket auth failure. Returns `true` if the socket is now locked out.
 */
export function recordSocketAuthFailure(socket: object): boolean {
    const state = getSocketState(socket);
    state.authFailures += 1;

    if (state.authFailures >= SOCKET_AUTH_FAIL_LIMIT) {
        const delay = Math.min(
            SOCKET_BACKOFF_BASE_MS * Math.pow(2, state.authFailures - SOCKET_AUTH_FAIL_LIMIT),
            SOCKET_BACKOFF_CAP_MS,
        );
        state.blockedUntil = Date.now() + delay;
        return true;
    }
    return false;
}

/**
 * Reset socket auth failure state (e.g. on successful auth).
 */
export function resetSocketAuth(socket: object): void {
    const state = getSocketState(socket);
    state.authFailures = 0;
    state.blockedUntil = 0;
}
