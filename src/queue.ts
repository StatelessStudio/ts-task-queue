import { Log } from 'ts-tiny-log';
import { isMainThread, workerData } from 'worker_threads';

import { TaskPersistence, InMemoryTaskPersistence } from './task-persistence';
import { Task } from './task';
import {
	Worker,
	WorkerSpawnData,
} from './worker';
import { ParentThread } from './parent';
import { QueueDispatcher } from './queue-dispatcher';
import { QueueWorker } from './queue-worker';

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
 * Queue class - main entry point for task queue
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
			this.initializeMainThread();
		}
		else if (workerData.queueName === this.options.name) {
			this.initializeWorker();
		}
	}

	/**
	 * Initialize main thread with dispatcher
	 *
	 * Runs on: Main
	 */
	protected initializeMainThread(): void {
		const dispatcher = new QueueDispatcher(this.tasks, {
			name: this.options.name,
			workerEntry: this.options.workerEntry,
			nWorkers: this.options.nWorkers,
			workerType: this.options.workerType,
			error: this.options.error,
			options: this.options,
		});

		dispatcher.initialize()
			.then(() => dispatcher.start())
			.catch(this.options.fatal);
	}

	/**
	 * Initialize worker thread
	 *
	 * Runs on: Worker
	 */
	protected initializeWorker(): void {
		const worker = new QueueWorker({
			startup: this.options.startup,
			callback: this.options.callback,
			error: this.options.error,
			parentType: this.options.parentType,
		});
		worker.initialize().catch(this.options.error);
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
}
