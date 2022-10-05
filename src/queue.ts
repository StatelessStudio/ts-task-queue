import { Log } from 'ts-tiny-log';
import { parentPort, isMainThread, workerData } from 'worker_threads';

import { Task } from './task';
import {
	ParentMessage,
	ParentMessageTypes,
	Worker,
	WorkerSpawnData,
	WorkerState
} from './worker';
import { ParentThread } from './parent';

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
		startup: async () => {},
		error: error => this.log.error('Queue Error', error),
		fatal: error => {
			this.log.error('Queue Fatal Error', error);
			process.exit();
		},
		parentType: ParentThread,
		workerType: Worker,
	};

	protected tasks: Task<TIn, TOut>[] = [];
	protected workers: Worker<TIn, TOut>[] = [];
	protected parent: ParentThread;

	protected options: QueueOptions<TIn, TOut>;

	/**
	 * Runs on: Main, Worker
	 *
	 * @param options Queue options
	 */
	public constructor(options: QueueOptions<TIn, TOut>) {
		this.options = options = { ...this.defaultOptions, ...options };

		if (this.isMainThread()) {
			this.buildPool()
				.catch(options.fatal);

			this.start();
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
	 * @param task Input data for the task
	 */
	public push(task: TIn): void {
		this.tasks.push({
			request: task,
		});
	}

	/**
	 * Push a new task to the queue. This method will return a promise that
	 * 	will resolve when/if the task runs and completes
	 *
	 * Runs on: Main
	 *
	 * @param task Input data for the task
	 * @return Returns the task result
	 */
	public async await(task: TIn): Promise<TOut> {
		return new Promise<TOut>((accept, reject) => {
			this.tasks.push({
				request: task,
				accept,
				reject,
			});
		});
	}

	/**
	 * Spawns a new Worker
	 *
	 * Runs on: Main
	 *
	 * @returns Returns the worker
	 */
	protected async spawnWorker(): Promise<Worker<TIn, TOut>> {
		return await (new this.options.workerType<TIn, TOut>()).spawn({
			queueName: this.options.name,
			entry: this.options.workerEntry,
		});
	}

	/**
	 * Build the worker pool
	 *
	 * Runs on: Main
	 */
	protected async buildPool(): Promise<void> {
		const promises = [];

		for (let i = 0; i < this.options.nWorkers; i++) {
			promises.push(this.spawnWorker());
		}

		this.workers = await Promise.all(promises);
	}

	/**
	 * Start working the queue
	 *
	 * Runs on: Main
	 */
	protected start(): void {
		setInterval(async () => {
			if (this.tasks.length) {
				const worker = await this.reserveWorker();

				if (worker) {
					const nextTask = this.tasks.splice(0, 1)[0];

					worker.startTask(nextTask);
				}
			}
		}, 250);
	}

	/**
	 * Reserves & returns a free worker
	 *
	 * Runs on: Main
	 *
	 * @return Returns the worker, or null if none are available
	 */
	protected async reserveWorker(): Promise<null | Worker<TIn, TOut>> {
		for (let i = 0; i < this.workers.length; i++) {
			const worker = this.workers[i];

			if (worker.state === WorkerState.FREE) {
				worker.state = WorkerState.RESERVED;

				return worker;
			}
			else if (worker.state === WorkerState.EXHAUSTED) {
				const worker = await this.spawnWorker();
				worker.state = WorkerState.RESERVED;
				this.workers[i] = worker;

				return worker;
			}
		}

		return null;
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
