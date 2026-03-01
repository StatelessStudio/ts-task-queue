import { Log } from 'ts-tiny-log';
import { parentPort, workerData } from 'worker_threads';

import { ParentMessage, ParentMessageTypes, WorkerSpawnData } from './worker';
import { ParentThread } from './parent';
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
				this.config.callback(message.data)
					.then((response?: TOut) => this.parent.taskFinished(response))
					.catch((err?: Error) => this.parent.taskFailed(err));
			}
		});
	}
}
