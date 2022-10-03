/* eslint-disable no-console */
import { env } from '../src/environment';

/**
 * Do something!
 */
export async function example(): Promise<void> {
	console.log('Environment: ', env.NODE_ENV);
}

example().catch(console.error);
