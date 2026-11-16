import { Worker as Thread } from 'worker_threads';
import { setTimeout } from 'timers';

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

export interface TaskTimeoutInfo {
	taskId: string;
	timeoutId: NodeJS.Timeout;
}

export class Worker<TIn, TOut> {
	public state: WorkerState = WorkerState.STARTING;

	protected thread: Thread;
	protected id: number;
	protected task: Task<TIn, TOut>;
	protected timeoutInfo: TaskTimeoutInfo | null = null;

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
				else if (response.message === WorkerMessageTypes.TASK_TIMED_OUT) {
					this.timedOut(response.data);
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
	 * @param timeoutMs Optional timeout in milliseconds for this task
	 */
	public startTask(task: Task<TIn, TOut>, timeoutMs?: number): void {
		this.state = WorkerState.WORKING;
		this.task = task;

		// Start timeout tracking if timeout is specified
		if (timeoutMs && timeoutMs > 0) {
			const taskId = this.generateTaskId();
			const timeoutId = setTimeout(() => {
				// Check if this task is still running (not finished/failed yet)
				if (this.state === WorkerState.WORKING && this.task === task) {
					// Send timeout message to self
					this.thread.postMessage({
						type: 'INTERNAL_TIMEOUT',
						taskId: taskId
					});
				}
			}, timeoutMs);

			this.timeoutInfo = {
				taskId: taskId,
				timeoutId: timeoutId
			};
		}

		this.thread.postMessage({
			type: ParentMessageTypes.START_TASK,
			data: task.data
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
		// Clear any pending timeout
		if (this.timeoutInfo) {
			clearTimeout(this.timeoutInfo.timeoutId);
			this.timeoutInfo = null;
		}

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
		// Clear any pending timeout
		if (this.timeoutInfo) {
			clearTimeout(this.timeoutInfo.timeoutId);
			this.timeoutInfo = null;
		}

		this.state = WorkerState.FREE;

		if (this.task?.reject) {
			this.task.reject(error);
		}
	}

	/**
	 * Runs when the worker times out on a task
	 *
	 * Runs on: Main
	 *
	 * @param error Response from the worker
	 */
	protected timedOut(error?: Error): void {
		// Clear any pending timeout
		if (this.timeoutInfo) {
			clearTimeout(this.timeoutInfo.timeoutId);
			this.timeoutInfo = null;
		}

		// Try to reject the task with timeout error
		if (this.task?.reject) {
			const timeoutError = error || new Error('Task timed out');
			// Check if task is still marked as working
			if (this.state === WorkerState.WORKING) {
				this.state = WorkerState.FREE;
			}
			this.task.reject(timeoutError);
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
		// Clear any pending timeout
		if (this.timeoutInfo) {
			clearTimeout(this.timeoutInfo.timeoutId);
			this.timeoutInfo = null;
		}

		this.state = WorkerState.EXHAUSTED;

		if (this.task?.reject) {
			this.task.reject(error);
		}
	}

	/**
	 * Generate a unique task ID for timeout tracking
	 *
	 * @returns Unique task ID
	 */
	protected generateTaskId(): string {
		return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}
}
