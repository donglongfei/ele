/**
 * Cron Background Service - Handles OpenClaw queries without requiring UI
 * 
 * This service creates a minimal EleService instance for cron job execution
 * without needing an active chat view or tab.
 */

import { Notice } from 'obsidian';
import type ElePlugin from '../../main';
import { EleService } from '../agent/EleService';
import type { QueryOptions } from '../agent/EleService';
import type { McpServerManager } from '../mcp';
import type { StreamChunk } from '../types';
import type { CronJobRealtimeLog } from './types';

interface BackgroundQueryOptions {
  prompt: string;
  model?: string;
  onLog?: (log: CronJobRealtimeLog) => void;
  jobId: string;
  jobName: string;
}

export class CronBackgroundService {
  private plugin: ElePlugin;
  private mcpManager: McpServerManager;
  private eleService: EleService | null = null;
  private isReady = false;

  constructor(plugin: ElePlugin, mcpManager: McpServerManager) {
    this.plugin = plugin;
    this.mcpManager = mcpManager;
  }

  async initialize(): Promise<void> {
    if (this.isReady) return;

    try {
      // Delay initialization to ensure plugin is fully loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create a background EleService instance
      this.eleService = new EleService(this.plugin, this.mcpManager);
      
      // Set up minimal callbacks (no UI)
      this.eleService.setApprovalCallback(async (toolName) => {
        // Auto-approve safe tools in background mode
        if (this.isSafeTool(toolName)) {
          return 'allow';
        }
        // Block potentially dangerous tools
        console.warn(`[CronBackgroundService] Blocking tool in background mode: ${toolName}`);
        return 'deny';
      });

      this.isReady = true;
      console.log('[CronBackgroundService] Initialized successfully');
    } catch (error) {
      console.error('[CronBackgroundService] Failed to initialize:', error);
      // Don't throw - allow plugin to work without background service
      this.isReady = false;
    }
  }

  isServiceReady(): boolean {
    return this.isReady;
  }

  async query(options: BackgroundQueryOptions): Promise<string> {
    if (!this.isReady || !this.eleService) {
      throw new Error('Background service not initialized. Call initialize() first.');
    }

    const { prompt, model, onLog, jobId, jobName } = options;
    const chunks: string[] = [];

    this.emitLog(onLog, {
      id: `${jobId}-${Date.now()}`,
      jobId,
      jobName,
      timestamp: Date.now(),
      level: 'info',
      message: 'Starting OpenClaw query...',
      details: model ? `Using model: ${model}` : 'Using default model',
    });

    try {
      const queryOptions: QueryOptions = {
        model,
        forceColdStart: true, // Always use cold start for background
      };

      for await (const chunk of this.eleService.query(prompt, undefined, undefined, queryOptions)) {
        if (chunk.type === 'text') {
          chunks.push(chunk.content);
          
          // Emit progress log every ~100 chars
          if (chunks.join('').length % 100 < 10) {
            this.emitLog(onLog, {
              id: `${jobId}-${Date.now()}`,
              jobId,
              jobName,
              timestamp: Date.now(),
              level: 'info',
              message: 'Receiving response...',
              details: `${chunks.join('').length} chars received`,
            });
          }
        }
      }

      const result = chunks.join('');
      
      this.emitLog(onLog, {
        id: `${jobId}-${Date.now()}`,
        jobId,
        jobName,
        timestamp: Date.now(),
        level: 'success',
        message: 'Query completed successfully',
        details: `Total length: ${result.length} chars`,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.emitLog(onLog, {
        id: `${jobId}-${Date.now()}`,
        jobId,
        jobName,
        timestamp: Date.now(),
        level: 'error',
        message: 'Query failed',
        details: errorMessage,
      });

      throw error;
    }
  }

  cleanup(): void {
    if (this.eleService) {
      this.eleService.cleanup();
      this.eleService = null;
    }
    this.isReady = false;
    console.log('[CronBackgroundService] Cleaned up');
  }

  private isSafeTool(toolName: string): boolean {
    // Allow read-only and safe tools
    const safeTools = [
      'ReadFile',
      'ReadMultipleFiles',
      'Glob',
      'Grep',
      'FetchURL',
      'SearchWeb',
      'LS',
      'Task',
    ];
    return safeTools.some(t => toolName.includes(t));
  }

  private emitLog(onLog: ((log: CronJobRealtimeLog) => void) | undefined, log: CronJobRealtimeLog): void {
    console.log(`[CronBackgroundService] ${log.level}: ${log.message}`, log.details || '');
    if (onLog) {
      onLog(log);
    }
  }
}
