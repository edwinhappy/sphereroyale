import { createClient } from 'redis';
import { config } from '../config.js';

const REDIS_CONNECT_TIMEOUT_MS = 5_000;

export const pubClient = createClient({
    url: config.REDIS_URI,
    socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        reconnectStrategy: () => false, // fail fast; avoid infinite reconnect spam
    },
});

export const subClient = pubClient.duplicate({
    socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        reconnectStrategy: () => false,
    },
});

export const isRedisConnected = () => pubClient.isOpen && subClient.isOpen;

export const initRedis = async () => {
    await Promise.all([
        pubClient.connect(),
        subClient.connect(),
    ]);
    console.log('✅ Connected to Redis (Pub/Sub)');
};

let lastPubErrorAt = 0;
let lastSubErrorAt = 0;
const ERROR_LOG_COOLDOWN_MS = 5_000;

pubClient.on('error', (err: unknown) => {
    const now = Date.now();
    if (now - lastPubErrorAt >= ERROR_LOG_COOLDOWN_MS) {
        console.error('Redis Pub Client Error:', err);
        lastPubErrorAt = now;
    }
});

subClient.on('error', (err: unknown) => {
    const now = Date.now();
    if (now - lastSubErrorAt >= ERROR_LOG_COOLDOWN_MS) {
        console.error('Redis Sub Client Error:', err);
        lastSubErrorAt = now;
    }
});
