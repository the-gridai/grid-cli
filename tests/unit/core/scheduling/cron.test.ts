import { CronScheduler, validateCronExpression, getScheduler } from '../../../../src/core/scheduling';

describe('validateCronExpression', () => {
  it('should return true for valid cron expressions', () => {
    expect(validateCronExpression('* * * * *')).toBe(true);
    expect(validateCronExpression('0 * * * *')).toBe(true);
    expect(validateCronExpression('0 0 * * *')).toBe(true);
    expect(validateCronExpression('0 9,17 * * *')).toBe(true);
    expect(validateCronExpression('0 0 1 * *')).toBe(true);
    expect(validateCronExpression('0 0 * * 0')).toBe(true);
  });

  it('should return false for invalid cron expressions', () => {
    expect(validateCronExpression('')).toBe(false);
    expect(validateCronExpression('invalid')).toBe(false);
    expect(validateCronExpression('* * *')).toBe(false);
    expect(validateCronExpression('60 * * * *')).toBe(false);
    expect(validateCronExpression('* 25 * * *')).toBe(false);
  });
});

describe('CronScheduler', () => {
  let scheduler: CronScheduler;

  beforeEach(() => {
    scheduler = new CronScheduler();
  });

  afterEach(() => {
    scheduler.stopAll();
  });

  describe('schedule', () => {
    it('should schedule a valid cron job', () => {
      const mockTask = jest.fn().mockResolvedValue(undefined);
      
      scheduler.schedule({
        name: 'test-job',
        schedule: '* * * * *',
        task: mockTask,
      });

      expect(scheduler.isRunning('test-job')).toBe(true);
      expect(scheduler.getJobCount()).toBe(1);
    });

    it('should throw error for invalid cron expression', () => {
      const mockTask = jest.fn().mockResolvedValue(undefined);
      
      expect(() => {
        scheduler.schedule({
          name: 'invalid-job',
          schedule: 'invalid',
          task: mockTask,
        });
      }).toThrow('Invalid cron expression');
    });

    it('should throw error for duplicate job name', () => {
      const mockTask = jest.fn().mockResolvedValue(undefined);
      
      scheduler.schedule({
        name: 'duplicate-job',
        schedule: '* * * * *',
        task: mockTask,
      });

      expect(() => {
        scheduler.schedule({
          name: 'duplicate-job',
          schedule: '* * * * *',
          task: mockTask,
        });
      }).toThrow('Job with name "duplicate-job" already exists');
    });
  });

  describe('stop', () => {
    it('should stop a running job', () => {
      const mockTask = jest.fn().mockResolvedValue(undefined);
      
      scheduler.schedule({
        name: 'stop-test',
        schedule: '* * * * *',
        task: mockTask,
      });

      expect(scheduler.isRunning('stop-test')).toBe(true);
      
      scheduler.stop('stop-test');
      
      expect(scheduler.isRunning('stop-test')).toBe(false);
    });

    it('should handle stopping non-existent job gracefully', () => {
      expect(() => scheduler.stop('non-existent')).not.toThrow();
    });
  });

  describe('stopAll', () => {
    it('should stop all running jobs', () => {
      const mockTask = jest.fn().mockResolvedValue(undefined);
      
      scheduler.schedule({ name: 'job-1', schedule: '* * * * *', task: mockTask });
      scheduler.schedule({ name: 'job-2', schedule: '* * * * *', task: mockTask });
      scheduler.schedule({ name: 'job-3', schedule: '* * * * *', task: mockTask });

      expect(scheduler.getJobCount()).toBe(3);
      
      scheduler.stopAll();
      
      expect(scheduler.getJobCount()).toBe(0);
    });
  });

  describe('getScheduledJobs', () => {
    it('should return list of scheduled job names', () => {
      const mockTask = jest.fn().mockResolvedValue(undefined);
      
      scheduler.schedule({ name: 'job-a', schedule: '* * * * *', task: mockTask });
      scheduler.schedule({ name: 'job-b', schedule: '* * * * *', task: mockTask });

      const jobs = scheduler.getScheduledJobs();
      
      expect(jobs).toContain('job-a');
      expect(jobs).toContain('job-b');
      expect(jobs.length).toBe(2);
    });
  });
});

describe('getScheduler', () => {
  it('should return singleton instance', () => {
    const scheduler1 = getScheduler();
    const scheduler2 = getScheduler();
    
    expect(scheduler1).toBe(scheduler2);
  });
});
