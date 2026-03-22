/**
 * Cron job type definitions for Ele.
 */

export type CronFrequency = 'once' | 'minute' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export type CronJobType = 'openclaw-query' | 'file-operation' | 'notification' | 'script';

export interface OpenClawQueryConfig {
  prompt: string;
  model?: string;
  targetFile?: string;
  appendMode?: 'append' | 'overwrite' | 'prepend';
}

export interface FileOperationConfig {
  operation: 'scan' | 'backup' | 'cleanup' | 'index';
  targetPath: string;
  filePattern?: string;
  maxAgeDays?: number;
}

export interface NotificationConfig {
  message: string;
  showBanner: boolean;
  playSound?: boolean;
}

export interface ScriptConfig {
  scriptContent: string;
  timeoutMs: number;
}

export type CronJobConfig = OpenClawQueryConfig | FileOperationConfig | NotificationConfig | ScriptConfig;

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  frequency: CronFrequency;
  cronExpression?: string;
  time?: string;
  nextRunAt: number;
  lastRunAt?: number;
  lastRunStatus?: 'success' | 'error' | 'cancelled';
  lastRunError?: string;
  type: CronJobType;
  config: CronJobConfig;
}

export interface CronJobLog {
  id: string;
  jobId: string;
  jobName: string;
  startedAt: number;
  endedAt?: number;
  status: 'success' | 'error' | 'cancelled' | 'running';
  error?: string;
  output?: string;
  message?: string;
  duration?: number;
  timestamp?: number;
}

/** Real-time log entry for streaming job execution */
export interface CronJobRealtimeLog {
  id: string;
  jobId: string;
  jobName: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

/** Log stream callback type */
export type CronLogListener = (log: CronJobRealtimeLog) => void;

export interface CronStorageData {
  version: number;
  jobs: CronJob[];
  logs: CronJobLog[];
}

export interface CronFileConfig {
  name?: string;
  description?: string;
  enabled?: boolean;
  frequency: CronFrequency;
  time?: string;
  cronExpression?: string;
  type: CronJobType;
  model?: string;
  targetFile?: string;
  appendMode?: 'append' | 'overwrite' | 'prepend';
  prompt?: string;
}
