/**
 * Instruction Skill Dropdown - Like SlashCommandDropdown but for # skills
 * 
 * Detects #skillname pattern in input and shows dropdown for selection.
 * The selected skill is added to the message (not persisted).
 */

import type { InstructionSkill } from './InstructionModeManager';

export interface InstructionSkillDropdownCallbacks {
  onSelect: (skill: InstructionSkill) => void;
  onHide: () => void;
  getSkills: () => Promise<InstructionSkill[]>;
}

export class InstructionSkillDropdown {
  private containerEl: HTMLElement;
  private dropdownEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement;
  private callbacks: InstructionSkillDropdownCallbacks;
  private skills: InstructionSkill[] = [];
  private filteredSkills: InstructionSkill[] = [];
  private selectedIndex = 0;
  private hashStartIndex = -1;
  private requestId = 0;

  constructor(
    containerEl: HTMLElement,
    inputEl: HTMLTextAreaElement,
    callbacks: InstructionSkillDropdownCallbacks
  ) {
    this.containerEl = containerEl;
    this.inputEl = inputEl;
    this.callbacks = callbacks;
  }

  /**
   * Check if we should show the dropdown based on cursor position.
   * Returns true if dropdown is shown.
   */
  async checkAndShow(): Promise<boolean> {
    const cursorPos = this.inputEl.selectionStart || 0;
    const text = this.inputEl.value;
    const textBeforeCursor = text.substring(0, cursorPos);

    // Find the last # before cursor
    const hashIndex = textBeforeCursor.lastIndexOf('#');
    
    if (hashIndex === -1) {
      this.hide();
      return false;
    }

    // Check if there's whitespace between # and cursor (would mean we're past the skill name)
    const textAfterHash = textBeforeCursor.substring(hashIndex + 1);
    if (/\s/.test(textAfterHash)) {
      this.hide();
      return false;
    }

    // Check if # is at word boundary (not part of another word like "C#")
    const charBeforeHash = textBeforeCursor.charAt(hashIndex - 1);
    if (hashIndex > 0 && /[a-zA-Z0-9_]/.test(charBeforeHash)) {
      this.hide();
      return false;
    }

    this.hashStartIndex = hashIndex;
    await this.showDropdown(textAfterHash);
    return this.dropdownEl?.hasClass('visible') ?? false;
  }

