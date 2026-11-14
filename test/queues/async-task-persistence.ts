import {
	TaskPersistence,
	InMemoryTaskPersistence,
} from '../../src/task-persistence';
import { Task } from '../../src/task';

/**
 * Asynchronous task persistence for testing, simulating an external
 * store (e.g. database or cache) by resolving on a future tick
 */
export class AsyncTaskPersistence<TIn, TOut>
implements TaskPersistence<TIn, TOut> {
	protected store = new InMemoryTaskPersistence<TIn, TOut>();

	protected async delay(): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, 5));
	}

	public async enqueue(task: Task<TIn, TOut>): Promise<void> {
		await this.delay();
		this.store.enqueue(task);
	}

	public async dequeue(): Promise<Task<TIn, TOut> | undefined> {
		await this.delay();

		return this.store.dequeue();
	}

	public async size(): Promise<number> {
		await this.delay();

		return this.store.size();
	}

	public async clear(): Promise<void> {
		await this.delay();
		this.store.clear();
	}
}

/**
 * Task persistence whose enqueue always rejects, for testing
 * persistence failure handling
 */
export class FailingEnqueuePersistence<TIn, TOut>
	extends AsyncTaskPersistence<TIn, TOut> {
	public async enqueue(): Promise<void> {
		throw new Error('Persistence enqueue failed');
	}
}
