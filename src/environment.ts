import { AppConfig, configure } from 'ts-appconfig';

/**
 * Environment Variables Schema
 */
export class Environment extends AppConfig {
}

/**
 * Load & export environment variables
 */
export const env: Environment = configure(Environment);
