import { createClient } from 'redis';
import { config } from '../config.js';

export const pubClient = createClient({ url: config.REDIS_URI });
export const subClient = pubClient.duplicate();

export const initRedis = async () => {
    try {
        await Promise.all([
            pubClient.connect(),
            subClient.connect()
        ]);
        console.log('✅ Connected to Redis (Pub/Sub)');
    } catch (error) {
        console.error('❌ Redis Connection Error:', error);
        process.exit(1);
    }
};

pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));
