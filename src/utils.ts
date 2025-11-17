import { createHash } from 'crypto';
export function md5(str: string): string {
	return createHash('md5').update(str, 'utf-8').digest('hex');
}

export class Semaphore {
    private capacity: number;
    private current: number;
    private queue: Array<() => void> = [];

    constructor(capacity: number) {
        this.capacity = capacity;
        this.current = 0;
    }

    async acquire(): Promise<void> {
        return new Promise((resolve) => {
            if (this.current < this.capacity) {
                this.current++;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release(): void {
        this.current--;
        if (this.queue.length > 0) {
            this.current++;
            const next = this.queue.shift();
            next?.();
        }
    }
}