import { ScheduleConfig } from './scheduling';

/**
 * Interface for a task
 */
export interface Task<TIn, TOut> {
	data: TIn;
	accept?: (response?: TOut) => void,
	reject?: (error?: Error) => void,
	schedule?: ScheduleConfig;
}
