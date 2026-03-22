/**
 * Cron Manager - Core scheduling and job execution.
 */

import { Notice } from 'obsidian';
import { randomUUID } from 'crypto';

import type ElePlugin from '../../main';
import type { CronStorage } from '../storage/CronStorage';
import { getVaultPath } from '../../utils/path';
import { CronExpression, generateCronExpression } from './CronExpression';
import type {
  CronFrequency,
  CronJob,
  CronJobConfig,
  CronJobLog,
  CronJobType,
  FileOperationConfig,
  NotificationConfig,
  OpenClawQueryConfig,
  ScriptConfig,
} from './types';

interface ScheduledJob {
  job: CronJob;
  timeoutId: number | null;
  running: boolean;
}

export class CronManager {
  private plugin: ElePlugin;
  private storage: CronStorage;
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private initialized = false;
  private checkIntervalId: number | null = null;

  constructor(plugin: ElePlugin, storage: CronStorage) {
    this.plugin = plugin;
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.storage.initialize();

    // Schedule all enabled jobs
    const jobs = this.storage.getJobs();
    for (const job of jobs) {
      if (job.enabled) {
        this.scheduleJob(job);
      }
    }

    // Set up periodic check for missed jobs (every minute)
    this.checkIntervalId = window.setInterval(() => {
      this.checkMissedJobs();
    }, 60000);

    this.initialized = true;
    console.log('[CronManager] Initialized with', jobs.length, 'jobs');
  }

