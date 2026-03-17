// Stubbed out - Claude SDK not available in Ele build
// Original functionality requires @anthropic-ai/claude-agent-sdk

import { type InstructionRefineResult } from '../../../core/types';
import type ElePlugin from '../../../main';

export type RefineProgressCallback = (update: InstructionRefineResult) => void;

export class InstructionRefineService {
  private plugin: ElePlugin;
  private abortController: AbortController | null = null;
  private sessionId: string | null = null;
  private existingInstructions: string = '';

  constructor(plugin: ElePlugin) {
    this.plugin = plugin;
  }

  /** Resets conversation state for a new refinement session. */
  resetConversation(): void {
    this.sessionId = null;
  }

  /**
   * Refines a raw instruction from user input.
   *
   * STUBBED: Instruction refinement requires Claude SDK, not available in Ele build.
   */
  async refineInstruction(
    _rawInstruction: string,
    _existingInstructions: string,
    _onProgress?: RefineProgressCallback
  ): Promise<InstructionRefineResult> {
    return {
      success: false,
      error: 'Instruction refinement not available (requires Claude SDK)',
    };
  }

  /** Continues conversation with a follow-up message (for clarifications). */
  async continueConversation(
    _message: string,
    _onProgress?: RefineProgressCallback
  ): Promise<InstructionRefineResult> {
    return {
      success: false,
      error: 'Instruction refinement not available (requires Claude SDK)',
    };
  }

  /** Cancels any ongoing query. */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
