import { parentPort } from 'worker_threads';

/**
 * Messages sent from worker
 */
export enum WorkerMessageTypes {
	STARTED = 'STARTED',
	TASK_FINISHED = 'TASK_FINISHED',
	TASK_FAILED = 'TASK_FAILED',
}

/**
 * Message interface from worker
 */
export interface WorkerMessage {
	message: WorkerMessageTypes;
	data?: any;
}

export class ParentThread {
	/**
	 * Post that the worker started up successfully to the main thread
	 *
	 * Runs on: Worker
	 */
	public workerStarted() {
		this.post({ message: WorkerMessageTypes.STARTED });
	}

	/**
	 * Post that the worker finished a task successfully
	 *
	 * Runs on: Worker
	 *
	 * @param response Task response
	 */
	public taskFinished(response?: any) {
		this.post({
			message: WorkerMessageTypes.TASK_FINISHED,
			data: response
		});
	}

	/**
	 * Post that the worker failed to complete a task
	 *
	 * Runs on: Worker
	 *
	 * @param response Task response
	 */
	public taskFailed(error?: Error) {
		this.post({
			message: WorkerMessageTypes.TASK_FAILED,
			data: error,
		});
	}

	/**
	 * Post a message to the main thread
	 *
	 * Runs on: Worker
	 *
	 * @param msg
	 */
	protected post(msg: WorkerMessage) {
		parentPort.postMessage(msg);
	}
}
