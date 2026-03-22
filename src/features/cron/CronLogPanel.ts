/**
 * Cron Log Panel - Real-time log streaming UI
 * 
 * Shows live execution logs from cron jobs with filtering and auto-scroll.
 */

import { Component } from 'obsidian';
import type { CronJobRealtimeLog } from '../../core/cron/types';

export class CronLogPanel extends Component {
  private containerEl: HTMLElement;
  private logsContainer: HTMLElement;
  private logs: CronJobRealtimeLog[] = [];
  private maxLogs = 100;
  private autoScroll = true;
  private onLogUnsubscribe: (() => void) | null = null;

  constructor(
    containerEl: HTMLElement,
    private onLog: (listener: (log: CronJobRealtimeLog) => void) => (() => void)
  ) {
    super();
    this.containerEl = containerEl;
  }

  onload(): void {
    this.render();
    this.onLogUnsubscribe = this.onLog((log) => this.addLog(log));
  }

  onunload(): void {
    this.onLogUnsubscribe?.();
    this.containerEl.empty();
  }

  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('cron-log-panel');

    // Header with controls
    const headerEl = this.containerEl.createDiv('cron-log-header');
    headerEl.style.display = 'flex';
    headerEl.style.justifyContent = 'space-between';
    headerEl.style.alignItems = 'center';
    headerEl.style.padding = '8px 12px';
    headerEl.style.borderBottom = '1px solid var(--background-modifier-border)';

    const titleEl = headerEl.createEl('span', { text: 'Live Logs' });
    titleEl.style.fontWeight = 'bold';

    const controlsEl = headerEl.createDiv('cron-log-controls');
    controlsEl.style.display = 'flex';
    controlsEl.style.gap = '8px';

    // Auto-scroll toggle
    const autoScrollBtn = controlsEl.createEl('button', {
      text: this.autoScroll ? '📜 Auto' : '📜 Manual',
    });
    autoScrollBtn.style.fontSize = '0.8em';
    autoScrollBtn.addEventListener('click', () => {
      this.autoScroll = !this.autoScroll;
      autoScrollBtn.textContent = this.autoScroll ? '📜 Auto' : '📜 Manual';
    });

    // Clear button
    const clearBtn = controlsEl.createEl('button', { text: '🗑️ Clear' });
    clearBtn.style.fontSize = '0.8em';
    clearBtn.addEventListener('click', () => this.clearLogs());

    // Logs container
    this.logsContainer = this.containerEl.createDiv('cron-logs-container');
    this.logsContainer.style.maxHeight = '300px';
    this.logsContainer.style.overflow = 'auto';
    this.logsContainer.style.padding = '8px';
    this.logsContainer.style.fontFamily = 'var(--font-monospace)';
    this.logsContainer.style.fontSize = '0.85em';

    // Empty state
    this.renderEmptyState();
  }

  private renderEmptyState(): void {
    this.logsContainer.empty();
    const emptyEl = this.logsContainer.createDiv('cron-log-empty');
    emptyEl.textContent = 'No logs yet. Run a job to see live output.';
    emptyEl.style.color = 'var(--text-muted)';
    emptyEl.style.textAlign = 'center';
    emptyEl.style.padding = '20px';
    emptyEl.style.fontStyle = 'italic';
  }

  private addLog(log: CronJobRealtimeLog): void {
    // Remove empty state on first log
    if (this.logs.length === 0) {
      this.logsContainer.empty();
    }

    this.logs.push(log);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
      // Re-render all logs if we hit the limit
      this.renderAllLogs();
      return;
    }

    // Append single log
    const logEl = this.createLogElement(log);
    this.logsContainer.appendChild(logEl);

    // Auto-scroll
    if (this.autoScroll) {
      this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    }
  }

  private createLogElement(log: CronJobRealtimeLog): HTMLElement {
    const logEl = this.logsContainer.createDiv('cron-log-entry');
    logEl.style.display = 'flex';
    logEl.style.gap = '8px';
    logEl.style.padding = '4px 0';
    logEl.style.borderBottom = '1px solid var(--background-modifier-border-hover)';

    // Timestamp
    const timeEl = logEl.createEl('span', {
      text: new Date(log.timestamp).toLocaleTimeString(),
    });
    timeEl.style.color = 'var(--text-muted)';
    timeEl.style.minWidth = '60px';
    timeEl.style.fontSize = '0.85em';

    // Level indicator
    const levelEl = logEl.createEl('span', { text: this.getLevelIcon(log.level) });
    levelEl.style.minWidth = '20px';

    // Job name
    const jobEl = logEl.createEl('span', { text: log.jobName });
    jobEl.style.color = 'var(--text-accent)';
    jobEl.style.minWidth = '100px';
    jobEl.style.overflow = 'hidden';
    jobEl.style.textOverflow = 'ellipsis';
    jobEl.style.whiteSpace = 'nowrap';

    // Message
    const msgEl = logEl.createEl('span', { text: log.message });
    msgEl.style.flex = '1';
    msgEl.style.color = this.getLevelColor(log.level);

    // Details (if present)
    if (log.details) {
      const detailsEl = logEl.createEl('span', { text: log.details });
      detailsEl.style.color = 'var(--text-muted)';
      detailsEl.style.fontSize = '0.9em';
      detailsEl.style.marginLeft = '8px';
      detailsEl.style.maxWidth = '200px';
      detailsEl.style.overflow = 'hidden';
      detailsEl.style.textOverflow = 'ellipsis';
      detailsEl.style.whiteSpace = 'nowrap';
      detailsEl.title = log.details;
    }

    return logEl;
  }

  private renderAllLogs(): void {
    this.logsContainer.empty();
    for (const log of this.logs) {
      this.logsContainer.appendChild(this.createLogElement(log));
    }
    if (this.autoScroll) {
      this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    }
  }

  private clearLogs(): void {
    this.logs = [];
    this.renderEmptyState();
  }

  private getLevelIcon(level: CronJobRealtimeLog['level']): string {
    switch (level) {
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      default:
        return '•';
    }
  }

  private getLevelColor(level: CronJobRealtimeLog['level']): string {
    switch (level) {
      case 'info':
        return 'var(--text-normal)';
      case 'warn':
        return 'var(--text-warning)';
      case 'error':
        return 'var(--text-error)';
      case 'success':
        return 'var(--text-success)';
      default:
        return 'var(--text-normal)';
    }
  }
}
