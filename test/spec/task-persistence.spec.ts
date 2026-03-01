import 'jasmine';
import { InMemoryTaskPersistence } from '../../src/task-persistence';
import { Task } from '../../src/task';

describe('InMemoryTaskPersistence', () => {
	let persistence: InMemoryTaskPersistence<number, number>;

	beforeEach(() => {
		persistence = new InMemoryTaskPersistence();
	});

	describe('scheduledAt feature', () => {
		it('should dequeue a task without schedule immediately', () => {
			const task: Task<number, number> = {
				data: 42
			};

			persistence.enqueue(task);
			const dequeuedTask = persistence.dequeue();

			expect(dequeuedTask).toBe(task);
		});

		it('should dequeue when scheduledAt time has passed', () => {
			// 1 second ago
			const pastDate = new Date(Date.now() - 1000);
			const task: Task<number, number> = {
				data: 42,
				schedule: {
					scheduledAt: pastDate
				}
			};

			persistence.enqueue(task);
			const dequeuedTask = persistence.dequeue();

			expect(dequeuedTask).toBe(task);
		});

		it('should dequeue a task when scheduledAt time is now', () => {
			const task: Task<number, number> = {
				data: 42,
				schedule: {
					scheduledAt: new Date()
				}
			};

			persistence.enqueue(task);
			const dequeuedTask = persistence.dequeue();

			expect(dequeuedTask).toBe(task);
		});

		it('should not dequeue when scheduledAt in future', () => {
			// 10 seconds in future
			const futureDate = new Date(Date.now() + 10000);
			const task: Task<number, number> = {
				data: 42,
				schedule: {
					scheduledAt: futureDate
				}
			};

			persistence.enqueue(task);
			const dequeuedTask = persistence.dequeue();

			expect(dequeuedTask).toBeUndefined();
			expect(persistence.size()).toBe(1);
		});

		it('should skip future tasks and dequeue ready tasks', async () => {
			// 10 seconds in future
			const futureDate = new Date(Date.now() + 10000);
			// 1 second ago
			const pastDate = new Date(Date.now() - 1000);

			const futureTask: Task<number, number> = {
				data: 1,
				schedule: {
					scheduledAt: futureDate
				}
			};

			const readyTask: Task<number, number> = {
				data: 2,
				schedule: {
					scheduledAt: pastDate
				}
			};

			persistence.enqueue(futureTask);
			persistence.enqueue(readyTask);

			const dequeuedTask = persistence.dequeue();

			expect(dequeuedTask).toBe(readyTask);
			expect(persistence.size()).toBe(1);
			// Future task will be ready later
			expect(persistence.dequeue()).toBeUndefined();

			await new Promise<void>(resolve => {
				setTimeout(() => resolve(), 10000);
			});

			expect(persistence.dequeue()).toBe(futureTask);
			expect(persistence.size()).toBe(0);
		});

		it('should handle multiple tasks with different schedules', () => {
			const tasks = [
				{
					data: 1,
					schedule: {
						scheduledAt: new Date(Date.now() + 5000) // Future
					}
				},
				{
					data: 2,
					schedule: {
						scheduledAt: new Date(Date.now() - 1000) // Past
					}
				},
				{
					data: 3
					// No schedule
				},
				{
					data: 4,
					schedule: {
						scheduledAt: new Date(Date.now() + 2000) // Future
					}
				}
			];

			tasks.forEach(task => persistence.enqueue(task));

			// Should dequeue task with data 2 (past schedule) first
			let dequeuedTask = persistence.dequeue();
			expect(dequeuedTask?.data).toBe(2);

			// Should dequeue task with data 3 (no schedule) next
			dequeuedTask = persistence.dequeue();
			expect(dequeuedTask?.data).toBe(3);

			// Should not dequeue tasks 1 and 4 (future schedules)
			dequeuedTask = persistence.dequeue();
			expect(dequeuedTask).toBeUndefined();

			expect(persistence.size()).toBe(2);
		});

		it('should eventually allow dequeuing when scheduled ' +
			'time passes', (done) => {
			// 500ms in future
			const scheduledDate = new Date(Date.now() + 500);
			const task: Task<number, number> = {
				data: 42,
				schedule: {
					scheduledAt: scheduledDate
				}
			};

			persistence.enqueue(task);

			// Try to dequeue immediately (should fail)
			let dequeuedTask = persistence.dequeue();
			expect(dequeuedTask).toBeUndefined();

			// Wait for the scheduled time to pass
			setTimeout(() => {
				dequeuedTask = persistence.dequeue();
				expect(dequeuedTask).toBe(task);
				done();
			}, 600);
		});

		it('should handle edge case with scheduledAt at ' +
			'current time', () => {
			const now = new Date();
			const task: Task<number, number> = {
				data: 42,
				schedule: {
					scheduledAt: now
				}
			};

			persistence.enqueue(task);
			const dequeuedTask = persistence.dequeue();

			// Task scheduled at now should be dequeued
			expect(dequeuedTask).toBe(task);
		});
	});

	describe('basic functionality', () => {
		it('should enqueue and dequeue tasks in FIFO order', () => {
			const task1: Task<number, number> = { data: 1 };
			const task2: Task<number, number> = { data: 2 };
			const task3: Task<number, number> = { data: 3 };

			persistence.enqueue(task1);
			persistence.enqueue(task2);
			persistence.enqueue(task3);

			expect(persistence.dequeue()).toBe(task1);
			expect(persistence.dequeue()).toBe(task2);
			expect(persistence.dequeue()).toBe(task3);
		});

		it('should return undefined when dequeueing from ' +
			'empty persistence', () => {
			const dequeuedTask = persistence.dequeue();
			expect(dequeuedTask).toBeUndefined();
		});

		it('should correctly return size', () => {
			expect(persistence.size()).toBe(0);

			persistence.enqueue({ data: 1 });
			expect(persistence.size()).toBe(1);

			persistence.enqueue({ data: 2 });
			expect(persistence.size()).toBe(2);

			persistence.dequeue();
			expect(persistence.size()).toBe(1);
		});

		it('should clear all tasks', () => {
			persistence.enqueue({ data: 1 });
			persistence.enqueue({ data: 2 });
			persistence.enqueue({ data: 3 });

			expect(persistence.size()).toBe(3);

			persistence.clear();

			expect(persistence.size()).toBe(0);
			expect(persistence.dequeue()).toBeUndefined();
		});
	});
});
