import { Task } from './task';

/**
 * Interface for task persistence
 * Allows abstraction of how tasks are stored and retrieved
 */
export interface TaskPersistence<TIn, TOut> {
	/**
	 * Add a task to persistence
	 */
	enqueue(task: Task<TIn, TOut>): void;

	/**
	 * Retrieve and remove the next task
	 */
	dequeue(): Task<TIn, TOut> | undefined;

	/**
	 * Get the number of tasks in persistence
	 */
	size(): number;

	/**
	 * Clear all tasks from persistence
	 */
	clear(): void;
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

		return true;
	}

	public size(): number {
		return this.tasks.length;
	}

	public clear(): void {
		this.tasks.length = 0;
	}
}
