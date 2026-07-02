import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../logging/logger';

/**
 * Configuration for a cron job
 */
export interface CronJob {
  /** Cron expression (e.g., "0 * * * *" for hourly) */
  schedule: string;
  /** Async function to execute on each tick */
  task: () => Promise<void>;
  /** Unique name for the job (used for logging and management) */
  name: string;
}

/**
 * Validates a cron expression
 * @param expression - The cron expression to validate
 * @returns true if valid, false otherwise
 */
export function validateCronExpression(expression: string): boolean {
  return cron.validate(expression);
}

/**
 * Cron scheduler for managing scheduled tasks
 * 
 * Common cron patterns:
 *   "* * * * *"     - Every minute
 *   "0/30 * * * *"  - Every 30 minutes
 *   "0 * * * *"     - Every hour (at minute 0)
 *   "0 9,17 * * *"  - At 9am and 5pm daily
 *   "0 0 * * *"     - Daily at midnight
 */
export class CronScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();

  /**
   * Schedule a new cron job
   * @param job - The job configuration
   * @throws Error if the cron expression is invalid or job name already exists
   */
  schedule(job: CronJob): void {
    if (this.tasks.has(job.name)) {
      throw new Error(`Job with name "${job.name}" already exists`);
    }

    if (!validateCronExpression(job.schedule)) {
      throw new Error(`Invalid cron expression: "${job.schedule}"`);
    }

    logger.info(`Scheduling cron job: ${job.name}`, { schedule: job.schedule });

    const task = cron.schedule(job.schedule, async () => {
      const startTime = Date.now();
      logger.info(`Cron job started: ${job.name}`);
      
      try {
        await job.task();
        const duration = Date.now() - startTime;
        logger.info(`Cron job completed: ${job.name}`, { durationMs: duration });
      } catch (error) {
        logger.error(`Cron job failed: ${job.name}`, { error });
      }
    }, {
      timezone: 'UTC'
    } as any);

    this.tasks.set(job.name, task);
    console.log(`[Cron] Scheduled "${job.name}" with pattern: ${job.schedule}`);
  }

  /**
   * Stop a specific cron job
   * @param name - The name of the job to stop
   */
  stop(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.stop();
      this.tasks.delete(name);
      logger.info(`Cron job stopped: ${name}`);
      console.log(`[Cron] Stopped "${name}"`);
    }
  }

  /**
   * Stop all cron jobs
   */
  stopAll(): void {
    const entries = Array.from(this.tasks.entries());
    for (const [name, task] of entries) {
      task.stop();
      logger.info(`Cron job stopped: ${name}`);
    }
    const count = this.tasks.size;
    this.tasks.clear();
    console.log(`[Cron] Stopped all jobs (${count} total)`);
  }

  /**
   * Check if a job is currently scheduled
   * @param name - The name of the job to check
   * @returns true if the job is running, false otherwise
   */
  isRunning(name: string): boolean {
    return this.tasks.has(name);
  }

  /**
   * Get the list of all scheduled job names
   * @returns Array of job names
   */
  getScheduledJobs(): string[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * Get the number of scheduled jobs
   * @returns Number of active jobs
   */
  getJobCount(): number {
    return this.tasks.size;
  }
}

// Singleton instance for global access
let globalScheduler: CronScheduler | null = null;

/**
 * Get the global cron scheduler instance
 * @returns The singleton CronScheduler instance
 */
export function getScheduler(): CronScheduler {
  if (!globalScheduler) {
    globalScheduler = new CronScheduler();
  }
  return globalScheduler;
}
