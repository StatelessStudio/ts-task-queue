/**
 * Interface for a task
 */
export interface Task<TIn, TOut> {
	request: TIn;
	accept?: (response?: TOut) => void,
	reject?: (error?: Error) => void,
}
