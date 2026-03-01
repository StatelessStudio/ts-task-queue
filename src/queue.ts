import { Log } from 'ts-tiny-log';
import { parentPort, isMainThread, workerData } from 'worker_threads';

import { TaskPersistence, InMemoryTaskPersistence } from './task-persistence';
import { Task } from './task';
import {
	ParentMessage,
	ParentMessageTypes,
	Worker,
	WorkerSpawnData,
} from './worker';
import { ParentThread } from './parent';
import { Pool } from './pool';

export type QueueCallback<TIn, TOut> = (data: TIn) => Promise<TOut>;
export type ErrorHandler = (err: Error) => void | Promise<void>;

export interface QueueOptions<TIn, TOut> {
	/**
	 * Queue name. Must be unique
	 */
	name: string;

	/**
	 * Worker entry file. Must be a relative/absolute path/file
	 */
	workerEntry?: string;

	/**
	 * Number of workers. Default is 4
	 */
	nWorkers?: number;

	/**
	 * Polling rate in milliseconds. Default is 250
	 */
	pollingRate?: number;

	/**
	 * Maximum number of attempts for a task. Default is 1
	 */
	maxAttempts?: number;

	/**
	 * Delay in milliseconds before retrying a failed task. Default is 0
	 */
	retryDelayMs?: number;

	/**
	 * Function to run on worker startup
	 */
	startup?: (data: WorkerSpawnData) => Promise<void>;

	/**
	 * Function to run for the queue task
	 */
	callback: QueueCallback<TIn, TOut>;

	/**
	 * Function to run on error
	 */
	error?: ErrorHandler,

	/**
	 * Function to run on fatal error
	 */
	fatal?: ErrorHandler,

	/**
	 * Class for communicating Worker -> Parent
	 */
	parentType?: typeof ParentThread,

	/**
	 * Class for communicating Parent -> Worker
	 */
	workerType?: typeof Worker,

	/**
	 * Task persistence implementation. Default is InMemoryTaskPersistence
	 */
	persistenceType?: typeof InMemoryTaskPersistence,
}

/**
 * Queue class
 *
 * @typeParam TIn Queue task input type
 * @typeParam TOut Queue task output type
 */
export class Queue<TIn, TOut> {
	/* eslint-disable-next-line no-console */
	protected log: Log = <Log><unknown>console;

	public defaultOptions: Partial<QueueOptions<TIn, TOut>> = {
		workerEntry: process.cwd(),
		nWorkers: 4,
		pollingRate: 250,
		maxAttempts: 1,
		retryDelayMs: 0,
		startup: async () => {},
		error: error => this.log.error('Queue Error', error),
		fatal: error => {
			this.log.error('Queue Fatal Error', error);
			process.exit();
		},
		parentType: ParentThread,
		workerType: Worker,
		persistenceType: InMemoryTaskPersistence,
	};

	protected tasks: TaskPersistence<TIn, TOut>;
	protected pool: Pool<TIn, TOut>;
	protected parent: ParentThread;

	protected options: QueueOptions<TIn, TOut>;

	/**
	 * Runs on: Main, Worker
	 *
	 * @param options Queue options
	 */
	public constructor(options: QueueOptions<TIn, TOut>) {
		this.options = options = { ...this.defaultOptions, ...options };
		this.tasks = new options.persistenceType();

		if (this.isMainThread()) {
			this.pool = new Pool<TIn, TOut>({
				nWorkers: options.nWorkers,
				workerEntry: options.workerEntry,
				queueName: options.name,
				workerType: options.workerType,
				error: options.error,
			});

			this.pool.initialize()
				.then(() => this.start())
				.catch(options.fatal);
		}
		else if (workerData.queueName === this.options.name) {
			this.parent = new options.parentType();

			options.startup(workerData)
				.then(() => {
					this.listenForWork();
					this.parent.workerStarted();
				})
				.catch(options.error);
		}
	}

	/**
	 * Check if this thread is the main thread
	 *
	 * @returns Returns true on the main thread, false on workers
	 */
	public isMainThread(): boolean {
		return isMainThread;
	}

	/**
	 * Push a new task to the queue to be run in parallel. This task will
	 * 	not be joined back into the main thread on completion.
	 *
	 * Runs on: Main
	 *
	 * @param task Task object
	 */
	public push(task: Task<TIn, TOut>): void {
		this.tasks.enqueue(task);
	}

	/**
	 * Push a new task to the queue. This method will return a promise that
	 * 	will resolve when/if the task runs and completes
	 *
	 * Runs on: Main
	 *
	 * @param task Task object. The accept and reject callbacks will
	 * 			   be attached automatically.
	 * @return Returns a promise resolving to the task result (type TOut)
	 */
	public async await(
		task: Omit<Task<TIn, TOut>, 'accept' | 'reject'>
	): Promise<TOut> {
		return new Promise<TOut>((accept, reject) => {
			this.tasks.enqueue({
				...task,
				accept,
				reject,
			});
		});
	}

	/**
	 * Start working the queue
	 *
	 * Runs on: Main
	 */
	protected start(): void {
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
		}, this.options.pollingRate);
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
			if (attemptCount < this.options.maxAttempts - 1) {
				// Calculate scheduled start time with retry delay
				if (this.options.retryDelayMs > 0) {
					const scheduledAt = new Date(
						Date.now() + this.options.retryDelayMs
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

	/**
	 * Start listening for work
	 *
	 * Runs on: Worker
	 *
	 * @param callback Callback to run on the worker
	 */
	protected listenForWork() {
		parentPort.on('message', (message: ParentMessage) => {
			if (message.type === ParentMessageTypes.START_TASK) {
				this.options.callback(message.data)
					.then((response?) => this.parent.taskFinished(response))
					.catch((err?) => this.parent.taskFailed(err));
			}
		});
	}
}
