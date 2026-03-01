/* eslint-disable @typescript-eslint/no-explicit-any */

import 'jasmine';
import { QueueDispatcher, DispatcherConfig } from '../../src/queue-dispatcher';
import { InMemoryTaskPersistence } from '../../src/task-persistence';
import { Task } from '../../src/task';
import { Worker } from '../../src/worker';

describe('QueueDispatcher', function() {
	let dispatcher: QueueDispatcher<number, number>;
	let config: DispatcherConfig<number, number>;
	let tasks: InMemoryTaskPersistence<number, number>;

	beforeEach(function() {
		tasks = new InMemoryTaskPersistence();

		config = {
			name: 'test-queue',
			workerEntry: './test/queues/worker-index.js',
			nWorkers: 2,
			workerType: Worker,
			error: () => undefined,
			options: {
				name: 'test-queue',
				callback: async (data: number) => data * 2,
				pollingRate: 100,
				maxAttempts: 1,
				retryDelayMs: 0,
			} as any,
		};
	});

	describe('constructor', function() {
		it('should create a dispatcher with provided config', function() {
			dispatcher = new QueueDispatcher(tasks, config);
			expect(dispatcher).toBeTruthy();
		});

		it('should store tasks and config', function() {
			dispatcher = new QueueDispatcher(tasks, config);
			expect((dispatcher as any).tasks).toBe(tasks);
			expect((dispatcher as any).config).toBe(config);
		});

		it('should not initialize pool in constructor', function() {
			dispatcher = new QueueDispatcher(tasks, config);
			expect((dispatcher as any).pool).toBeUndefined();
		});
	});

	describe('start', function() {
		it('should throw error if not initialized', function() {
			dispatcher = new QueueDispatcher(tasks, config);

			expect(() => dispatcher.start()).toThrowError(
				'Dispatcher not initialized. Call initialize() first.'
			);
		});
	});

	describe('applyRetryHandler', function() {
		it('should re-enqueue task on failure if attempts remain', function() {
			dispatcher = new QueueDispatcher(tasks, config);
			config.options.maxAttempts = 3;

			const originalReject = jasmine.createSpy('originalReject');
			const taskToRetry: Task<number, number> = {
				data: 5,
				attempts: 0,
				reject: originalReject,
				accept: undefined,
			};

			(dispatcher as any).applyRetryHandler(taskToRetry);

			// Simulate task rejection
			const newReject = taskToRetry.reject as any as (err: Error) => void;
			newReject(new Error('Task failed'));

			// Should re-enqueue, so size should be 1
			expect(tasks.size()).toBe(1);
		});

		it('should call original reject when maxAttempts exceeded', function() {
			dispatcher = new QueueDispatcher(tasks, config);
			config.options.maxAttempts = 2;

			const originalReject = jasmine.createSpy('originalReject');
			const taskAtMax: Task<number, number> = {
				data: 5,
				attempts: 1,
				reject: originalReject,
				accept: undefined,
			};

			(dispatcher as any).applyRetryHandler(taskAtMax);

			const newReject = taskAtMax.reject as any as (err: Error) => void;
			const error = new Error('Task failed');
			newReject(error);

			expect(originalReject).toHaveBeenCalledWith(error);
		});

		it('should add retry delay if retryDelayMs is set', function() {
			dispatcher = new QueueDispatcher(tasks, config);
			config.options.maxAttempts = 3;
			config.options.retryDelayMs = 1000;

			const taskWithDelay: Task<number, number> = {
				data: 5,
				attempts: 0,
				reject: jasmine.createSpy('reject'),
				accept: undefined,
			};

			(dispatcher as any).applyRetryHandler(taskWithDelay);

			const newReject = taskWithDelay.reject as any as (
				err: Error
			) => void;
			newReject(new Error('failed'));

			// Task should be re-enqueued with schedule
			const initialSize = tasks.size();
			expect(initialSize).toBe(1);

			// Get the enqueued task (don't use dequeue as it
			// filters by ready status)
			const allTasks = (tasks as any).tasks;
			expect(allTasks.length).toBe(1);
			const reenqueued = allTasks[0];
			expect(reenqueued.schedule?.scheduledAt).toBeTruthy();
			const delay =
				(reenqueued.schedule?.scheduledAt?.getTime() ?? 0) - Date.now();
			expect(delay).toBeGreaterThan(900);
			expect(delay).toBeLessThan(1100);
		});
	});

	describe('isTaskExpired', function() {
		it('should return false if no expiration is set', function() {
			dispatcher = new QueueDispatcher(tasks, config);

			const taskWithoutExpiry: Task<number, number> = {
				data: 5,
			};

			expect((dispatcher as any).isTaskExpired(taskWithoutExpiry))
				.toBeFalse();
		});

		it('should return false if task has not expired', function() {
			dispatcher = new QueueDispatcher(tasks, config);

			const taskNotExpired: Task<number, number> = {
				data: 5,
				schedule: {
					scheduledAt: new Date(),
					expiresAt: new Date(Date.now() + 10000),
				},
			};

			expect((dispatcher as any).isTaskExpired(taskNotExpired))
				.toBeFalse();
		});

		it('should return true if task has expired', function() {
			dispatcher = new QueueDispatcher(tasks, config);

			const taskExpired: Task<number, number> = {
				data: 5,
				schedule: {
					scheduledAt: new Date(),
					expiresAt: new Date(Date.now() - 1000),
				},
			};

			expect((dispatcher as any).isTaskExpired(taskExpired)).toBeTrue();
		});
	});
});
