/**
 * Redis Client Singleton
 * Centralized Redis connection management for BullMQ
 */
import IORedis from 'ioredis';

let redisClient: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is not configured');
  }

  if (!redisClient) {
    redisClient = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ compatibility
      enableReadyCheck: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis connection closed');
  }
}
