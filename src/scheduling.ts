/**
 * Schedule configuration for a task
 */
export interface ScheduleConfig {
	/**
	 * Date/time when to execute the task
	 */
	scheduledAt: Date;

	/**
	 * Expiration date/time
	 */
	expiresAt?: Date;
}
