import { Log } from 'ts-tiny-log';

import { Worker, WorkerState } from './worker';

export interface PoolOptions<TIn, TOut> {
	/**
	 * Number of workers. Default is 4
	 */
	nWorkers?: number;

	/**
	 * Worker entry file. Must be a relative/absolute path/file
	 */
	workerEntry: string;

	/**
	 * Queue name that this pool serves
	 */
	queueName: string;

	/**
	 * Class for communicating Parent -> Worker
	 */
	workerType?: typeof Worker;

	/**
	 * Error handler callback
	 */
	error?: (err: Error) => void | Promise<void>;
}

/**
 * Worker pool that manages a set of workers for a queue
 *
 * @typeParam TIn Queue task input type
 * @typeParam TOut Queue task output type
 */
export class Pool<TIn, TOut> {
	/* eslint-disable-next-line no-console */
	protected log: Log = <Log><unknown>console;

	protected workers: Worker<TIn, TOut>[] = [];
	protected options: PoolOptions<TIn, TOut>;

	public constructor(options: PoolOptions<TIn, TOut>) {
		this.options = {
			nWorkers: 4,
			...options,
		};
	}

	/**
	 * Initialize the pool by spawning the initial worker set
	 *
	 * @returns Promise that resolves when all workers are spawned
	 */
	public async initialize(): Promise<void> {
		const promises = [];

		for (let i = 0; i < this.options.nWorkers; i++) {
			promises.push(this.spawnWorker());
		}

		this.workers = await Promise.all(promises);
	}

	/**
	 * Reserve and return a free worker
	 *
	 * @returns The worker, or null if none are available
	 */
	public async reserve(): Promise<null | Worker<TIn, TOut>> {
		for (let i = 0; i < this.workers.length; i++) {
			const worker = this.workers[i];

			if (worker.state === WorkerState.FREE) {
				worker.state = WorkerState.RESERVED;
				return worker;
			}
			else if (worker.state === WorkerState.EXHAUSTED) {
				const newWorker = await this.spawnWorker();
				newWorker.state = WorkerState.RESERVED;
				this.workers[i] = newWorker;
				return newWorker;
			}
		}

		return null;
	}

	/**
	 * Mark a worker as free (available for next task)
	 *
	 * @param worker Worker to release
	 */
	public release(worker: Worker<TIn, TOut>): void {
		if (worker.state === WorkerState.WORKING) {
			worker.state = WorkerState.FREE;
		}
	}

	/**
	 * Get the current number of workers in the pool
	 *
	 * @returns Number of workers
	 */
	public getWorkerCount(): number {
		return this.workers.length;
	}

	/**
	 * Spawn a new worker thread
	 *
	 * @returns The spawned worker
	 */
	protected async spawnWorker(): Promise<Worker<TIn, TOut>> {
		const WorkerType = this.options.workerType || Worker;
		const worker = new WorkerType<TIn, TOut>();

		try {
			return await worker.spawn({
				queueName: this.options.queueName,
				entry: this.options.workerEntry,
			});
		}
		catch (err) {
			if (this.options.error) {
				await this.options.error(err);
			}
			throw err;
		}
	}
}
