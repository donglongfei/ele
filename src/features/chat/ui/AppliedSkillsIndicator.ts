import { setIcon } from 'obsidian';

import type { AppliedInstructionSkill } from '../state/types';

export interface AppliedSkillsIndicatorCallbacks {
  onRemoveSkill: (name: string) => void;
}

export class AppliedSkillsIndicator {
  private containerEl: HTMLElement;
  private skillsContainerEl: HTMLElement | null = null;
  private skills: AppliedInstructionSkill[] = [];
  private callbacks: AppliedSkillsIndicatorCallbacks;
  private expandedSkills: Set<string> = new Set();

  constructor(containerEl: HTMLElement, callbacks: AppliedSkillsIndicatorCallbacks) {
    this.containerEl = containerEl;
    this.callbacks = callbacks;
    this.render();
  }

  setSkills(skills: AppliedInstructionSkill[]): void {
    this.skills = skills;
    this.render();
  }

  private render(): void {
    // Remove existing container if no skills
    if (this.skills.length === 0) {
      if (this.skillsContainerEl) {
        this.skillsContainerEl.remove();
        this.skillsContainerEl = null;
      }
      return;
    }

    // Create or get container
    if (!this.skillsContainerEl) {
      this.skillsContainerEl = this.containerEl.createDiv({ cls: 'ele-applied-skills-container' });
    }
    this.skillsContainerEl.empty();

    // Header
    const headerEl = this.skillsContainerEl.createDiv({ cls: 'ele-applied-skills-header' });
    const iconEl = headerEl.createSpan({ cls: 'ele-applied-skills-icon' });
    setIcon(iconEl, 'sparkles');
    const textEl = headerEl.createSpan({ cls: 'ele-applied-skills-text' });
    textEl.setText(`${this.skills.length} instruction skill${this.skills.length > 1 ? 's' : ''} applied`);

    // Toggle all button
    const toggleAllBtn = headerEl.createEl('button', { 
      cls: 'ele-applied-skills-toggle-all',
      attr: { 'aria-label': 'Toggle all' }
    });
    toggleAllBtn.style.display = 'flex';
    toggleAllBtn.style.alignItems = 'center';
    toggleAllBtn.style.justifyContent = 'center';
    toggleAllBtn.style.width = '28px';
    toggleAllBtn.style.height = '28px';
    toggleAllBtn.style.minWidth = '28px';
    toggleAllBtn.style.flexShrink = '0';
    
    const allExpanded = this.skills.every(s => this.expandedSkills.has(s.name));
    // Use valid Lucide icon names
    setIcon(toggleAllBtn, allExpanded ? 'chevron-up' : 'chevron-down');
    toggleAllBtn.addEventListener('click', () => {
      if (allExpanded) {
        this.expandedSkills.clear();
      } else {
        this.skills.forEach(s => this.expandedSkills.add(s.name));
      }
      this.render();
    });

    // Skills list
    const listEl = this.skillsContainerEl.createDiv({ cls: 'ele-applied-skills-list' });

    for (const skill of this.skills) {
      const isExpanded = this.expandedSkills.has(skill.name);
      
      const skillEl = listEl.createDiv({ 
        cls: `ele-applied-skill ${isExpanded ? 'expanded' : ''}`
      });

      // Skill header (always visible)
      const skillHeaderEl = skillEl.createDiv({ cls: 'ele-applied-skill-header' });
      
      const toggleEl = skillHeaderEl.createSpan({ cls: 'ele-applied-skill-toggle' });
      // Use valid Lucide icons
      setIcon(toggleEl, isExpanded ? 'chevron-down' : 'chevron-right');
      
      // Ensure toggle icon is visible
      toggleEl.style.display = 'flex';
      toggleEl.style.alignItems = 'center';
      toggleEl.style.justifyContent = 'center';
      toggleEl.style.width = '20px';
      toggleEl.style.height = '20px';
      
      const nameEl = skillHeaderEl.createSpan({ cls: 'ele-applied-skill-name' });
      nameEl.setText(skill.name);
      
      if (skill.description) {
        const descEl = skillHeaderEl.createSpan({ cls: 'ele-applied-skill-desc' });
        descEl.setText(skill.description);
      }

      const removeBtn = skillHeaderEl.createEl('button', {
        cls: 'ele-applied-skill-remove',
        attr: { 'aria-label': 'Remove skill' }
      });
      removeBtn.style.display = 'flex';
      removeBtn.style.alignItems = 'center';
      removeBtn.style.justifyContent = 'center';
      removeBtn.style.width = '24px';
      removeBtn.style.height = '24px';
      removeBtn.style.minWidth = '24px';
      removeBtn.style.flexShrink = '0';
      setIcon(removeBtn, 'x');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onRemoveSkill(skill.name);
      });

      // Toggle expand on header click (except remove button)
      skillHeaderEl.addEventListener('click', (e) => {
        if (e.target !== removeBtn && !removeBtn.contains(e.target as Node)) {
          if (this.expandedSkills.has(skill.name)) {
            this.expandedSkills.delete(skill.name);
          } else {
            this.expandedSkills.add(skill.name);
          }
          this.render();
        }
      });

      // Skill content (visible when expanded)
      const contentEl = skillEl.createDiv({ cls: 'ele-applied-skill-content' });
      const contentPreEl = contentEl.createEl('pre', { cls: 'ele-applied-skill-content-pre' });
      contentPreEl.setText(skill.content);
    }
  }

  destroy(): void {
    if (this.skillsContainerEl) {
      this.skillsContainerEl.remove();
      this.skillsContainerEl = null;
    }
  }
}
