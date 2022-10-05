import 'jasmine';
import { env } from '../../src/environment';

describe('Environment', () => {
	it('can load', () => {
		expect(env).toBeDefined();
	});
});
