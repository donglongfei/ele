/**
 * Cron Jobs Setting Tab - Manage cron jobs in settings
 */

import type { App } from 'obsidian';
import { Notice, Setting } from 'obsidian';
import type ElePlugin from '../../main';
import type { CronJob } from '../../core/cron/types';
import { CronJobModal } from './CronJobModal';

export class CronJobsSettingTab {
  constructor(
    private app: App,
    private plugin: ElePlugin
  ) {}

  display(containerEl: HTMLElement): void {
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Cron Jobs' });

    // Description
    containerEl.createEl('p', {
      text: 'Schedule automated tasks that run at specified intervals. Jobs are persisted and will run even if Obsidian is closed (they will catch up on next open).',
    });

    // Add new job button
    new Setting(containerEl)
      .setName('Create new job')
      .setDesc('Add a new scheduled task')
      .addButton((btn) =>
        btn
          .setButtonText('Add Job')
          .setCta()
          .onClick(() => {
            this.openJobModal(null);
          })
      );

    // Refresh file-based jobs button
    new Setting(containerEl)
      .setName('Refresh file-based jobs')
      .setDesc('Reload jobs defined in .ele/cron/*.md files')
      .addButton((btn) =>
        btn.setButtonText('Refresh').onClick(async () => {
          await this.plugin.cronManager?.loadFileBasedJobs();
          new Notice('File-based cron jobs refreshed');
          this.display(containerEl);
        })
      );

    // Jobs list
    containerEl.createEl('h3', { text: 'Configured Jobs' });

    const jobs = this.plugin.cronManager?.getJobs() ?? [];

    if (jobs.length === 0) {
      containerEl.createEl('p', {
        text: 'No cron jobs configured. Create one above or add .md files to .ele/cron/',
        cls: 'setting-item-description',
      });
    } else {
      const jobsContainer = containerEl.createDiv('cron-jobs-list');
      for (const job of jobs) {
        this.renderJobItem(jobsContainer, job, containerEl);
      }
    }

    // Logs section
    containerEl.createEl('h3', { text: 'Recent Activity' });
    this.renderLogs(containerEl);
  }

