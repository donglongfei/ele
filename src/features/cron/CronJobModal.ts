/**
 * Cron Job Modal - Create and edit cron jobs
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import type { CronFrequency, CronJob, FileOperationConfig, NotificationConfig, OpenClawQueryConfig, ScriptConfig, CronJobConfig } from '../../core/cron/types';

interface CronJobFormData {
  name: string;
  enabled: boolean;
  frequency: CronFrequency;
  cronExpression?: string;
  time?: string;
  type: 'openclaw-query' | 'file-operation' | 'notification' | 'script';
  config: CronJobConfig;
}

const FREQUENCY_OPTIONS: { value: CronFrequency; label: string }[] = [
  { value: 'once', label: 'Once (at next run time)' },
  { value: 'minute', label: 'Every minute' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (cron expression)' },
];

const JOB_TYPE_OPTIONS: { value: CronJobFormData['type']; label: string }[] = [
  { value: 'openclaw-query', label: 'OpenClaw Query' },
  { value: 'file-operation', label: 'File Operation' },
  { value: 'notification', label: 'Notification' },
  { value: 'script', label: 'Script' },
];

export class CronJobModal extends Modal {
  private job: CronJob | null;
  private onSave: (job: Omit<CronJob, 'id'>) => void;
  private formData: CronJobFormData;

  constructor(
    app: App,
    job: CronJob | null,
    onSave: (job: Omit<CronJob, 'id'>) => void
  ) {
    super(app);
    this.job = job;
    this.onSave = onSave;

    // Initialize form data
    if (job) {
      this.formData = {
        name: job.name,
        enabled: job.enabled,
        frequency: job.frequency,
        cronExpression: job.cronExpression,
        time: job.time,
        type: job.type,
        config: { ...job.config },
      };
    } else {
      this.formData = {
        name: '',
        enabled: true,
        frequency: 'daily',
        type: 'openclaw-query',
        config: {
          prompt: '',
          targetFile: '',
          model: '',
          appendMode: 'append' as const,
        } as OpenClawQueryConfig,
      };
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cron-job-modal');

    this.titleEl.setText(this.job ? 'Edit Cron Job' : 'New Cron Job');

    // Name
    new Setting(contentEl)
      .setName('Name')
      .setDesc('A descriptive name for this job')
      .addText((text) =>
        text
          .setPlaceholder('Daily Summary')
          .setValue(this.formData.name)
          .onChange((value) => {
            this.formData.name = value;
          })
      );

    // Enabled
    new Setting(contentEl)
      .setName('Enabled')
      .setDesc('Whether this job should run')
      .addToggle((toggle) =>
        toggle.setValue(this.formData.enabled).onChange((value) => {
          this.formData.enabled = value;
        })
      );

    // Job Type
    new Setting(contentEl)
      .setName('Job Type')
      .setDesc('What type of job to run')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(Object.fromEntries(JOB_TYPE_OPTIONS.map((o) => [o.value, o.label])))
          .setValue(this.formData.type)
          .onChange((value) => {
            this.formData.type = value as CronJobFormData['type'];
            this.updateConfigSection();
          })
      );

    // Frequency
    new Setting(contentEl)
      .setName('Frequency')
      .setDesc('How often to run this job')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(Object.fromEntries(FREQUENCY_OPTIONS.map((o) => [o.value, o.label])))
          .setValue(this.formData.frequency)
          .onChange((value) => {
            this.formData.frequency = value as CronFrequency;
            this.updateTimeSettings();
          })
      );

    // Time settings container
    const timeSettingsEl = contentEl.createDiv('cron-time-settings');
    this.renderTimeSettings(timeSettingsEl);

    // Config section container
    const configEl = contentEl.createDiv('cron-config-section');
    this.renderConfigSection(configEl);

    // Buttons
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText('Save')
        .setCta()
        .onClick(() => {
          this.save();
        })
    );
  }

  private renderTimeSettings(container: HTMLElement): void {
    container.empty();

    if (this.formData.frequency === 'custom') {
      // Custom cron expression
      new Setting(container)
        .setName('Cron Expression')
        .setDesc('e.g., 0 9 * * 1-5 (weekdays at 9am)')
        .addText((text) =>
          text
            .setPlaceholder('0 9 * * 1-5')
            .setValue(this.formData.cronExpression || '')
            .onChange((value) => {
              this.formData.cronExpression = value;
            })
        );
    } else if (this.formData.frequency === 'once') {
      // One-time schedule
      new Setting(container)
        .setName('Run at')
        .setDesc('When to run this job')
        .addText((text) =>
        text
            .setPlaceholder(new Date().toISOString())
            .setValue(this.formData.time || '')
          .onChange((value) => {
              this.formData.time = value;
            })
        );
    } else if (['daily', 'weekly', 'monthly'].includes(this.formData.frequency)) {
      // Time of day
      new Setting(container)
        .setName('Time')
        .setDesc('Time to run (HH:MM format)')
        .addText((text) =>
          text
            .setPlaceholder('09:00')
            .setValue(this.formData.time || '')
            .onChange((value) => {
              this.formData.time = value;
            })
        );
    }
  }

  private renderConfigSection(container: HTMLElement): void {
    container.empty();
    container.createEl('h3', { text: 'Job Configuration' });

    switch (this.formData.type) {
      case 'openclaw-query':
        this.renderOpenClawConfig(container);
        break;
      case 'file-operation':
        this.renderFileOperationConfig(container);
        break;
      case 'notification':
        this.renderNotificationConfig(container);
        break;
      case 'script':
        this.renderScriptConfig(container);
        break;
    }
  }

  private renderOpenClawConfig(container: HTMLElement): void {
    const config = this.formData.config as OpenClawQueryConfig;

    new Setting(container)
      .setName('Prompt')
      .setDesc('The prompt to send to OpenClaw')
      .addTextArea((text) =>
        text
          .setPlaceholder('Summarize my daily notes...')
          .setValue(config.prompt || '')
          .onChange((value) => {
            config.prompt = value;
          })
      );

    new Setting(container)
      .setName('Output Path')
      .setDesc('Where to save the response (optional)')
      .addText((text) =>
        text
          .setPlaceholder('Daily Summaries/{{date}}.md')
          .setValue(config.targetFile || '')
          .onChange((value) => {
            config.targetFile = value;
          })
      );

    new Setting(container)
      .setName('Model')
      .setDesc('Model to use (leave empty for default)')
      .addText((text) =>
        text
          .setPlaceholder('claude-3-5-sonnet-20241022')
          .setValue(config.model || '')
          .onChange((value) => {
            config.model = value;
          })
      );


  }

  private renderFileOperationConfig(container: HTMLElement): void {
    const config = this.formData.config as FileOperationConfig;

    new Setting(container)
      .setName('Target Path')
      .setDesc('Target file or directory')
      .addText((text) =>
        text
          .setPlaceholder('Notes/')
          .setValue(config.targetPath || '')
          .onChange((value) => {
            config.targetPath = value;
          })
      );

    new Setting(container)
      .setName('Operation')
      .setDesc('What to do')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            scan: 'Scan',
            backup: 'Backup',
            cleanup: 'Cleanup',
            index: 'Index',
          })
          .setValue(config.operation || 'scan')
          .onChange((value) => {
            config.operation = value as FileOperationConfig['operation'];
          })
      );

    new Setting(container)
      .setName('File Pattern')
      .setDesc('File pattern to match (optional)')
      .addText((text) =>
        text
          .setPlaceholder('*.md')
          .setValue(config.filePattern || '')
          .onChange((value) => {
            config.filePattern = value;
          })
      );

    new Setting(container)
      .setName('Max Age (days)')
      .setDesc('Maximum age of files to include (optional)')
      .addText((text) =>
        text
          .setPlaceholder('30')
          .setValue(config.maxAgeDays?.toString() || '')
          .onChange((value) => {
            config.maxAgeDays = value ? parseInt(value, 10) : undefined;
          })
      );
  }

  private renderNotificationConfig(container: HTMLElement): void {
    const config = this.formData.config as NotificationConfig;

    new Setting(container)
      .setName('Message')
      .setDesc('Notification message')
      .addTextArea((text) =>
        text
          .setPlaceholder('Your scheduled task is complete!')
          .setValue(config.message || '')
          .onChange((value) => {
            config.message = value;
          })
      );

    new Setting(container)
      .setName('Show Banner')
      .setDesc('Show a banner notification')
      .addToggle((toggle) =>
        toggle.setValue(config.showBanner).onChange((value) => {
          config.showBanner = value;
        })
      );

    new Setting(container)
      .setName('Play Sound')
      .setDesc('Play a sound with the notification')
      .addToggle((toggle) =>
        toggle.setValue(config.playSound ?? false).onChange((value) => {
          config.playSound = value;
        })
      );
  }

  private renderScriptConfig(container: HTMLElement): void {
    const config = this.formData.config as ScriptConfig;

    new Setting(container)
      .setName('Script')
      .setDesc('JavaScript code to execute')
      .addTextArea((text) =>
        text
          .setPlaceholder('// Your JavaScript code here\nconsole.log("Hello!");')
          .setValue(config.scriptContent || '')
          .onChange((value) => {
            config.scriptContent = value;
          })
      );

    new Setting(container)
      .setName('Timeout (ms)')
      .setDesc('Maximum execution time in milliseconds')
      .addText((text) =>
        text
          .setPlaceholder('30000')
          .setValue(String(config.timeoutMs || 30000))
          .onChange((value) => {
            config.timeoutMs = parseInt(value, 10) || 30000;
          })
      );
  }

  private updateTimeSettings(): void {
    const container = this.contentEl.querySelector('.cron-time-settings') as HTMLElement;
    if (container) {
      this.renderTimeSettings(container);
    }
  }

  private updateConfigSection(): void {
    // Reset config for new type
    switch (this.formData.type) {
      case 'openclaw-query':
        this.formData.config = {
          prompt: '',
          targetFile: '',
          model: '',
          appendMode: 'append',
        };
        break;
      case 'file-operation':
        this.formData.config = {
          targetPath: '',
          operation: 'scan',
        };
        break;
      case 'notification':
        this.formData.config = {
          message: '',
          showBanner: true,
        };
        break;
      case 'script':
        this.formData.config = {
          scriptContent: '',
          timeoutMs: 30000,
        };
        break;
    }

    const container = this.contentEl.querySelector('.cron-config-section') as HTMLElement;
    if (container) {
      this.renderConfigSection(container);
    }
  }

  private save(): void {
    if (!this.formData.name.trim()) {
      new Notice('Please enter a name for this job');
      return;
    }

    if (this.formData.frequency === 'custom' && !this.formData.cronExpression?.trim()) {
      new Notice('Please enter a cron expression');
      return;
    }

    // Build the job data
    const jobData: Omit<CronJob, 'id'> = {
      name: this.formData.name.trim(),
      enabled: this.formData.enabled,
      frequency: this.formData.frequency,
      type: this.formData.type,
      config: this.formData.config,
      nextRunAt: 0, // Will be calculated by CronManager
    };

    if (this.formData.cronExpression) {
      jobData.cronExpression = this.formData.cronExpression.trim();
    }

    if (this.formData.time) {
      jobData.time = this.formData.time.trim();
    }

    this.onSave(jobData);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
