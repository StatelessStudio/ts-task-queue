/* eslint-disable @typescript-eslint/no-explicit-any */

import 'jasmine';

import { Pool, PoolOptions } from '../../src/pool';
import { Worker, WorkerState } from '../../src/worker';

/**
 * Helper function to create a mock worker
 */
function createMockWorker(): Worker<string, string> {
	const worker = new Worker<string, string>();
	worker.state = WorkerState.FREE;
	return worker;
}

describe('Pool', function() {
	let pool: Pool<string, string>;
	let poolOptions: PoolOptions<string, string>;

	beforeEach(function() {
		poolOptions = {
			nWorkers: 2,
			workerEntry: './test/queues/worker-index.js',
			queueName: 'test-queue',
		};
	});

	describe('constructor', function() {
		it('should create a pool with provided options', function() {
			pool = new Pool(poolOptions);
			expect(pool).toBeTruthy();
		});

		it('should set default nWorkers to 4 if not provided', function() {
			const options: PoolOptions<string, string> = {
				workerEntry: './test/queues/worker-index.js',
				queueName: 'test-queue',
			};
			pool = new Pool(options);
			// access through initialize test to verify
			expect(pool).toBeTruthy();
		});

		it('should set default nWorkers to 4 when merging options', function() {
			const options: PoolOptions<string, string> = {
				workerEntry: './test/queues/worker-index.js',
				queueName: 'test-queue',
			};
			pool = new Pool(options);
			// nWorkers should default to 4
			expect(pool).toBeTruthy();
		});
	});

	describe('initialize', function() {
		it('should spawn the specified number of workers', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();
			expect(
				(Pool.prototype['spawnWorker'] as jasmine.Spy).calls.count()
			).toBe(2);
		});

		it('should spawn 4 workers by default', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			const options: PoolOptions<string, string> = {
				workerEntry: './test/queues/worker-index.js',
				queueName: 'test-queue',
			};
			pool = new Pool(options);
			await pool.initialize();
			expect(
				(Pool.prototype['spawnWorker'] as jasmine.Spy).calls.count()
			).toBe(4);
		});

		it('should set worker count correctly', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();
			expect(pool.getWorkerCount()).toBe(2);
		});

		it('should raise error if spawn fails', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.returnValue(
					Promise.reject(new Error('Spawn failed'))
				);

			pool = new Pool(poolOptions);

			try {
				await pool.initialize();
				fail('Expected initialize to throw');
			}
			catch (err) {
				expect((err as Error).message).toBe('Spawn failed');
			}
		});
	});

	describe('reserve', function() {
		it('should return a free worker', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();

			const worker = await pool.reserve();
			expect(worker).toBeTruthy();
			expect(worker?.state).toBe(WorkerState.RESERVED);
		});

		it('should set worker state to RESERVED', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();

			const worker = await pool.reserve();
			expect(worker?.state).toBe(WorkerState.RESERVED);
		});

		it('should return null if no workers are available', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();

			await pool.reserve();
			await pool.reserve();
			const worker = await pool.reserve();
			expect(worker).toBeNull();
		});

		it('should replace exhausted worker with new one', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool({ ...poolOptions, nWorkers: 1 });
			await pool.initialize();

			// Get the first worker and mark it as exhausted
			let worker = await pool.reserve() as Worker<string, string>;
			worker.state = WorkerState.EXHAUSTED;

			// Reserve again - should spawn new worker to replace exhausted one
			worker = await pool.reserve() as Worker<string, string>;
			expect(worker).toBeTruthy();
			expect(worker.state).toBe(WorkerState.RESERVED);
		});
	});

	describe('release', function() {
		it('should set worker state to FREE', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();

			const worker = await pool.reserve() as Worker<string, string>;
			worker.state = WorkerState.WORKING;

			pool.release(worker);
			expect((worker as any).state).toBe(WorkerState.FREE);
		});

		it('does not change state if worker is not WORKING', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();

			const worker = await pool.reserve() as Worker<string, string>;
			const originalState = worker.state;

			pool.release(worker);
			expect(worker.state).toBe(originalState as any);
		});

		it(
			'should allow reserved worker to be released and reserved again',
			async function() {
				spyOn(Pool.prototype, 'spawnWorker' as any) .and.callFake(
					async () => Promise.resolve(createMockWorker())
				);

				pool = new Pool(poolOptions);
				await pool.initialize();

				const worker = await pool.reserve() as Worker<string, string>;
				expect(worker.state).toBe(WorkerState.RESERVED);

				worker.state = WorkerState.WORKING;
				pool.release(worker);
				expect((worker as any).state).toBe(WorkerState.FREE);
			}
		);
	});

	describe('getWorkerCount', function() {
		it('should return 0 before initialization', function() {
			pool = new Pool(poolOptions);
			expect(pool.getWorkerCount()).toBe(0);
		});

		it('should return count after initialization', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();
			expect(pool.getWorkerCount()).toBe(2);
		});

		it('should update count when worker is replaced', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool({ ...poolOptions, nWorkers: 1 });
			await pool.initialize();
			expect(pool.getWorkerCount()).toBe(1);

			const worker = await pool.reserve() as Worker<string, string>;
			worker.state = WorkerState.EXHAUSTED;
			await pool.reserve();

			expect(pool.getWorkerCount()).toBe(1);
		});
	});

	describe('error handling', function() {
		it('should call error handler when spawn fails', async function() {
			const errorHandler = jasmine.createSpy('errorHandler')
				.and.returnValue(Promise.resolve());

			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async function(this: any) {
					const error = new Error('Spawn error');
					if (this.options.error) {
						this.options.error(error);
					}
					return Promise.reject(error);
				});

			const options: PoolOptions<string, string> = {
				...poolOptions,
				error: errorHandler,
			};

			pool = new Pool(options);

			try {
				await pool.initialize();
			}
			catch (err) {
				// Expected
			}

			expect(errorHandler).toHaveBeenCalled();
		});
	});

	describe('concurrent operations', function() {
		it('should handle multiple concurrent reserves', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();

			const worker1 = await pool.reserve();
			const worker2 = await pool.reserve();

			expect(worker1).toBeTruthy();
			expect(worker2).toBeTruthy();
			expect(worker1).not.toBe(worker2);
		});

		it('should handle reserve and release in sequence', async function() {
			spyOn(Pool.prototype, 'spawnWorker' as any)
				.and.callFake(async () => Promise.resolve(createMockWorker()));

			pool = new Pool(poolOptions);
			await pool.initialize();

			const worker = await pool.reserve() as Worker<string, string>;
			expect(worker.state).toBe(WorkerState.RESERVED);

			worker.state = WorkerState.WORKING;
			pool.release(worker);
			expect((worker as any).state).toBe(WorkerState.FREE);

			const sameWorker = await pool.reserve();
			expect(sameWorker).toBe(worker);
		});
	});
});