  /**
   * Handle keydown events for navigation.
   * Returns true if event was handled.
   */
  handleKeydown(e: KeyboardEvent): boolean {
    if (!this.isVisible()) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.navigate(1);
        return true;
      case 'ArrowUp':
        e.preventDefault();
        this.navigate(-1);
        return true;
      case 'Enter':
      case 'Tab':
        if (this.filteredSkills.length > 0) {
          e.preventDefault();
          this.selectSkill(this.filteredSkills[this.selectedIndex]);
          return true;
        }
        return false;
      case 'Escape':
        e.preventDefault();
        this.hide();
        return true;
    }
    return false;
  }

  /**
   * Handle input changes - check if we should show/hide dropdown.
   */
  handleInput(): void {
    void this.checkAndShow();
  }

  isVisible(): boolean {
    return this.dropdownEl?.hasClass('visible') ?? false;
  }

  hide(): void {
    if (this.dropdownEl) {
      this.dropdownEl.removeClass('visible');
    }
    this.hashStartIndex = -1;
    this.callbacks.onHide();
  }

  destroy(): void {
    if (this.dropdownEl) {
      this.dropdownEl.remove();
      this.dropdownEl = null;
    }
  }

  private async showDropdown(searchText: string): Promise<void> {
    const currentRequest = ++this.requestId;

    // Load skills if not loaded
    if (this.skills.length === 0) {
      try {
        this.skills = await this.callbacks.getSkills();
      } catch {
        this.skills = []; // Use empty array on error
      }
    }

    // Race condition check
    if (currentRequest !== this.requestId) return;

    const searchLower = searchText.toLowerCase().trim();

    if (searchLower === '') {
      this.filteredSkills = [...this.skills];
    } else {
      this.filteredSkills = this.skills.filter(skill =>
        skill.name.toLowerCase().includes(searchLower) ||
        skill.description?.toLowerCase().includes(searchLower)
      );
    }

    this.selectedIndex = 0;
    this.render();
  }

  private render(): void {
    if (!this.dropdownEl) {
      this.dropdownEl = this.containerEl.createDiv({ cls: 'ele-instruction-dropdown' });
    }

    this.dropdownEl.empty();

    // Header
    const headerEl = this.dropdownEl.createDiv({ cls: 'ele-instruction-dropdown-header' });
    headerEl.setText('Select instruction skill:');

    // Skills list
    const listEl = this.dropdownEl.createDiv({ cls: 'ele-instruction-dropdown-list' });

    if (this.filteredSkills.length === 0) {
      const emptyEl = listEl.createDiv({ cls: 'ele-instruction-dropdown-empty' });
      emptyEl.setText('No skills found. Create skills in .ele/skills/');
      this.dropdownEl.addClass('visible');
      return;
    }

    for (let i = 0; i < this.filteredSkills.length; i++) {
      const skill = this.filteredSkills[i];
      const itemEl = listEl.createDiv({ cls: 'ele-instruction-dropdown-item' });

      if (i === this.selectedIndex) {
        itemEl.addClass('selected');
      }

      const nameEl = itemEl.createSpan({ cls: 'ele-instruction-dropdown-name' });
      nameEl.setText(skill.name);

      if (skill.description) {
        const descEl = itemEl.createDiv({ cls: 'ele-instruction-dropdown-desc' });
        descEl.setText(skill.description);
      }

      itemEl.addEventListener('click', () => {
        this.selectSkill(skill);
      });

      itemEl.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.updateSelection();
      });
    }

    this.dropdownEl.addClass('visible');
    this.positionDropdown();
  }

  private positionDropdown(): void {
    // CSS handles positioning with bottom: 100%
    // This method is kept for future positioning logic if needed
  }

  private navigate(direction: number): void {
    if (this.filteredSkills.length === 0) return;
    const maxIndex = this.filteredSkills.length - 1;
    this.selectedIndex = Math.max(0, Math.min(maxIndex, this.selectedIndex + direction));
    this.updateSelection();
  }

  private updateSelection(): void {
    const items = this.dropdownEl?.querySelectorAll('.ele-instruction-dropdown-item');
    items?.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.addClass('selected');
        (item as HTMLElement).scrollIntoView({ block: 'nearest' });
      } else {
        item.removeClass('selected');
      }
    });
  }

  private selectSkill(skill: InstructionSkill): void {
    if (this.hashStartIndex === -1) return;

    const text = this.inputEl.value;
    const cursorPos = this.inputEl.selectionStart || 0;
    
    // Find the end of the skill name (next whitespace or end of string)
    const textAfterHash = text.substring(this.hashStartIndex + 1);
    const match = textAfterHash.match(/^[^\s]*/);
    const skillNameLength = match ? match[0].length : 0;
    const skillEndIndex = this.hashStartIndex + 1 + skillNameLength;

    // Replace #skillname with empty string (skill will be applied separately)
    const beforeSkill = text.substring(0, this.hashStartIndex);
    const afterSkill = text.substring(skillEndIndex);
    
    // Trim any extra whitespace
    const newText = (beforeSkill.trimEnd() + ' ' + afterSkill.trimStart()).trim();
    
    this.inputEl.value = newText;
    
    // Set cursor position
    const newCursorPos = beforeSkill.trimEnd().length > 0 ? beforeSkill.trimEnd().length + 1 : 0;
    this.inputEl.selectionStart = newCursorPos;
    this.inputEl.selectionEnd = newCursorPos;

    this.hide();
    this.callbacks.onSelect(skill);
    this.inputEl.focus();
  }
}