  cleanup(): void {
    // Clear all scheduled timeouts
    for (const scheduled of this.scheduledJobs.values()) {
      if (scheduled.timeoutId) {
        window.clearTimeout(scheduled.timeoutId);
      }
    }
    this.scheduledJobs.clear();

    if (this.checkIntervalId) {
      window.clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    this.initialized = false;
  }

  // Job management

  async addJob(
    name: string,
    description: string | undefined,
    frequency: CronFrequency,
    type: CronJobType,
    config: CronJobConfig,
    cronExpression?: string,
    enabled = true
  ): Promise<CronJob> {
    const id = randomUUID();

    // Calculate next run time
    const nextRunAt = this.calculateNextRun(frequency, cronExpression);

    const job: CronJob = {
      id,
      name,
      description,
      enabled,
      frequency,
      cronExpression,
      nextRunAt,
      type,
      config,
    };

    await this.storage.addJob(job);

    if (enabled) {
      this.scheduleJob(job);
    }

    return job;
  }

  async updateJob(id: string, updates: Partial<CronJob>): Promise<void> {
    const scheduled = this.scheduledJobs.get(id);
    if (scheduled?.timeoutId) {
      window.clearTimeout(scheduled.timeoutId);
      scheduled.timeoutId = null;
    }

    await this.storage.updateJob(id, updates);

    const updatedJob = this.storage.getJob(id);
    if (updatedJob?.enabled) {
      this.scheduleJob(updatedJob);
    } else {
      this.scheduledJobs.delete(id);
    }
  }

  async deleteJob(id: string): Promise<void> {
    const scheduled = this.scheduledJobs.get(id);
    if (scheduled?.timeoutId) {
      window.clearTimeout(scheduled.timeoutId);
    }
    this.scheduledJobs.delete(id);

    await this.storage.deleteJob(id);
  }

  async toggleJob(id: string, enabled: boolean): Promise<void> {
    const job = this.storage.getJob(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    if (enabled === job.enabled) return;

    if (enabled) {
      // Re-calculate next run when enabling
      const nextRunAt = this.calculateNextRun(job.frequency, job.cronExpression);
      await this.storage.updateJob(id, { enabled: true, nextRunAt });
      const updatedJob = this.storage.getJob(id)!;
      this.scheduleJob(updatedJob);
    } else {
      const scheduled = this.scheduledJobs.get(id);
      if (scheduled?.timeoutId) {
        window.clearTimeout(scheduled.timeoutId);
      }
      this.scheduledJobs.delete(id);
      await this.storage.updateJob(id, { enabled: false });
    }
  }

  async runJobNow(id: string): Promise<void> {
    const job = this.storage.getJob(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    await this.executeJob(job);
  }

  getJobs(): CronJob[] {
    return this.storage.getJobs();
  }

  getJob(id: string): CronJob | null {
    return this.storage.getJob(id);
  }

  getLogs(jobId?: string, limit = 50): CronJobLog[] {
    return this.storage.getLogs(jobId, limit);
  }

  async clearLogs(): Promise<void> {
    await this.storage.clearLogs();
  }

  async loadFileBasedJobs(): Promise<number> {
    const vaultPath = getVaultPath(this.plugin.app);
    if (!vaultPath) {
      console.warn('[CronManager] No vault path available, cannot load file-based jobs');
      return 0;
    }
    const cronDir = require('path').join(vaultPath, '.ele', 'cron');
    
    try {
      const fs = require('fs');
      if (!fs.existsSync(cronDir)) {
        return 0;
      }
      
      const files = fs.readdirSync(cronDir).filter((f: string) => f.endsWith('.md'));
      let loadedCount = 0;
      
      for (const file of files) {
        const filePath = require('path').join(cronDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        const { CronFileParser } = await import('./CronFileParser');
        const parser = new CronFileParser(vaultPath);
        const parsed = parser.parseContent(content);
        
        if (parsed) {
          // Check if a job with this name already exists
          const existing = this.storage.getJobs().find(j => j.name === parsed.config.name);
          if (!existing) {
            // Build config based on job type
            let config: CronJobConfig;
            switch (parsed.config.type) {
              case 'notification':
                config = {
                  message: parsed.config.prompt || parsed.prompt || 'Cron job completed',
                  showBanner: true,
                } as NotificationConfig;
                break;
              case 'file-operation':
                config = {
                  operation: 'scan',
                  targetPath: parsed.config.targetFile || '${vault}',
                } as FileOperationConfig;
                break;
              case 'script':
                config = {
                  scriptContent: parsed.config.prompt || parsed.prompt || '',
                  timeoutMs: 30000,
                } as ScriptConfig;
                break;
              case 'openclaw-query':
              default:
                config = {
                  prompt: parsed.config.prompt || parsed.prompt || '',
                  targetFile: parsed.config.targetFile || parsed.targetFile,
                  appendMode: parsed.config.appendMode || parsed.appendMode,
                  model: parsed.config.model,
                } as OpenClawQueryConfig;
                break;
            }
            
            await this.addJob(
              parsed.config.name || file.replace('.md', ''),
              parsed.config.description,
              parsed.config.frequency,
              parsed.config.type,
              config,
              parsed.config.cronExpression,
              parsed.config.enabled ?? true
            );
            loadedCount++;
          }
        }
      }
      
      return loadedCount;
    } catch (error) {
      console.error('[CronManager] Failed to load file-based jobs:', error);
      return 0;
    }
  }

  // Scheduling

  private scheduleJob(job: CronJob): void {
    // Unschedule existing if any
    const existing = this.scheduledJobs.get(job.id);
    if (existing?.timeoutId) {
      window.clearTimeout(existing.timeoutId);
    }

    const now = Date.now();
    const delay = Math.max(0, job.nextRunAt - now);

    const timeoutId = window.setTimeout(() => {
      void this.executeJob(job);
    }, delay);

    this.scheduledJobs.set(job.id, {
      job,
      timeoutId,
      running: false,
    });

    console.log(`[CronManager] Scheduled job "${job.name}" in ${Math.round(delay / 1000)}s`);
  }

  private calculateNextRun(frequency: CronFrequency, cronExpression?: string): number {
    if (frequency === 'custom' && cronExpression) {
      try {
        const cron = new CronExpression(cronExpression);
        return cron.getNextOccurrence().getTime();
      } catch {
        // Fall through to default
      }
    }

    const now = new Date();
    const expr = generateCronExpression(frequency as 'minute' | 'hourly' | 'daily' | 'weekly' | 'monthly');
    const cron = new CronExpression(expr);
    return cron.getNextOccurrence(now).getTime();
  }

  checkMissedJobs(): void {
    const now = Date.now();
    const jobs = this.storage.getJobs();

    for (const job of jobs) {
      if (!job.enabled) continue;

      // Check if job is past due (more than 1 minute overdue)
      if (job.nextRunAt < now - 60000) {
        console.log(`[CronManager] Missed job detected: "${job.name}"`);
        void this.executeJob(job);
      }
    }
  }

  // Execution

  private async executeJob(job: CronJob): Promise<void> {
    const scheduled = this.scheduledJobs.get(job.id);
    if (scheduled?.running) {
      console.log(`[CronManager] Job "${job.name}" already running, skipping`);
      return;
    }

    if (scheduled) {
      scheduled.running = true;
    }

    const logId = randomUUID();
    const startedAt = Date.now();

    console.log(`[CronManager] Executing job "${job.name}"`);

    try {
      switch (job.type) {
        case 'openclaw-query':
          await this.executeOpenClawQuery(job.config as OpenClawQueryConfig);
          break;
        case 'file-operation':
          await this.executeFileOperation(job.config as FileOperationConfig);
          break;
        case 'notification':
          await this.executeNotification(job.config as NotificationConfig);
          break;
        case 'script':
          await this.executeScript(job.config as ScriptConfig);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Success
      const endedAt = Date.now();
      await this.storage.addLog({
        id: logId,
        jobId: job.id,
        jobName: job.name,
        startedAt,
        endedAt,
        status: 'success',
      });

      await this.storage.updateJob(job.id, {
        lastRunAt: startedAt,
        lastRunStatus: 'success',
        lastRunError: undefined,
      });

      console.log(`[CronManager] Job "${job.name}" completed successfully`);
    } catch (error) {
      // Error
      const endedAt = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.storage.addLog({
        id: logId,
        jobId: job.id,
        jobName: job.name,
        startedAt,
        endedAt,
        status: 'error',
        error: errorMessage,
      });

      await this.storage.updateJob(job.id, {
        lastRunAt: startedAt,
        lastRunStatus: 'error',
        lastRunError: errorMessage,
      });

      console.error(`[CronManager] Job "${job.name}" failed:`, error);
    } finally {
      if (scheduled) {
        scheduled.running = false;
        scheduled.timeoutId = null;
      }

      // Re-schedule if job is still enabled
      const updatedJob = this.storage.getJob(job.id);
      if (updatedJob?.enabled) {
        // Calculate next run based on frequency
        const nextRunAt = this.calculateNextRun(job.frequency, job.cronExpression);
        await this.storage.updateJob(job.id, { nextRunAt });
        const refreshedJob = this.storage.getJob(job.id)!;
        this.scheduleJob(refreshedJob);
      }
    }
  }

  // Job type executors

  private async executeOpenClawQuery(config: OpenClawQueryConfig): Promise<void> {
    // Get active tab service
    const view = this.plugin.getView?.();
    if (!view) {
      throw new Error('No active Ele view');
    }

    const tab = view.getActiveTab?.();
    if (!tab?.service) {
      throw new Error('No active service available');
    }

    const chunks: string[] = [];
    for await (const chunk of tab.service.query(config.prompt)) {
      if (chunk.type === 'text') {
        chunks.push(chunk.content);
      }
    }

    const result = chunks.join('');

    if (config.targetFile) {
      await this.saveToFile(config.targetFile, result, config.appendMode);
    }
  }

  private async executeFileOperation(config: FileOperationConfig): Promise<void> {
    const vaultPath = (this.plugin.app.vault.adapter as any).basePath;
    const targetPath = config.targetPath.replace(/^\$\{vault\}/, vaultPath).replace(/^~/, process.env.HOME || '');

    switch (config.operation) {
      case 'scan':
        // Just verify the path exists
        if (!require('fs').existsSync(targetPath)) {
          throw new Error(`Path not found: ${targetPath}`);
        }
        break;
      case 'cleanup':
        // Simple cleanup - list old files
        if (config.maxAgeDays) {
          const fs = require('fs');
          const path = require('path');
          const cutoff = Date.now() - (config.maxAgeDays * 24 * 60 * 60 * 1000);

          const files = fs.readdirSync(targetPath);
          let cleaned = 0;
          for (const file of files) {
            const filePath = path.join(targetPath, file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < cutoff) {
              fs.unlinkSync(filePath);
              cleaned++;
            }
          }
          console.log(`[CronManager] Cleaned ${cleaned} old files`);
        }
        break;
      case 'backup':
      case 'index':
        // Placeholder - would need more implementation
        console.log(`[CronManager] ${config.operation} not fully implemented`);
        break;
    }
  }

  private async executeNotification(config: NotificationConfig): Promise<void> {
    if (config.showBanner) {
      new Notice(config.message, 10000);
    }
  }

  private async executeScript(config: ScriptConfig): Promise<void> {
    // Execute JavaScript in a sandboxed way
    // Note: This is a simplified version - real implementation would need more security
    const timeout = config.timeoutMs || 30000;

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Script timeout'));
      }, timeout);

      try {
        // Create a safe context
        const sandbox = {
          console,
          setTimeout,
          clearTimeout,
          plugin: this.plugin,
          vault: this.plugin.app.vault,
          require: (id: string) => {
            // Only allow safe modules
            if (['fs', 'path', 'os'].includes(id)) {
              return require(id);
            }
            throw new Error(`Module not allowed: ${id}`);
          },
        };

        const fn = new Function('context', `
          const { console, setTimeout, clearTimeout, plugin, vault, require } = context;
          return (async () => {
            ${config.scriptContent}
          })();
        `);

        fn(sandbox)
          .then(() => {
            window.clearTimeout(timeoutId);
            resolve();
          })
          .catch((err: Error) => {
            window.clearTimeout(timeoutId);
            reject(err);
          });
      } catch (error) {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private async saveToFile(filePath: string, content: string, mode?: 'append' | 'overwrite' | 'prepend'): Promise<void> {
    const vaultPath = (this.plugin.app.vault.adapter as any).basePath;
    const normalizedPath = filePath.replace(/^\$\{vault\}/, vaultPath).replace(/^~/, process.env.HOME || '');

    const fs = require('fs');
    const path = require('path');

    // Ensure directory exists
    const dir = path.dirname(normalizedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (mode === 'append' && fs.existsSync(normalizedPath)) {
      const existing = fs.readFileSync(normalizedPath, 'utf-8');
      fs.writeFileSync(normalizedPath, existing + '\n\n' + content);
    } else if (mode === 'prepend' && fs.existsSync(normalizedPath)) {
      const existing = fs.readFileSync(normalizedPath, 'utf-8');
      fs.writeFileSync(normalizedPath, content + '\n\n' + existing);
    } else {
      fs.writeFileSync(normalizedPath, content);
    }
  }
}
