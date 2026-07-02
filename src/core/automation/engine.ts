import { EventEmitter } from 'events';

export class AutomationEngine extends EventEmitter {
  private static instance: AutomationEngine;
  private running: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private intervalMs: number = 1000; // Poll every 1s by default

  private constructor() {
    super();
  }

  public static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine();
    }
    return AutomationEngine.instance;
  }

  public start() {
    if (this.running) return;
    this.running = true;
    console.log('Automation Engine started.');
    
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  public stop() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Automation Engine stopped.');
  }

  private async tick() {
    // 1. Fetch active rules from DB
    // 2. Evaluate conditions
    // 3. Execute actions
    // console.log('Automation tick...'); // Commented out to avoid spam
    
    // Example: Check for expiring credits
    this.checkExpiry();
  }

  private checkExpiry() {
    // Logic to check inventory expiry
  }
}

