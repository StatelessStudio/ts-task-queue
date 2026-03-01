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
	 * Check if there are any tasks in persistence
	 */
	isEmpty(): boolean;

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
		return this.tasks.shift();
	}

	public size(): number {
		return this.tasks.length;
	}

	public isEmpty(): boolean {
		return this.tasks.length === 0;
	}

	public clear(): void {
		this.tasks.length = 0;
	}
}
