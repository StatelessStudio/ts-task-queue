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

// Static attempt tracking in worker-local storage
const workerAttempts: Record<string, number> = {};

export const retriableQueue = new Queue<AddIn, number>({
	name: 'retriable',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 1,
	maxAttempts: 3,
	callback: async (data) => {
		const key = `${data.a}-${data.b}`;
		workerAttempts[key] = (workerAttempts[key] ?? 0) + 1;

		// Fail on first attempt, succeed on retry
		if (workerAttempts[key] === 1) {
			throw new Error('First attempt fails');
		}

		return data.a + data.b;
	}
});

export const alwaysFailingRetriableQueue = new Queue<AddIn, number>({
	name: 'always-fail-retriable',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 1,
	maxAttempts: 2,
	callback: async (data) => {
		throw new Error('Always fails!');
	}
});
