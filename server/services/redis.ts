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

pubClient.on('error', (err: unknown) => console.error('Redis Pub Client Error:', err));
subClient.on('error', (err: unknown) => console.error('Redis Sub Client Error:', err));
