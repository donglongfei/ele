/**
 * Storage for cron jobs and execution logs.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { CronJob, CronJobLog, CronStorageData } from '../cron/types';

const CRON_DATA_VERSION = 1;
const DEFAULT_LOG_RETENTION = 100; // Keep last 100 logs

export class CronStorage {
  private basePath: string;
  private data: CronStorageData;
  private initialized = false;

  constructor(vaultPath: string) {
    this.basePath = path.join(vaultPath, '.ele');
    this.data = {
      version: CRON_DATA_VERSION,
      jobs: [],
      logs: [],
    };
  }

  private getCronFilePath(): string {
    if (!this.basePath) {
      throw new Error('No vault path available');
    }
    return path.join(this.basePath, 'cron.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Skip if no vault path available (e.g., mobile)
    if (!this.basePath) {
      console.warn('[CronStorage] No vault path available, cron jobs will not be persisted');
      this.initialized = true;
      return;
    }

    try {
      // Ensure .ele directory exists
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
      }

      const filePath = this.getCronFilePath();
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content) as Partial<CronStorageData>;

        // Handle migration if needed
        this.data = {
          version: parsed.version || CRON_DATA_VERSION,
          jobs: parsed.jobs || [],
          logs: parsed.logs || [],
        };

        // Validate and clean up jobs
        this.data.jobs = this.data.jobs.filter(job => this.isValidJob(job));
      }
    } catch (error) {
      console.error('[CronStorage] Failed to load cron data:', error);
      // Start with empty data on error
      this.data = {
        version: CRON_DATA_VERSION,
        jobs: [],
        logs: [],
      };
    }

    this.initialized = true;
  }

  private isValidJob(job: unknown): job is CronJob {
    if (!job || typeof job !== 'object') return false;
    const j = job as Partial<CronJob>;
    return !!(
      j.id &&
      j.name &&
      j.frequency &&
      j.type &&
      j.config &&
      typeof j.nextRunAt === 'number'
    );
  }

  private async save(): Promise<void> {
    if (!this.initialized) return;
    if (!this.basePath) return; // Skip if no vault path

    try {
      const filePath = this.getCronFilePath();
      fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[CronStorage] Failed to save cron data:', error);
      throw error;
    }
  }

  // Job operations

  getJobs(): CronJob[] {
    return [...this.data.jobs];
  }

  getJob(id: string): CronJob | null {
    return this.data.jobs.find(j => j.id === id) || null;
  }

  async addJob(job: CronJob): Promise<void> {
    this.data.jobs.push(job);
    await this.save();
  }

  async updateJob(id: string, updates: Partial<CronJob>): Promise<void> {
    const index = this.data.jobs.findIndex(j => j.id === id);
    if (index === -1) {
      throw new Error(`Job not found: ${id}`);
    }
    this.data.jobs[index] = { ...this.data.jobs[index], ...updates };
    await this.save();
  }

  async deleteJob(id: string): Promise<void> {
    this.data.jobs = this.data.jobs.filter(j => j.id !== id);
    await this.save();
  }

  // Log operations

  getLogs(jobId?: string, limit = 50): CronJobLog[] {
    let logs = [...this.data.logs];
    if (jobId) {
      logs = logs.filter(l => l.jobId === jobId);
    }
    return logs.slice(-limit).reverse();
  }

  async addLog(log: CronJobLog): Promise<void> {
    this.data.logs.push(log);
    // Trim old logs
    if (this.data.logs.length > DEFAULT_LOG_RETENTION) {
      this.data.logs = this.data.logs.slice(-DEFAULT_LOG_RETENTION);
    }
    await this.save();
  }

  async clearLogs(jobId?: string): Promise<void> {
    if (jobId) {
      this.data.logs = this.data.logs.filter(l => l.jobId !== jobId);
    } else {
      this.data.logs = [];
    }
    await this.save();
  }
}
