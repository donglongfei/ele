/**
 * Cron Background Service - Handles OpenClaw queries without requiring UI
 * 
 * NOTE: This file is currently disabled due to SDK import issues.
 * The plugin will use fallback to active tab instead.
 */

import type { CronJobRealtimeLog } from './types';

// Stub implementation - background service disabled
export class CronBackgroundService {
  constructor() {
    console.log('[CronBackgroundService] Disabled - using fallback to active tab');
  }

  async initialize(): Promise<void> {
    // No-op
  }

  isServiceReady(): boolean {
    return false;
  }

  async query(): Promise<string> {
    throw new Error('Background service disabled - please open Ele view');
  }

  cleanup(): void {
    // No-op
  }
}
