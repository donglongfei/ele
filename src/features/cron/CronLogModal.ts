/**
 * Cron Log Modal - Popup window for real-time log streaming
 */

import { App, Modal } from 'obsidian';
import { CronLogPanel } from './CronLogPanel';
import type { CronJobRealtimeLog } from '../../core/cron/types';

export class CronLogModal extends Modal {
  private onLog: (listener: (log: CronJobRealtimeLog) => void) => (() => void);
  private logPanel: CronLogPanel | null = null;

  constructor(
    app: App,
    onLog: (listener: (log: CronJobRealtimeLog) => void) => (() => void)
  ) {
    super(app);
    this.onLog = onLog;
  }

  onOpen(): void {
    const { contentEl, titleEl, modalEl } = this;
    
    titleEl.setText('🔴 Live Cron Job Logs');
    
    // Style the modal to be larger
    modalEl.style.width = '800px';
    modalEl.style.maxWidth = '90vw';
    modalEl.style.height = '600px';
    modalEl.style.maxHeight = '80vh';

    // Description
    contentEl.createEl('p', {
      text: 'Real-time execution logs from cron jobs. Logs appear here when jobs run.',
      cls: 'setting-item-description',
    });

    // Log panel
    const logContainer = contentEl.createDiv('cron-log-modal-container');
    logContainer.style.height = 'calc(100% - 80px)';
    logContainer.style.minHeight = '400px';
    
    this.logPanel = new CronLogPanel(logContainer, this.onLog);
    this.logPanel.load();
  }

  onClose(): void {
    this.logPanel?.unload();
    this.contentEl.empty();
  }
}
