import { Task } from './task';

/**
 * A value that may be returned synchronously or as a Promise
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Interface for task persistence
 * Allows abstraction of how tasks are stored and retrieved
 *
 * Each method may be implemented synchronously or asynchronously
 * (returning a Promise), allowing persistence backed by external
 * stores such as databases or caches
 */
export interface TaskPersistence<TIn, TOut> {
	/**
	 * Add a task to persistence
	 */
	enqueue(task: Task<TIn, TOut>): MaybePromise<void>;

	/**
	 * Retrieve and remove the next task
	 */
	dequeue(): MaybePromise<Task<TIn, TOut> | undefined>;

	/**
	 * Get the number of tasks in persistence
	 */
	size(): MaybePromise<number>;

	/**
	 * Clear all tasks from persistence
	 */
	clear(): MaybePromise<void>;
}

/**
 * Default in-memory task persistence implementation
 */
export class InMemoryTaskPersistence<TIn, TOut>
implements TaskPersistence<TIn, TOut> {
	protected tasks: Task<TIn, TOut>[] = [];

	public enqueue(task: Task<TIn, TOut>): void {
		this.tasks.push(task);
	}

	public dequeue(): Task<TIn, TOut> | undefined {
		for (let i = 0; i < this.tasks.length; i++) {
			if (this.isTaskReady(i)) {
				return this.tasks.splice(i, 1)[0];
			}
		}

		return undefined;
	}

	protected isTaskReady(index: number): boolean {
		const job = this.tasks[index] ?? null;

		if (!job || job === null) {
			return false;
		}

		if (job.schedule) {
			if (new Date() < job.schedule.scheduledAt) {
				return false;
			}
		}

		return true;
	}

	public size(): number {
		return this.tasks.length;
	}

	public clear(): void {
		this.tasks.length = 0;
	}
}
