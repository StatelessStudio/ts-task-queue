import { Log } from 'ts-tiny-log';
import { parentPort, workerData } from 'worker_threads';

import { ParentMessage, ParentMessageTypes, WorkerSpawnData } from './worker';
import { ParentThread, WorkerMessageTypes } from './parent';
import type { QueueCallback, ErrorHandler } from './queue';

export interface WorkerConfig<TIn, TOut> {
	/**
	 * Function to run on worker startup
	 */
	startup: (data: WorkerSpawnData) => Promise<void>;

	/**
	 * Function to run for the queue task
	 */
	callback: QueueCallback<TIn, TOut>;

	/**
	 * Function to run on error
	 */
	error?: ErrorHandler;

	/**
	 * Class for communicating Worker -> Parent
	 */
	parentType: typeof ParentThread;
}

/**
 * QueueWorker class - handles task execution on worker threads
 *
 * @typeParam TIn Queue task input type
 * @typeParam TOut Queue task output type
 */
export class QueueWorker<TIn, TOut> {
	/* eslint-disable-next-line no-console */
	protected log: Log = <Log><unknown>console;

	protected parent: ParentThread;
	protected config: WorkerConfig<TIn, TOut>;

	/**
	 * Current task's promise, used for tracking timeout
	 */
	protected currentTaskPromise?: Promise<void>;

	/**
	 * Runs on: Worker
	 *
	 * @param config Worker configuration
	 */
	public constructor(config: WorkerConfig<TIn, TOut>) {
		this.config = config;
		this.parent = new config.parentType();
	}

	/**
	 * Initialize the worker with startup callback
	 *
	 * Runs on: Worker
	 */
	public async initialize(): Promise<void> {
		await this.config.startup(workerData);
		if (parentPort) {
			this.listenForWork();
		}
		this.parent.workerStarted();
	}

	/**
	 * Start listening for work from the parent thread
	 *
	 * Runs on: Worker
	 */
	protected listenForWork(): void {
		parentPort.on('message', (message: ParentMessage) => {
			if (message.type === ParentMessageTypes.START_TASK) {
				// Start the task and store the promise for potential timeout handling
				this.currentTaskPromise = this.config.callback(message.data)
					.then((response?: TOut) => {
						// Clear the task promise reference
						delete this.currentTaskPromise;
						this.parent.taskFinished(response);
					})
					.catch((err?: Error) => {
						// Clear the task promise reference
						delete this.currentTaskPromise;
						this.parent.taskFailed(err);
					});
			}
			else if (message.type === 'INTERNAL_TIMEOUT' && this.currentTaskPromise) {
				// A timeout was triggered for the current task
				// Log timeout and reject the current task
				this.log.warn('Task timed out');
				// Reject the current task with a timeout error
				this.currentTaskPromise.catch(() => {
					// Ignore errors if promise already rejected
				});
				delete this.currentTaskPromise;
				// Send timeout notification to parent
				this.parent.taskTimedOut(new Error('Task timed out'));
			}
		});
	}
}
