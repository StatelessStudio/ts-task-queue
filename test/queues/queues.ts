import { Queue } from '../../src';

export interface AddIn {
	a: number;
	b: number;
}

export const addQueue = new Queue<AddIn, number>({
	name: 'add',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 4,
	callback: async (data) => data.a + data.b,
});

export const sometimesFailingQueue = new Queue<AddIn, number>({
	name: 'sometimes-fail',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 1,
	callback: async (data) => {
		if (data.a === 867) {
			throw new Error('Fails on 867!');
		}
		else {
			return data.a + data.b;
		}
	}
});

export const alwaysFailingQueue = new Queue<AddIn, number>({
	name: 'always-fail',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 4,
	callback: async (data) => {
		throw new Error('Always fails!');
	}
});

export const workerExhaustedQueue = new Queue<AddIn, number>({
	name: 'worker-exhausted',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 4,
	callback: async (data) => {
		process.exit(1);
	}
});
