import { Queue } from '../../src';

export interface AddIn {
	a: number;
	b: number;
}

const pollingRate = 10;

export const addQueue = new Queue<AddIn, number>({
	name: 'add',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 4,
	pollingRate,
	callback: async (data) => data.a + data.b,
});

export const sometimesFailingQueue = new Queue<AddIn, number>({
	name: 'sometimes-fail',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 1,
	pollingRate,
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
	pollingRate,
	callback: async (data) => {
		throw new Error('Always fails!');
	}
});

export const workerExhaustedQueue = new Queue<AddIn, number>({
	name: 'worker-exhausted',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 4,
	pollingRate,
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
	pollingRate,
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
	pollingRate,
	callback: async (data) => {
		throw new Error('Always fails!');
	}
});

// Track attempt counts for delayed retry queue
const delayedRetryAttempts: Record<string, number> = {};

export const delayedRetryQueue = new Queue<AddIn, number>({
	name: 'delayed-retry',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 1,
	maxAttempts: 3,
	retryDelayMs: 250,
	pollingRate,
	callback: async (data) => {
		const key = `${data.a}-${data.b}`;
		const attemptNumber = (delayedRetryAttempts[key] ?? 0) + 1;
		delayedRetryAttempts[key] = attemptNumber;

		// Fail on first attempt, succeed on retry
		if (attemptNumber === 1) {
			throw new Error('First attempt fails');
		}

		return data.a + data.b;
	}
});

// Track attempt counts for multi-delayed retry queue
const multiDelayAttempts: Record<string, number> = {};

export const multiDelayedRetryQueue = new Queue<AddIn, number>({
	name: 'multi-delayed-retry',
	workerEntry: __dirname + '/worker-index.js',
	nWorkers: 1,
	maxAttempts: 4,
	retryDelayMs: 250,
	pollingRate,
	callback: async (data) => {
		const key = `${data.a}-${data.b}`;
		const attemptNumber = (multiDelayAttempts[key] ?? 0) + 1;
		multiDelayAttempts[key] = attemptNumber;

		// Fail on first 2 attempts, succeed on 3rd
		if (attemptNumber <= 2) {
			throw new Error(`Attempt ${attemptNumber} fails`);
		}

		return data.a + data.b;
	}
});
