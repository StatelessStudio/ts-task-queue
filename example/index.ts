import { timeFibonacci } from './fibonacci';
import { log } from './log';
import { fibonacciQueue } from './queue';

if (fibonacciQueue.isMainThread()) {
	log.info('Starting main thread...');

	const n = 30;

	// Run a single fib on the main thread as a control
	log.info('main thread took', timeFibonacci(n));

	const start = Date.now();

	const p1 = fibonacciQueue.await(n)
		.then((res: number) => log.info('First worker complete in (ms)', res))
		.catch(log.error);

	const p2 = fibonacciQueue.await(n)
		.then((res: number) => log.info('Second worker complete in (ms)', res))
		.catch(log.error);

	const p3 = fibonacciQueue.await(n)
		.then((res: number) => log.info('Third worker complete in (ms)', res))
		.catch(log.error);

	Promise.all([p1, p2, p3])
		.then(() => {
			const time = Date.now() - start;
			log.info('All took (ms) ' + time);
		})
		.catch(log.error);
}
