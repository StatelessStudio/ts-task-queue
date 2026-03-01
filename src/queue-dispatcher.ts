import { Log } from 'ts-tiny-log';

import { TaskPersistence } from './task-persistence';
import { Task } from './task';
import { Worker } from './worker';
import { Pool } from './pool';
import { QueueOptions } from './queue';

export interface DispatcherConfig<TIn, TOut> {
	/**
	 * Queue name. Must be unique
	 */
	name: string;

	/**
	 * Worker entry file. Must be a relative/absolute path/file
	 */
	workerEntry: string;

	/**
	 * Number of workers
	 */
	nWorkers: number;

	/**
	 * Worker class type
	 */
	workerType: typeof Worker;

	/**
	 * Error handler
	 */
	error?: (err: Error) => void | Promise<void>;

	/**
	 * Queue options for retry and polling
	 */
	options: QueueOptions<TIn, TOut>;
}

/**
 * QueueDispatcher class - handles task distribution on the main thread
 *
 * @typeParam TIn Queue task input type
 * @typeParam TOut Queue task output type
 */
export class QueueDispatcher<TIn, TOut> {
	/* eslint-disable-next-line no-console */
	protected log: Log = <Log><unknown>console;

	protected tasks: TaskPersistence<TIn, TOut>;
	protected pool: Pool<TIn, TOut>;
	protected config: DispatcherConfig<TIn, TOut>;

	/**
	 * Runs on: Main
	 *
	 * @param tasks Task persistence instance
	 * @param config Dispatcher configuration
	 */
	public constructor(
		tasks: TaskPersistence<TIn, TOut>,
		config: DispatcherConfig<TIn, TOut>
	) {
		this.tasks = tasks;
		this.config = config;
	}

	/**
	 * Initialize the dispatcher by setting up the worker pool
	 *
	 * Runs on: Main
	 */
	public async initialize(): Promise<void> {
		this.pool = new Pool<TIn, TOut>({
			nWorkers: this.config.nWorkers,
			workerEntry: this.config.workerEntry,
			queueName: this.config.name,
			workerType: this.config.workerType,
			error: this.config.error,
		});

		await this.pool.initialize();
	}

	/**
	 * Start the polling loop to distribute tasks to workers
	 *
	 * Runs on: Main
	 */
	public start(): void {
		if (!this.pool) {
			throw new Error('Dispatcher not initialized. Call initialize() first.');
		}

		let worker: Worker<TIn, TOut> | null;

		setInterval(async () => {
			if (!worker) {
				worker = await this.pool.reserve();
			}

			if (worker) {
				const task = this.tasks.dequeue();

				if (task) {
					// Check if task has expired
					if (this.isTaskExpired(task)) {
						if (task.reject) {
							task.reject(new Error('Task expired'));
						}

						// TODO: Emit options.error?
					}
					else {
						// Apply retry logic to the task's reject callback
						this.applyRetryHandler(task);
						worker.startTask(task);
						worker = null;
					}
				}
			}
		}, this.config.options.pollingRate);
	}

	/**
	 * Apply retry handling to a task's reject callback
	 *
	 * Runs on: Main
	 *
	 * @param task Task to apply retry handler to
	 */
	protected applyRetryHandler(task: Task<TIn, TOut>): void {
		const originalReject = task.reject;
		const attemptCount = task.attempts ?? 0;

		task.reject = (error: Error) => {
			if (attemptCount < this.config.options.maxAttempts - 1) {
				// Calculate scheduled start time with retry delay
				if (this.config.options.retryDelayMs > 0) {
					const scheduledAt = new Date(
						Date.now() + this.config.options.retryDelayMs
					);

					if (task.schedule) {
						task.schedule.scheduledAt = scheduledAt;
					}
					else {
						task.schedule = { scheduledAt };
					}
				}

				// Re-enqueue the task with incremented attempt count and delay
				this.tasks.enqueue({
					...task,
					attempts: attemptCount + 1,
					reject: originalReject,
				});
			}
			else {
				// Max retries exceeded, call the original reject
				if (originalReject) {
					originalReject(error);
				}
			}
		};
	}

	/**
	 * Check if a task has expired
	 *
	 * Runs on: Main
	 *
	 * @param task Task to check
	 * @return Returns true if the task has expired, false otherwise
	 */
	protected isTaskExpired(task: Task<TIn, TOut>): boolean {
		if (task.schedule && task.schedule.expiresAt) {
			return new Date() > task.schedule.expiresAt;
		}

		return false;
	}
}
