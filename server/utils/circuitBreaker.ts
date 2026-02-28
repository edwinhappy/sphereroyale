export enum CircuitState {
    CLOSED,    // Normal operation
    OPEN,      // Failing, block calls
    HALF_OPEN  // Testing recovery
}

export interface CircuitBreakerOptions {
    failureThreshold: number; // Number of consecutive failures before opening
    resetTimeoutMs: number;   // Time to wait before testing recovery (Half-Open)
}

/**
 * A simple Circuit Breaker to prevent cascading failures to a degraded external service.
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private nextAttemptAt: number = 0;

    private readonly failureThreshold: number;
    private readonly resetTimeoutMs: number;

    constructor(options: CircuitBreakerOptions) {
        this.failureThreshold = options.failureThreshold;
        this.resetTimeoutMs = options.resetTimeoutMs;
    }

    /**
     * Executes the given promise-returning function through the circuit breaker.
     */
    public async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() >= this.nextAttemptAt) {
                // Time to test recovery
                this.state = CircuitState.HALF_OPEN;
                console.warn('[CircuitBreaker] State -> HALF_OPEN. Testing recovery...');
            } else {
                throw new Error('Circuit Breaker is OPEN. Fast-failing request.');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.CLOSED;
            console.log('[CircuitBreaker] State -> CLOSED. Service recovered.');
        }
    }

    private onFailure(): void {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
            console.error(`[CircuitBreaker] State -> OPEN. Threshold reached (${this.failureThreshold}). Sleeping for ${this.resetTimeoutMs}ms.`);
        }
    }

    public getState(): CircuitState {
        return this.state;
    }
}
