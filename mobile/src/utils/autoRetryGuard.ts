export type TriggerSource = 'auto' | 'manual';

export interface AutoRetryPolicy {
    maxAutoAttempts: number;
    pauseOnConsecutiveFailures: number;
    baseDelayMs: number;
    maxDelayMs: number;
}

export interface FailureState {
    consecutiveFailures: number;
    paused: boolean;
    lastFailureAt: number | null;
    autoAttempts: number;
}

const DEFAULT_POLICY: AutoRetryPolicy = {
    maxAutoAttempts: 1,
    pauseOnConsecutiveFailures: 1,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
};

export class AutoRetryGuard {
    private readonly policy: AutoRetryPolicy;

    private state: FailureState = {
        consecutiveFailures: 0,
        paused: false,
        lastFailureAt: null,
        autoAttempts: 0,
    };

    constructor(policy: Partial<AutoRetryPolicy>) {
        this.policy = {
            ...DEFAULT_POLICY,
            ...policy,
        };
    }

    shouldAttempt(trigger: TriggerSource): boolean {
        if (trigger === 'manual') {
            return true;
        }

        return !this.state.paused && this.state.autoAttempts < this.policy.maxAutoAttempts;
    }

    recordAttempt(trigger: TriggerSource): void {
        if (trigger !== 'auto') {
            return;
        }

        this.state.autoAttempts += 1;
    }

    recordSuccess(): void {
        this.state = {
            consecutiveFailures: 0,
            paused: false,
            lastFailureAt: null,
            autoAttempts: 0,
        };
    }

    recordFailure(error?: unknown): void {
        if (typeof error !== 'undefined') {
            // Preserve parameter for telemetry extensions and avoid lint noise.
        }
        this.state.consecutiveFailures += 1;
        this.state.lastFailureAt = Date.now();

        if (this.state.consecutiveFailures >= this.policy.pauseOnConsecutiveFailures) {
            this.state.paused = true;
        }

        if (this.state.autoAttempts >= this.policy.maxAutoAttempts) {
            this.state.paused = true;
        }
    }

    getNextDelayMs(): number {
        const exponent = Math.max(0, this.state.autoAttempts - 1);
        const delayMs = this.policy.baseDelayMs * 2 ** exponent;
        return Math.min(this.policy.maxDelayMs, delayMs);
    }

    resetByManual(): void {
        this.recordSuccess();
    }

    getState(): FailureState {
        return { ...this.state };
    }
}
