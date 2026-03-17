// Stubbed out - Claude SDK not available in Ele build
// Original functionality requires @anthropic-ai/claude-agent-sdk

import type ElePlugin from '../../../main';

export type TitleGenerationResult =
  | { success: true; title: string }
  | { success: false; error: string };

export type TitleGenerationCallback = (
  conversationId: string,
  result: TitleGenerationResult
) => Promise<void>;

export class TitleGenerationService {
  private plugin: ElePlugin;
  private activeGenerations: Map<string, AbortController> = new Map();

  constructor(plugin: ElePlugin) {
    this.plugin = plugin;
  }

  /**
   * Generates a title for a conversation based on the first user message.
   *
   * STUBBED: Title generation requires Claude SDK, not available in Ele build.
   * Conversations will use default "New Conversation" title.
   */
  async generateTitle(
    conversationId: string,
    _userMessage: string,
    callback: TitleGenerationCallback
  ): Promise<void> {
    // Stub - feature not available without Claude SDK
    // Silently fail so conversations work without auto-generated titles
    await this.safeCallback(callback, conversationId, {
      success: false,
      error: 'Title generation not available (requires Claude SDK)',
    });
  }

  /** Cancels all ongoing title generations. */
  cancel(): void {
    for (const controller of this.activeGenerations.values()) {
      controller.abort();
    }
    this.activeGenerations.clear();
  }

  /** Safely invokes callback with try-catch to prevent unhandled errors. */
  private async safeCallback(
    callback: TitleGenerationCallback,
    conversationId: string,
    result: TitleGenerationResult
  ): Promise<void> {
    try {
      await callback(conversationId, result);
    } catch {
      // Silently ignore callback errors
    }
  }
}
