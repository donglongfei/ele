/**
 * Instruction Mode Manager - Combines direct instruction input (#) with skill selection (#skillname)
 * 
 * Two modes:
 * 1. Empty input + # : Enters direct instruction mode (type custom instruction)
 * 2. Anywhere + #skillname : Shows skill dropdown for selection
 */

import { InstructionSkillDropdown } from './InstructionSkillDropdown';

export interface InstructionSkill {
  name: string;
  description?: string;
  content: string;
}

export interface InstructionModeCallbacks {
  onSubmit: (rawInstruction: string) => Promise<void>;
  onSelectSkill: (skill: InstructionSkill) => Promise<void>;
  getInputWrapper: () => HTMLElement | null;
  getInstructionSkills: () => Promise<InstructionSkill[]>;
  resetInputHeight?: () => void;
}

export interface InstructionModeState {
  active: boolean;
  rawInstruction: string;
}

const INSTRUCTION_MODE_PLACEHOLDER = '# Type instruction or select skill';

export class InstructionModeManager {
  private inputEl: HTMLTextAreaElement;
  private callbacks: InstructionModeCallbacks;
  private state: InstructionModeState = { active: false, rawInstruction: '' };
  private isSubmitting = false;
  private originalPlaceholder: string = '';
  private skillDropdown: InstructionSkillDropdown | null = null;

  constructor(
    inputEl: HTMLTextAreaElement,
    callbacks: InstructionModeCallbacks
  ) {
    this.inputEl = inputEl;
    this.callbacks = callbacks;
    this.originalPlaceholder = inputEl.placeholder;
  }

  /**
   * Initializes the skill dropdown component.
   * Should be called after DOM is ready.
   */
  initializeSkillDropdown(containerEl: HTMLElement): void {
    if (this.skillDropdown) return;

    this.skillDropdown = new InstructionSkillDropdown(
      containerEl,
      this.inputEl,
      {
        onSelect: (skill) => void this.handleSkillSelect(skill),
        onHide: () => {
          // Dropdown hidden
        },
        getSkills: () => this.callbacks.getInstructionSkills(),
      }
    );
  }

  /**
   * Handles keydown events.
   * Returns true if the event was consumed.
   */
  handleKeydown(e: KeyboardEvent): boolean {
    // First, let skill dropdown handle navigation if visible
    if (this.skillDropdown?.isVisible()) {
      return this.skillDropdown.handleKeydown(e);
    }

    // Handle keys when in direct instruction mode (legacy mode - can be triggered by settings or special command)
    if (this.state.active) {
      return this.handleDirectModeKey(e);
    }

    return false;
  }

  /**
   * Handle input changes - check for #skillname pattern.
   */
  handleInput(): void {
    // If in direct instruction mode, track the instruction
    if (this.state.active) {
      const text = this.inputEl.value;
      this.state.rawInstruction = text.startsWith('#') ? text.slice(1).trim() : text.trim();
      return;
    }

    // Otherwise, check for #skillname pattern
    if (this.skillDropdown) {
      void this.skillDropdown.checkAndShow();
    }
  }

  /**
   * Handle paste events to detect # at start.
   */
  handlePaste(e: ClipboardEvent): boolean {
    if (this.state.active) return false;

    const pastedText = e.clipboardData?.getData('text') || '';
    const currentValue = this.inputEl.value;
    const selectionStart = this.inputEl.selectionStart || 0;
    const selectionEnd = this.inputEl.selectionEnd || 0;

    // Check if paste starts with # at beginning of input
    if (currentValue === '' && pastedText.startsWith('#')) {
      if (this.enterDirectMode()) {
        // Let default paste happen, then process
        setTimeout(() => {
          this.state.rawInstruction = this.inputEl.value.slice(1).trim();
        }, 0);
        return false;
      }
    }

    // Check if we're pasting at a # trigger
    const textBeforeSelection = currentValue.substring(0, selectionStart);
    if (selectionStart === selectionEnd && textBeforeSelection.endsWith('#')) {
      // Check if paste creates a valid skill name pattern
      const testText = textBeforeSelection + pastedText;
      const hashIndex = testText.lastIndexOf('#');
      const textAfterHash = testText.substring(hashIndex + 1);
      
      if (!/\s/.test(textAfterHash) && this.skillDropdown) {
        setTimeout(() => {
          void this.skillDropdown?.checkAndShow();
        }, 0);
      }
    }

    return false;
  }

  /**
   * Check if any mode is active.
   */
  isActive(): boolean {
    return this.state.active || (this.skillDropdown?.isVisible() ?? false);
  }

  /**
   * Check if direct instruction mode is active.
   */
  isDirectModeActive(): boolean {
    return this.state.active;
  }

  /**
   * Gets the current raw instruction text (for direct mode).
   */
  getRawInstruction(): string {
    return this.state.rawInstruction;
  }

  /**
   * Clears the state.
   */
  clear(): void {
    this.inputEl.value = '';
    this.exitDirectMode();
    this.skillDropdown?.hide();
    this.callbacks.resetInputHeight?.();
  }

  /**
   * Destroys the manager.
   */
  destroy(): void {
    this.exitDirectMode();
    this.skillDropdown?.destroy();
    this.skillDropdown = null;
  }

  // ===== Private methods =====

  private async handleSkillSelect(skill: InstructionSkill): Promise<void> {
    try {
      await this.callbacks.onSelectSkill(skill);
    } catch (error) {
      // Error is handled by callback
    }
    this.callbacks.resetInputHeight?.();
  }

  private enterDirectMode(): boolean {
    const wrapper = this.callbacks.getInputWrapper();
    if (!wrapper) return false;

    wrapper.addClass('ele-input-instruction-mode');
    this.state = { active: true, rawInstruction: '' };
    this.inputEl.placeholder = INSTRUCTION_MODE_PLACEHOLDER;

    return true;
  }

  private exitDirectMode(): void {
    const wrapper = this.callbacks.getInputWrapper();
    if (wrapper) {
      wrapper.removeClass('ele-input-instruction-mode');
    }
    this.state = { active: false, rawInstruction: '' };
    this.inputEl.placeholder = this.originalPlaceholder;
  }

  private handleDirectModeKey(e: KeyboardEvent): boolean {
    switch (e.key) {
      case 'Enter':
        if (!e.shiftKey && !e.isComposing) {
          const rawInstruction = this.state.rawInstruction.trim();
          if (rawInstruction) {
            e.preventDefault();
            void this.submitDirectInstruction();
            return true;
          }
        }
        return false;

      case 'Escape':
        if (!e.isComposing) {
          e.preventDefault();
          this.exitDirectMode();
          this.inputEl.value = '';
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  private async submitDirectInstruction(): Promise<void> {
    if (this.isSubmitting) return;

    const rawInstruction = this.state.rawInstruction.trim();
    if (!rawInstruction) return;

    this.isSubmitting = true;

    try {
      await this.callbacks.onSubmit(rawInstruction);
    } finally {
      this.isSubmitting = false;
    }
  }
}
