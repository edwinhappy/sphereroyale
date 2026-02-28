export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    timeoutMs?: number;
}

/**
 * Execute a promise-returning function with exponential backoff and jitter.
 * Optional timeout per attempt.
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    attempt: number = 1
): Promise<T> {
    const { maxRetries, baseDelayMs, maxDelayMs, timeoutMs } = options;

    try {
        if (timeoutMs) {
            return await withTimeout(operation(), timeoutMs);
        }
        return await operation();
    } catch (error) {
        if (attempt > maxRetries) {
            throw error;
        }

        // Exponential backoff with full jitter
        const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
        const jitteredDelay = Math.random() * delay;

        console.warn(`Attempt ${attempt} failed, retrying in ${Math.round(jitteredDelay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));

        return withRetry(operation, options, attempt + 1);
    }
}

/**
 * Wraps a promise with a timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Operation timed out after ${ms}ms`));
        }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}
