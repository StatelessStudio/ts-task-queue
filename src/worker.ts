import { Worker as Thread } from 'worker_threads';

import { Task } from './task';
import { WorkerMessageTypes } from './parent';

export enum WorkerState {
	STARTING,
	FREE,
	RESERVED,
	WORKING,
	EXHAUSTED,
}

export interface WorkerSpawnData {
	queueName: string;
}

export interface WorkerOptions {
	queueName: string;
	entry: string;
}

/**
 * Messages sent from main thread
 */
export enum ParentMessageTypes {
	START_TASK = 'START_TASK',
}

/**
 * Message interface from main thread
 */
export interface ParentMessage {
	type: ParentMessageTypes;
	data?: any;
}

export class Worker<TIn, TOut> {
	public state: WorkerState = WorkerState.STARTING;

	protected thread: Thread;
	protected id: number;
	protected task: Task<TIn, TOut>;

	/**
	 * Spawn a thread for this worker
	 *
	 * Runs on: Main
	 *
	 * @param options Worker options
	 * @returns Returns the worker
	 */
	public async spawn(
		options: WorkerOptions
	): Promise<Worker<TIn, TOut>> {
		return new Promise((accept, reject) => {
			const workerSpawnData: WorkerSpawnData = {
				queueName: options.queueName,
			};

			this.thread = new Thread(options.entry, {
				workerData: workerSpawnData,
			});

			this.id = this.thread.threadId;

			this.thread.on('message', (response?) => {
				if (response.message === WorkerMessageTypes.STARTED) {
					this.state = WorkerState.FREE;
					accept(this);
				}
				else if (
					response.message === WorkerMessageTypes.TASK_FINISHED
				) {
					this.finished(response.data);
				}
				else if (response.message === WorkerMessageTypes.TASK_FAILED) {
					this.failed(response.data);
				}
			});

			this.thread.on('error', err => {
				this.exhausted(err);

				if (this.state === WorkerState.STARTING) {
					reject(err);
				}
			});

			this.thread.on('exit', code => {
				const msg = `Worker ${this.id} exited with code ${code}`;
				const err = new Error(msg);
				this.exhausted(err);

				if (this.state === WorkerState.STARTING) {
					reject(err);
				}
			});
		});
	}

	/**
	 * Push a task to the worker
	 *
	 * Runs on: Main
	 *
	 * @param task Task to push
	 */
	public startTask(task: Task<TIn, TOut>): void {
		this.state = WorkerState.WORKING;
		this.task = task;
		this.thread.postMessage({
			type: ParentMessageTypes.START_TASK,
			data: task.request
		});
	}

	/**
	 * Runs when the worker completes a task
	 *
	 * Runs on: Main
	 *
	 * @param response Response from the worker for this task
	 */
	protected finished(response?: TOut): void {
		this.state = WorkerState.FREE;

		if (this.task?.accept) {
			this.task.accept(response);
		}
	}

	/**
	 * Runs when the worker fails to complete a task
	 *
	 * Runs on: Main
	 *
	 * @param error Response from the worker
	 */
	protected failed(error?: Error): void {
		this.state = WorkerState.FREE;

		if (this.task?.reject) {
			this.task.reject(error);
		}
	}

	/**
	 * Runs when the worker errors or exits unexpectedly
	 *
	 * Runs on: Main
	 *
	 * @param error Error returned by the worker
	 */
	protected exhausted(error?: Error): void {
		this.state = WorkerState.EXHAUSTED;

		if (this.task?.reject) {
			this.task.reject(error);
		}
	}
}
