import type { App } from 'obsidian';
import { Modal, Notice, setIcon, Setting, type ToggleComponent } from 'obsidian';

import type { SlashCommand } from '../../../core/types';
import { t } from '../../../i18n';
import type ElePlugin from '../../../main';
import { isSkill, normalizeArgumentHint, parseSlashCommandContent, validateCommandName } from '../../../utils/slashCommand';

// ============================================================================
// Types
// ============================================================================

interface SkillInfo {
  name: string;
  description: string;
  source: 'obsidian' | 'openclaw';
  path: string;
  userInvocable?: boolean;
  location: string;
}

interface CommandInfo {
  id: string;
  name: string;
  description?: string;
  argumentHint?: string;
  isSkill: boolean;
}

// ============================================================================
// Command/Skill Modal (reused from SlashCommandSettings)
// ============================================================================

function resolveAllowedTools(inputValue: string, parsedTools?: string[]): string[] | undefined {
  const trimmed = inputValue.trim();
  if (trimmed) {
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (parsedTools && parsedTools.length > 0) {
    return parsedTools;
  }
  return undefined;
}

class CommandModal extends Modal {
  private plugin: ElePlugin;
  private existingCmd: SlashCommand | null;
  private onSave: (cmd: SlashCommand) => Promise<void>;

  constructor(
    app: App,
    plugin: ElePlugin,
    existingCmd: SlashCommand | null,
    onSave: (cmd: SlashCommand) => Promise<void>
  ) {
    super(app);
    this.plugin = plugin;
    this.existingCmd = existingCmd;
    this.onSave = onSave;
  }

  onOpen() {
    const existingIsSkill = this.existingCmd ? isSkill(this.existingCmd) : false;
    let selectedType: 'command' | 'skill' = existingIsSkill ? 'skill' : 'command';

    const typeLabel = () => selectedType === 'skill' ? 'Skill' : 'Slash Command';

    this.setTitle(this.existingCmd ? `Edit ${typeLabel()}` : `Add ${typeLabel()}`);
    this.modalEl.addClass('ele-sp-modal');

    const { contentEl } = this;

    let nameInput: HTMLInputElement;
    let descInput: HTMLInputElement;
    let hintInput: HTMLInputElement;
    let modelInput: HTMLInputElement;
    let toolsInput: HTMLInputElement;
    let disableModelToggle: boolean = this.existingCmd?.disableModelInvocation ?? false;
    let disableUserInvocation: boolean = this.existingCmd?.userInvocable === false;
    let contextValue: 'fork' | '' = this.existingCmd?.context ?? '';
    let agentInput: HTMLInputElement;

    /* eslint-disable prefer-const -- assigned in Setting callbacks */
    let disableUserSetting!: Setting;
    let disableUserToggle!: ToggleComponent;
    /* eslint-enable prefer-const */

    const updateSkillOnlyFields = () => {
      const isSkillType = selectedType === 'skill';
      disableUserSetting.settingEl.style.display = isSkillType ? '' : 'none';
      if (!isSkillType) {
        disableUserInvocation = false;
        disableUserToggle.setValue(false);
      }
    };

    new Setting(contentEl)
      .setName('Type')
      .setDesc('Command or skill')
      .addDropdown(dropdown => {
        dropdown
          .addOption('command', 'Command')
          .addOption('skill', 'Skill')
          .setValue(selectedType)
          .onChange(value => {
            selectedType = value as 'command' | 'skill';
            this.setTitle(this.existingCmd ? `Edit ${typeLabel()}` : `Add ${typeLabel()}`);
            updateSkillOnlyFields();
          });
        if (this.existingCmd) {
          dropdown.setDisabled(true);
        }
      });

    new Setting(contentEl)
      .setName('Command name')
      .setDesc('The name used after / (e.g., "review" for /review)')
      .addText(text => {
        nameInput = text.inputEl;
        text.setValue(this.existingCmd?.name || '')
          .setPlaceholder('review-code');
      });

    new Setting(contentEl)
      .setName('Description')
      .setDesc('Optional description shown in dropdown')
      .addText(text => {
        descInput = text.inputEl;
        text.setValue(this.existingCmd?.description || '');
      });

    const details = contentEl.createEl('details', { cls: 'ele-sp-advanced-section' });
    details.createEl('summary', {
      text: 'Advanced options',
      cls: 'ele-sp-advanced-summary',
    });
    if (this.existingCmd?.argumentHint || this.existingCmd?.model || this.existingCmd?.allowedTools?.length ||
        this.existingCmd?.disableModelInvocation || this.existingCmd?.userInvocable === false ||
        this.existingCmd?.context || this.existingCmd?.agent) {
      details.open = true;
    }

    new Setting(details)
      .setName('Argument hint')
      .setDesc('Placeholder text for arguments (e.g., "[file] [focus]")')
      .addText(text => {
        hintInput = text.inputEl;
        text.setValue(this.existingCmd?.argumentHint || '');
      });

    new Setting(details)
      .setName('Model override')
      .setDesc('Optional model to use for this command')
      .addText(text => {
        modelInput = text.inputEl;
        text.setValue(this.existingCmd?.model || '')
          .setPlaceholder('claude-sonnet-4-5');
      });

    new Setting(details)
      .setName('Allowed tools')
      .setDesc('Comma-separated list of tools to allow (empty = all)')
      .addText(text => {
        toolsInput = text.inputEl;
        text.setValue(this.existingCmd?.allowedTools?.join(', ') || '');
      });

    new Setting(details)
      .setName('Disable model invocation')
      .setDesc('Prevent the model from invoking this command itself')
      .addToggle(toggle => {
        toggle.setValue(disableModelToggle)
          .onChange(value => { disableModelToggle = value; });
      });

    disableUserSetting = new Setting(details)
      .setName('Disable user invocation')
      .setDesc('Prevent the user from invoking this skill directly')
      .addToggle(toggle => {
        disableUserToggle = toggle;
        toggle.setValue(disableUserInvocation)
          .onChange(value => { disableUserInvocation = value; });
      });

    updateSkillOnlyFields();

    new Setting(details)
      .setName('Context')
      .setDesc('Run in a subagent (fork)')
      .addToggle(toggle => {
        toggle.setValue(contextValue === 'fork')
          .onChange(value => {
            contextValue = value ? 'fork' : '';
            agentSetting.settingEl.style.display = value ? '' : 'none';
          });
      });

    const agentSetting = new Setting(details)
      .setName('Agent')
      .setDesc('Subagent type when context is fork')
      .addText(text => {
        agentInput = text.inputEl;
        text.setValue(this.existingCmd?.agent || '')
          .setPlaceholder('code-reviewer');
      });
    agentSetting.settingEl.style.display = contextValue === 'fork' ? '' : 'none';

    new Setting(contentEl)
      .setName('Prompt template')
      .setDesc('Use $ARGUMENTS, $1, $2, @file, !`bash`');

    const contentArea = contentEl.createEl('textarea', {
      cls: 'ele-sp-content-area',
      attr: {
        rows: '10',
        placeholder: 'Review this code for:\n$ARGUMENTS\n\n@$1',
      },
    });
    const initialContent = this.existingCmd
      ? parseSlashCommandContent(this.existingCmd.content).promptContent
      : '';
    contentArea.value = initialContent;

    const buttonContainer = contentEl.createDiv({ cls: 'ele-sp-modal-buttons' });

    const cancelBtn = buttonContainer.createEl('button', {
      text: 'Cancel',
      cls: 'ele-cancel-btn',
    });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = buttonContainer.createEl('button', {
      text: 'Save',
      cls: 'ele-save-btn',
    });
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const nameError = validateCommandName(name);
      if (nameError) {
        new Notice(nameError);
        return;
      }

      const content = contentArea.value;
      if (!content.trim()) {
        new Notice('Prompt template is required');
        return;
      }

      const existing = this.plugin.settings.slashCommands.find(
        c => c.name.toLowerCase() === name.toLowerCase() &&
             c.id !== this.existingCmd?.id
      );
      if (existing) {
        new Notice(`A command named "/${name}" already exists`);
        return;
      }

      const parsed = parseSlashCommandContent(content);
      const promptContent = parsed.promptContent;

      const isSkillType = selectedType === 'skill';
      const id = this.existingCmd?.id ||
        (isSkillType
          ? `skill-${name}`
          : `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);

      const cmd: SlashCommand = {
        id,
        name,
        description: descInput.value.trim() || parsed.description || undefined,
        argumentHint: normalizeArgumentHint(hintInput.value.trim()) || parsed.argumentHint || undefined,
        model: modelInput.value.trim() || parsed.model || undefined,
        allowedTools: resolveAllowedTools(toolsInput.value, parsed.allowedTools),
        content: promptContent,
        source: isSkillType ? 'user' : undefined,
        disableModelInvocation: disableModelToggle || undefined,
        userInvocable: disableUserInvocation ? false : true,
        context: contextValue || undefined,
        agent: contextValue === 'fork' ? (agentInput.value.trim() || undefined) : undefined,
      };

      try {
        await this.onSave(cmd);
      } catch {
        const label = isSkillType ? 'skill' : 'slash command';
        new Notice(`Failed to save ${label}`);
        return;
      }
      this.close();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    };
    contentEl.addEventListener('keydown', handleKeyDown);
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ============================================================================
// Main Manager
// ============================================================================

export class CommandsAndSkillsManager {
  private containerEl: HTMLElement;
  private plugin: ElePlugin;

  constructor(containerEl: HTMLElement, plugin: ElePlugin) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.render();
  }

  private async render(): Promise<void> {
    this.containerEl.empty();

    // Add action button header
    const headerEl = this.containerEl.createDiv({ cls: 'ele-cas-header' });
    headerEl.createSpan({ text: t('settings.slashCommands.name'), cls: 'ele-cas-label' });

    const actionsEl = headerEl.createDiv({ cls: 'ele-cas-header-actions' });

    const addBtn = actionsEl.createEl('button', {
      cls: 'ele-settings-action-btn',
      attr: { 'aria-label': 'Add Command or Skill' },
    });
    setIcon(addBtn, 'plus');
    addBtn.addEventListener('click', () => this.openCommandModal(null));

    // Refresh button
    const refreshBtn = actionsEl.createEl('button', {
      cls: 'ele-settings-action-btn',
      attr: { 'aria-label': 'Refresh' },
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => this.refresh());

    // Load data
    const commands = await this.loadCommands();
    const obsidianSkills = await this.loadObsidianSkills();
    const openclawSkills = await this.loadOpenclawSkills();

    // Section 1: Commands
    if (commands.length > 0) {
      this.renderSectionHeader('Commands', `.ele/commands/`);
      const listEl = this.containerEl.createDiv({ cls: 'ele-cas-list' });
      for (const cmd of commands) {
        this.renderCommandItem(listEl, cmd);
      }
    }

    // Section 2: Obsidian Skills
    if (obsidianSkills.length > 0) {
      this.renderSectionHeader('Obsidian Skills', `.ele/skills/`);
      const listEl = this.containerEl.createDiv({ cls: 'ele-cas-list' });
      for (const skill of obsidianSkills) {
        this.renderSkillItem(listEl, skill, 'obsidian');
      }
    }

    // Section 3: OpenClaw Skills
    if (openclawSkills.length > 0) {
      this.renderSectionHeader('OpenClaw Skills', `~/.openclaw/skills/`);
      const listEl = this.containerEl.createDiv({ cls: 'ele-cas-list' });
      for (const skill of openclawSkills) {
        this.renderSkillItem(listEl, skill, 'openclaw');
      }
    }

    // Empty state
    if (commands.length === 0 && obsidianSkills.length === 0 && openclawSkills.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'ele-cas-empty-state' });
      emptyEl.setText('No commands or skills configured. Click + to create one.');
    }
  }

  private renderSectionHeader(title: string, location: string): void {
    const sectionEl = this.containerEl.createDiv({ cls: 'ele-cas-section-header' });
    const titleEl = sectionEl.createSpan({ cls: 'ele-cas-section-title' });
    titleEl.setText(title);
    const locEl = sectionEl.createSpan({ cls: 'ele-cas-section-location' });
    locEl.setText(` (${location})`);
  }

  private async loadCommands(): Promise<CommandInfo[]> {
    return this.plugin.settings.slashCommands
      .filter(cmd => !isSkill(cmd))
      .map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        description: cmd.description,
        argumentHint: cmd.argumentHint,
        isSkill: false,
      }));
  }

  private async loadObsidianSkills(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    try {
      const slashCommands = await this.plugin.storage.skills.loadAll();

      for (const cmd of slashCommands) {
        skills.push({
          name: cmd.name,
          description: cmd.description || '',
          source: 'obsidian',
          path: '',
          userInvocable: cmd.userInvocable,
          location: '.ele/skills/',
        });
      }
    } catch (err) {
      console.error('[CommandsAndSkillsManager] Failed to load Obsidian skills:', err);
    }

    return skills;
  }

  private async loadOpenclawSkills(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    try {
      // Try to load from OpenClaw global directory
      const openclawSkills = await this.loadOpenclawSkillsFromDisk();
      skills.push(...openclawSkills);
    } catch (err) {
      console.error('[CommandsAndSkillsManager] Failed to load OpenClaw skills:', err);
    }

    return skills;
  }

  private async loadOpenclawSkillsFromDisk(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    try {
      // Use window.require for Electron environment (Obsidian)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const electron = (window as any).require;
      if (!electron) {
        console.log('[CommandsAndSkillsManager] Not in Electron environment, skipping OpenClaw skills');
        return skills;
      }

      const fs = electron('fs');
      const path = electron('path');
      const os = electron('os');

      const openclawSkillsPath = path.join(os.homedir(), '.openclaw', 'skills');

      if (!fs.existsSync(openclawSkillsPath)) {
        return skills;
      }

      const entries = fs.readdirSync(openclawSkillsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillName = entry.name;
        const skillFilePath = path.join(openclawSkillsPath, skillName, 'SKILL.md');

        if (!fs.existsSync(skillFilePath)) continue;

        try {
          const content = fs.readFileSync(skillFilePath, 'utf-8');
          const parsed = parseSlashCommandContent(content);

          skills.push({
            name: skillName,
            description: parsed.description || '',
            source: 'openclaw',
            path: skillFilePath,
            userInvocable: parsed.userInvocable,
            location: '~/.openclaw/skills/',
          });
        } catch (parseErr) {
          console.warn(`[CommandsAndSkillsManager] Failed to parse skill ${skillName}:`, parseErr);
        }
      }
    } catch (err) {
      console.error('[CommandsAndSkillsManager] Error loading OpenClaw skills:', err);
    }

    return skills;
  }

  private renderCommandItem(listEl: HTMLElement, cmd: CommandInfo): void {
    const itemEl = listEl.createDiv({ cls: 'ele-cas-item' });

    const infoEl = itemEl.createDiv({ cls: 'ele-cas-info' });

    const headerRow = infoEl.createDiv({ cls: 'ele-cas-item-header' });

    const nameEl = headerRow.createSpan({ cls: 'ele-cas-item-name' });
    nameEl.setText(`/${cmd.name}`);

    if (cmd.argumentHint) {
      const hintEl = headerRow.createSpan({ cls: 'ele-cas-item-hint' });
      hintEl.setText(cmd.argumentHint);
    }

    if (cmd.description) {
      const descEl = infoEl.createDiv({ cls: 'ele-cas-item-desc' });
      descEl.setText(cmd.description);
    }

    const actionsEl = itemEl.createDiv({ cls: 'ele-cas-item-actions' });

    const editBtn = actionsEl.createEl('button', {
      cls: 'ele-settings-action-btn',
      attr: { 'aria-label': 'Edit' },
    });
    setIcon(editBtn, 'pencil');
    editBtn.addEventListener('click', () => {
      const slashCmd = this.plugin.settings.slashCommands.find(c => c.id === cmd.id);
      if (slashCmd) {
        this.openCommandModal(slashCmd);
      }
    });

    const convertBtn = actionsEl.createEl('button', {
      cls: 'ele-settings-action-btn',
      attr: { 'aria-label': 'Convert to skill' },
    });
    setIcon(convertBtn, 'package');
    convertBtn.addEventListener('click', async () => {
      try {
        await this.transformToSkill(cmd);
      } catch {
        new Notice('Failed to convert to skill');
      }
    });

    const deleteBtn = actionsEl.createEl('button', {
      cls: 'ele-settings-action-btn ele-settings-delete-btn',
      attr: { 'aria-label': 'Delete' },
    });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.addEventListener('click', async () => {
      try {
        await this.deleteCommand(cmd);
      } catch {
        new Notice('Failed to delete command');
      }
    });
  }

  private renderSkillItem(listEl: HTMLElement, skill: SkillInfo, source: 'obsidian' | 'openclaw'): void {
    const itemEl = listEl.createDiv({ cls: 'ele-cas-item' });

    const infoEl = itemEl.createDiv({ cls: 'ele-cas-info' });

    const headerRow = infoEl.createDiv({ cls: 'ele-cas-item-header' });

    const nameEl = headerRow.createSpan({ cls: 'ele-cas-item-name' });
    nameEl.setText(skill.name);

    // Source badge
    const badgeEl = headerRow.createSpan({ cls: `ele-cas-badge ele-cas-badge--${source}` });
    badgeEl.setText(source);

    if (skill.userInvocable) {
      const userBadgeEl = headerRow.createSpan({ cls: 'ele-cas-badge ele-cas-badge--user' });
      userBadgeEl.setText('#instruction');
    }

    if (skill.description) {
      const descEl = infoEl.createDiv({ cls: 'ele-cas-item-desc' });
      descEl.setText(skill.description);
    }

    const actionsEl = itemEl.createDiv({ cls: 'ele-cas-item-actions' });

    // Only allow edit/delete for Obsidian skills
    if (source === 'obsidian') {
      const editBtn = actionsEl.createEl('button', {
        cls: 'ele-settings-action-btn',
        attr: { 'aria-label': 'Edit' },
      });
      setIcon(editBtn, 'pencil');
      editBtn.addEventListener('click', () => {
        const slashCmd = this.plugin.settings.slashCommands.find(
          c => isSkill(c) && c.name === skill.name
        );
        if (slashCmd) {
          this.openCommandModal(slashCmd);
        }
      });

      const deleteBtn = actionsEl.createEl('button', {
        cls: 'ele-settings-action-btn ele-settings-delete-btn',
        attr: { 'aria-label': 'Delete' },
      });
      setIcon(deleteBtn, 'trash-2');
      deleteBtn.addEventListener('click', async () => {
        try {
          await this.deleteObsidianSkill(skill);
        } catch {
          new Notice('Failed to delete skill');
        }
      });
    } else {
      // OpenClaw skills are read-only, show info
      const infoBtn = actionsEl.createEl('button', {
        cls: 'ele-settings-action-btn',
        attr: { 'aria-label': 'Read-only' },
      });
      setIcon(infoBtn, 'lock');
      infoBtn.title = 'OpenClaw skills are read-only. Edit in ~/.openclaw/skills/';
    }
  }

  private openCommandModal(existingCmd: SlashCommand | null): void {
    const modal = new CommandModal(
      this.plugin.app,
      this.plugin,
      existingCmd,
      async (cmd) => {
        await this.saveCommand(cmd, existingCmd);
      }
    );
    modal.open();
  }

  private storageFor(cmd: SlashCommand) {
    return isSkill(cmd) ? this.plugin.storage.skills : this.plugin.storage.commands;
  }

  private async saveCommand(cmd: SlashCommand, existing: SlashCommand | null): Promise<void> {
    await this.storageFor(cmd).save(cmd);

    if (existing && existing.name !== cmd.name) {
      await this.storageFor(existing).delete(existing.id);
    }

    await this.reloadCommands();
    this.render();

    const label = isSkill(cmd) ? 'Skill' : 'Command';
    new Notice(`${label} "/${cmd.name}" ${existing ? 'updated' : 'created'}`);
  }

  private async deleteCommand(cmd: CommandInfo): Promise<void> {
    const slashCmd = this.plugin.settings.slashCommands.find(c => c.id === cmd.id);
    if (!slashCmd) return;

    await this.plugin.storage.commands.delete(slashCmd.id);
    await this.reloadCommands();
    this.render();

    new Notice(`Command "/${cmd.name}" deleted`);
  }

  private async deleteObsidianSkill(skill: SkillInfo): Promise<void> {
    const slashCmd = this.plugin.settings.slashCommands.find(
      c => isSkill(c) && c.name === skill.name
    );
    if (!slashCmd) return;

    await this.plugin.storage.skills.delete(slashCmd.id);
    await this.reloadCommands();
    this.render();

    new Notice(`Skill "${skill.name}" deleted`);
  }

  private async transformToSkill(cmd: CommandInfo): Promise<void> {
    const skillName = cmd.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64);

    const existingSkill = this.plugin.settings.slashCommands.find(
      c => isSkill(c) && c.name === skillName
    );
    if (existingSkill) {
      new Notice(`A skill named "${skillName}" already exists`);
      return;
    }

    const description = cmd.description || '';

    const skill: SlashCommand = {
      id: `skill-${skillName}`,
      name: skillName,
      description,
      source: 'user',
      content: '', // Commands don't have content stored the same way
    };

    // Get the original command to copy its content
    const originalCmd = this.plugin.settings.slashCommands.find(c => c.id === cmd.id);
    if (originalCmd) {
      skill.content = originalCmd.content;
      skill.argumentHint = originalCmd.argumentHint;
      skill.model = originalCmd.model;
      skill.allowedTools = originalCmd.allowedTools;
    }

    await this.plugin.storage.skills.save(skill);
    await this.plugin.storage.commands.delete(cmd.id);

    await this.reloadCommands();
    this.render();
    new Notice(`Converted "/${cmd.name}" to skill`);
  }

  private async reloadCommands(): Promise<void> {
    this.plugin.settings.slashCommands = await this.plugin.storage.loadAllSlashCommands();
  }

  public refresh(): void {
    void this.render();
  }
}
