/**
 * Cron Log Modal - Popup window for real-time log streaming
 */

import { App, Modal, Setting } from 'obsidian';
import { CronLogPanel } from './CronLogPanel';
import type { CronJobRealtimeLog } from '../../core/cron/types';
import type { CronManager } from '../../core/cron/CronManager';

export class CronLogModal extends Modal {
  private onLog: (listener: (log: CronJobRealtimeLog) => void) => (() => void);
  private cronManager: CronManager;
  private logPanel: CronLogPanel | null = null;

  constructor(
    app: App,
    onLog: (listener: (log: CronJobRealtimeLog) => void) => (() => void),
    cronManager: CronManager
  ) {
    super(app);
    this.onLog = onLog;
    this.cronManager = cronManager;
  }

  onOpen(): void {
    const { contentEl, titleEl, modalEl } = this;
    
    titleEl.setText('🔴 Live Cron Job Logs');
    
    // Style the modal to be larger
    modalEl.style.width = '800px';
    modalEl.style.maxWidth = '90vw';
    modalEl.style.height = '600px';
    modalEl.style.maxHeight = '80vh';

    // Top section with job runner
    const topSection = contentEl.createDiv('cron-log-top-section');
    topSection.style.marginBottom = '16px';
    
    // Job selector and run button
    const jobs = this.cronManager.getJobs();
    if (jobs.length > 0) {
      new Setting(topSection)
        .setName('Run Job')
        .setDesc('Select a job to run immediately')
        .addDropdown((dropdown) => {
          jobs.forEach((job) => {
            dropdown.addOption(job.id, `${job.name} (${job.enabled ? 'enabled' : 'disabled'})`);
          });
          return dropdown;
        })
        .addButton((btn) =>
          btn
            .setButtonText('▶️ Run Now')
            .setCta()
            .onClick(async () => {
              const dropdown = topSection.querySelector('select') as HTMLSelectElement;
              const jobId = dropdown?.value;
              if (jobId) {
                try {
                  await this.cronManager.runJobNow(jobId);
                } catch (err) {
                  console.error('[CronLogModal] Failed to run job:', err);
                }
              }
            })
        );
    } else {
      topSection.createEl('p', {
        text: 'No jobs configured. Create jobs in Settings → Ele → Cron Jobs.',
        cls: 'setting-item-description',
      });
    }

    // Description
    contentEl.createEl('p', {
      text: 'Real-time execution logs from cron jobs. Logs appear here when jobs run.',
      cls: 'setting-item-description',
    });

    // Log panel
    const logContainer = contentEl.createDiv('cron-log-modal-container');
    logContainer.style.height = 'calc(100% - 150px)';
    logContainer.style.minHeight = '300px';
    
    this.logPanel = new CronLogPanel(logContainer, this.onLog);
    this.logPanel.load();
  }

  onClose(): void {
    this.logPanel?.unload();
    this.contentEl.empty();
  }
}
