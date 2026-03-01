import 'jasmine';
import {
	addQueue,
	alwaysFailingQueue,
	sometimesFailingQueue,
	workerExhaustedQueue
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
			.catch(err => {
				expect(err.message).toBe('Task expired');
				done();
			});
	});
});
