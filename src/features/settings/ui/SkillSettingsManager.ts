import { Notice, setIcon } from 'obsidian';

import type { SlashCommand } from '../../../core/types';
import type ClaudianPlugin from '../../../main';

interface SkillInfo {
  name: string;
  description: string;
  source: 'workspace' | 'managed' | 'bundled';
  path: string;
  userInvocable?: boolean;
}

export class SkillSettingsManager {
  private containerEl: HTMLElement;
  private plugin: ClaudianPlugin;

  constructor(containerEl: HTMLElement, plugin: ClaudianPlugin) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.render();
  }

  private async render() {
    this.containerEl.empty();

    const headerEl = this.containerEl.createDiv({ cls: 'opencodian-skill-header' });
    headerEl.createSpan({ text: 'OpenClaw Skills', cls: 'opencodian-skill-label' });

    const refreshBtn = headerEl.createEl('button', {
      cls: 'opencodian-settings-action-btn',
      attr: { 'aria-label': 'Refresh' },
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => this.refreshSkills());

    // Load skills from storage
    const skills = await this.loadSkills();

    if (skills.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'opencodian-skill-empty' });
      emptyEl.setText('No skills found. Skills are loaded from ~/.openclaw/skills/ or {vault}/skills/');
      return;
    }

    const listEl = this.containerEl.createDiv({ cls: 'opencodian-skill-list' });

    // Group by source
    const grouped = this.groupBySource(skills);

    for (const [source, sourceSkills] of Object.entries(grouped)) {
      const sectionHeader = listEl.createDiv({ cls: 'opencodian-skill-section-header' });
      sectionHeader.setText(this.formatSourceName(source));

      for (const skill of sourceSkills) {
        this.renderSkillItem(listEl, skill);
      }
    }
  }

  private async loadSkills(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    try {
      // Load from vault storage (SkillStorage already handles this)
      const slashCommands = await this.plugin.storage.skills.loadAll();

      for (const cmd of slashCommands) {
        skills.push({
          name: cmd.name,
          description: cmd.description || '',
          source: this.detectSource(cmd),
          path: '', // Not tracked for now
          userInvocable: cmd.userInvocable,
        });
      }
    } catch (err) {
      console.error('[SkillSettingsManager] Failed to load skills:', err);
    }

    return skills;
  }

  private detectSource(cmd: SlashCommand): 'workspace' | 'managed' | 'bundled' {
    // Simple heuristic based on source field
    if (cmd.source === 'user') return 'workspace';
    if (cmd.source === 'plugin') return 'bundled';
    return 'managed';
  }

  private groupBySource(skills: SkillInfo[]): Record<string, SkillInfo[]> {
    const grouped: Record<string, SkillInfo[]> = {
      workspace: [],
      managed: [],
      bundled: [],
    };

    for (const skill of skills) {
      grouped[skill.source].push(skill);
    }

    return grouped;
  }

  private formatSourceName(source: string): string {
    const names: Record<string, string> = {
      workspace: 'Workspace Skills',
      managed: 'Managed Skills (~/.openclaw/skills/)',
      bundled: 'Bundled Skills',
    };
    return names[source] || source;
  }

  private renderSkillItem(listEl: HTMLElement, skill: SkillInfo) {
    const itemEl = listEl.createDiv({ cls: 'opencodian-skill-item' });

    const infoEl = itemEl.createDiv({ cls: 'opencodian-skill-info' });

    const nameRow = infoEl.createDiv({ cls: 'opencodian-skill-name-row' });

    const nameEl = nameRow.createSpan({ cls: 'opencodian-skill-name' });
    nameEl.setText(skill.name);

    if (skill.userInvocable) {
      const badgeEl = nameRow.createSpan({ cls: 'opencodian-skill-badge' });
      badgeEl.setText('/command');
    }

    if (skill.description) {
      const descEl = infoEl.createDiv({ cls: 'opencodian-skill-description' });
      descEl.setText(skill.description);
    }
  }

  private async refreshSkills() {
    try {
      await this.render();
      new Notice('Skills refreshed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`Failed to refresh skills: ${message}`);
    }
  }

  public refresh() {
    void this.render();
  }
}
