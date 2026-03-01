import 'jasmine';
import {
	addQueue,
	alwaysFailingQueue,
	sometimesFailingQueue,
	workerExhaustedQueue,
	retriableQueue,
	alwaysFailingRetriableQueue,
	delayedRetryQueue,
	multiDelayedRetryQueue
} from '../queues/queues';

describe('queue', () => {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

	it('can offload a task', async () => {
		const result = await addQueue.await({ data: { a: 5, b: 10 } });

		expect(result).toBe(15);
	});

	it('can run multiple tasks simultaneously', async () => {
		const promises = [];
		const func = addQueue.await({ data: { a: 5, b: 10 } });

		for (let i = 0; i < 100; i++) {
			promises.push(func);

		}

		const result = await Promise.all(promises);

		expect(Array.isArray(result)).toBeTrue();
		expect(result.length).toBeTruthy();
		expect(result[0]).toBe(15);
	});

	it('can allot new workers if a task fails', async () => {
		// First one fails (due to 867)
		await sometimesFailingQueue.await({ data: { a: 867, b: 10 } })
			.catch(err => undefined);

		// Second should succeed
		const result = await sometimesFailingQueue.await(
			{ data: { a: 5, b: 10 } }
		);

		expect(result).toBe(15);
	});

	it('throws an error on await failure', async () => {
		await expectAsync(alwaysFailingQueue.await({ data: { a: 5, b: 10 } }))
			.toBeRejected();
	});

	it('throws an error on worker exhaustion', async () => {
		await expectAsync(workerExhaustedQueue.await({ data: { a: 5, b: 10 } }))
			.toBeRejected();
	});

	it('can push a task', async () => {
		addQueue.push({ data: { a: 5, b: 10 } });
	});

	it('rejects tasks that have expired', (done) => {
		const expiredTask = {
			data: { a: 5, b: 10 },
			schedule: {
				scheduledAt: new Date(Date.now() - 5000),
				expiresAt: new Date(Date.now() - 1000)
			}
		};

		addQueue.await(expiredTask)
			.then(() => {
				done.fail('Task should have been rejected');
			})
			.catch(error => {
				expect(error.message).toBe('Task expired');
				done();
			});
	});

	it('retries a task on failure with maxAttempts', async () => {
		// This task fails on first attempt but succeeds on retry
		// Without retry support, this would fail
		const result = await retriableQueue.await({ data: { a: 100, b: 200 } });

		expect(result).toBe(300);
	});

	it('exhausts maxAttempts and rejects on final failure', async () => {
		// This task always fails, so it will be retried until maxAttempts
		// is reached. With maxAttempts: 2, it should fail after 2 attempts
		await expectAsync(
			alwaysFailingRetriableQueue.await({ data: { a: 5, b: 10 } })
		).toBeRejected();
	});

	it('retries a task with delay between attempts', async () => {
		const startTime = Date.now();

		// Task fails on first attempt, succeeds on retry
		const result = await delayedRetryQueue.await(
			{ data: { a: 50, b: 75 } }
		);

		const elapsedTime = Date.now() - startTime;

		expect(result).toBe(125);

		// With retryDelayMs: 250, total time should be at least 250ms
		expect(elapsedTime).toBeGreaterThanOrEqual(250);
	});

	it('retries multiple times with delay between each attempt', async () => {
		const startTime = Date.now();

		// Task fails on first 2 attempts, succeeds on 3rd
		const result = await multiDelayedRetryQueue.await(
			{ data: { a: 10, b: 20 } }
		);

		const elapsedTime = Date.now() - startTime;

		expect(result).toBe(30);

		// With retryDelayMs: 250 and 2 retries, minimum expected time is ~500ms
		expect(elapsedTime).toBeGreaterThanOrEqual(500);
	});

	it('applies retry delay to task scheduling', async () => {
		const startTime = Date.now();

		const result = await delayedRetryQueue.await(
			{ data: { a: 75, b: 100 } }
		);

		const elapsedTime = Date.now() - startTime;

		expect(result).toBe(175);

		// Total duration should include at least one retry delay (250ms)
		expect(elapsedTime).toBeGreaterThanOrEqual(250);
	});
});
