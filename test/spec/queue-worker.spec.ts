/* eslint-disable @typescript-eslint/no-explicit-any */

import 'jasmine';
import { QueueWorker, WorkerConfig } from '../../src/queue-worker';
import { ParentThread } from '../../src/parent';
import { WorkerSpawnData } from '../../src/worker';

/**
 * Mock ParentThread for testing
 */
class MockParentThread extends ParentThread {
	workerStartedCalled = false;

	workerStarted(): void {
		this.workerStartedCalled = true;
	}

	taskFinished(): void {
		// Mock implementation
	}

	taskFailed(): void {
		// Mock implementation
	}
}

describe('QueueWorker', function() {
	let worker: QueueWorker<number, number>;
	let config: WorkerConfig<number, number>;

	beforeEach(function() {
		config = {
			startup: async () => {
			},
			callback: async (data: number) => {
				return data * 2;
			},
			error: () => undefined,
			parentType: MockParentThread as any,
		};
	});

	describe('constructor', function() {
		it('should create a worker with provided config', function() {
			worker = new QueueWorker(config);
			expect(worker).toBeTruthy();
		});

		it('should store the config', function() {
			worker = new QueueWorker(config);
			expect((worker as any).config).toBe(config);
		});

		it('should create parent instance', function() {
			worker = new QueueWorker(config);
			expect((worker as any).parent).toBeTruthy();
		});
	});

	describe('config', function() {
		it('should have all required config properties', function() {
			worker = new QueueWorker(config);
			expect(config.startup).toBeDefined();
			expect(config.callback).toBeDefined();
			expect(config.parentType).toBeDefined();
		});
	});
});
