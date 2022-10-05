import { Queue } from '../src';
import { log } from './log';
import { timeFibonacci } from './fibonacci';

/**
 * Worker threads
 */
export const fibonacciQueue = new Queue<number, number>({
	name: 'fibonacci',
	workerEntry: __dirname,
	nWorkers: 4,
	callback: async (num) => timeFibonacci(num),
});