  private renderJobItem(container: HTMLElement, job: CronJob, parentContainer: HTMLElement): void {
    const jobEl = container.createDiv('cron-job-item');
    jobEl.style.border = '1px solid var(--background-modifier-border)';
    jobEl.style.borderRadius = '6px';
    jobEl.style.padding = '12px';
    jobEl.style.marginBottom = '8px';

    const headerEl = jobEl.createDiv('cron-job-header');
    headerEl.style.display = 'flex';
    headerEl.style.justifyContent = 'space-between';
    headerEl.style.alignItems = 'center';
    headerEl.style.marginBottom = '8px';

    const nameEl = headerEl.createEl('span', {
      text: job.name,
      cls: 'cron-job-name',
    });
    nameEl.style.fontWeight = 'bold';

    const statusEl = headerEl.createEl('span', {
      text: job.enabled ? '● Enabled' : '○ Disabled',
      cls: `cron-job-status ${job.enabled ? 'enabled' : 'disabled'}`,
    });
    statusEl.style.color = job.enabled
      ? 'var(--text-success)'
      : 'var(--text-muted)';

    // Details
    const detailsEl = jobEl.createDiv('cron-job-details');
    detailsEl.style.fontSize = '0.9em';
    detailsEl.style.color = 'var(--text-muted)';

    const nextRun = job.nextRunAt ? new Date(job.nextRunAt) : null;
    const lastRun = job.lastRunAt ? new Date(job.lastRunAt) : null;

    detailsEl.createEl('div', {
      text: `Type: ${this.formatJobType(job.type)} | Frequency: ${this.formatFrequency(job)}`,
    });

    if (lastRun) {
      detailsEl.createEl('div', {
        text: `Last run: ${lastRun.toLocaleString()}`,
      });
    }

    if (nextRun && job.enabled) {
      detailsEl.createEl('div', {
        text: `Next run: ${nextRun.toLocaleString()}`,
      });
    }

    // Actions
    const actionsEl = jobEl.createDiv('cron-job-actions');
    actionsEl.style.marginTop = '12px';
    actionsEl.style.display = 'flex';
    actionsEl.style.gap = '8px';

    const editBtn = actionsEl.createEl('button', { text: 'Edit' });
    editBtn.addEventListener('click', () => {
      this.openJobModal(job, parentContainer);
    });

    const toggleBtn = actionsEl.createEl('button', {
      text: job.enabled ? 'Disable' : 'Enable',
    });
    toggleBtn.addEventListener('click', async () => {
      await this.plugin.cronManager?.toggleJob(job.id, !job.enabled);
      this.display(parentContainer);
    });

    const runBtn = actionsEl.createEl('button', { text: 'Run Now' });
    runBtn.addEventListener('click', async () => {
      await this.plugin.cronManager?.runJobNow(job.id);
      new Notice(`Job "${job.name}" started`);
    });

    const deleteBtn = actionsEl.createEl('button', { text: 'Delete' });
    deleteBtn.style.color = 'var(--text-error)';
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Delete job "${job.name}"?`)) {
        await this.plugin.cronManager?.deleteJob(job.id);
        new Notice(`Job "${job.name}" deleted`);
        this.display(parentContainer);
      }
    });
  }

  private renderLogs(containerEl: HTMLElement): void {
    const logs = this.plugin.cronManager?.getLogs() ?? [];
    const recentLogs = logs.slice(-10).reverse();

    if (recentLogs.length === 0) {
      containerEl.createEl('p', {
        text: 'No activity recorded yet.',
        cls: 'setting-item-description',
      });
      return;
    }

    const logsEl = containerEl.createDiv('cron-logs');
    logsEl.style.maxHeight = '300px';
    logsEl.style.overflow = 'auto';

    for (const log of recentLogs) {
      const logEl = logsEl.createDiv('cron-log-item');
      logEl.style.padding = '8px 0';
      logEl.style.borderBottom = '1px solid var(--background-modifier-border)';

      const timeEl = logEl.createEl('div', {
        text: new Date(log.startedAt).toLocaleString(),
        cls: 'cron-log-time',
      });
      timeEl.style.fontSize = '0.8em';
      timeEl.style.color = 'var(--text-muted)';

      const statusColor =
        log.status === 'success'
          ? 'var(--text-success)'
          : log.status === 'running'
          ? 'var(--text-accent)'
          : 'var(--text-error)';

      const statusEl = logEl.createEl('span', {
        text: log.status.toUpperCase(),
        cls: `cron-log-status ${log.status}`,
      });
      statusEl.style.color = statusColor;
      statusEl.style.fontWeight = 'bold';
      statusEl.style.fontSize = '0.8em';

      logEl.createEl('span', {
        text: ` ${log.jobName}`,
        cls: 'cron-log-job',
      });

      if (log.message) {
        const msgEl = logEl.createEl('div', {
          text: log.message,
          cls: 'cron-log-message',
        });
        msgEl.style.fontSize = '0.9em';
        msgEl.style.marginTop = '4px';
        msgEl.style.color = 'var(--text-muted)';
      }

      if (log.duration) {
        const durationEl = logEl.createEl('div', {
          text: `Duration: ${log.duration}ms`,
          cls: 'cron-log-duration',
        });
        durationEl.style.fontSize = '0.8em';
        durationEl.style.marginTop = '4px';
        durationEl.style.color = 'var(--text-muted)';
      }
    }

    // Clear logs button
    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Clear Logs').onClick(async () => {
        await this.plugin.cronManager?.clearLogs();
        this.display(containerEl);
      })
    );
  }

  private openJobModal(job: CronJob | null, parentContainer?: HTMLElement): void {
    const modal = new CronJobModal(this.app, job, async (jobData) => {
      try {
        if (job) {
          // Update existing - use updateJob which accepts Partial<CronJob>
          await this.plugin.cronManager?.updateJob(job.id, jobData);
          new Notice(`Job "${jobData.name}" updated`);
        } else {
          // Create new - use addJob with individual parameters
          await this.plugin.cronManager?.addJob(
            jobData.name,
            jobData.description,
            jobData.frequency,
            jobData.type,
            jobData.config,
            jobData.cronExpression,
            jobData.enabled
          );
          new Notice(`Job "${jobData.name}" created`);
        }
        // Refresh the view
        if (parentContainer) {
          this.display(parentContainer);
        } else {
          const containerEl = document.querySelector('.cron-jobs-setting') as HTMLElement;
          if (containerEl) {
            this.display(containerEl);
          }
        }
      } catch (error) {
        new Notice(`Error saving job: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    modal.open();
  }

  private formatJobType(type: CronJob['type']): string {
    const map: Record<string, string> = {
      'openclaw-query': 'OpenClaw Query',
      'file-operation': 'File Operation',
      notification: 'Notification',
      script: 'Script',
    };
    return map[type] || type;
  }

  private formatFrequency(job: CronJob): string {
    if (job.frequency === 'custom' && job.cronExpression) {
      return `Custom (${job.cronExpression})`;
    }
    if (job.time && ['daily', 'weekly', 'monthly'].includes(job.frequency)) {
      return `${job.frequency} at ${job.time}`;
    }
    return job.frequency;
  }
}
