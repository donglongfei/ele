// Stubbed out - Claude SDK not available in Ele build
// Original functionality requires @anthropic-ai/claude-agent-sdk

import type ElePlugin from '../../main';
import { type CursorContext } from '../../utils/editor';

export type InlineEditMode = 'selection' | 'cursor';

export interface InlineEditSelectionRequest {
  mode: 'selection';
  instruction: string;
  notePath: string;
  selectedText: string;
  startLine?: number;  // 1-indexed
  lineCount?: number;
  contextFiles?: string[];
}

export interface InlineEditCursorRequest {
  mode: 'cursor';
  instruction: string;
  notePath: string;
  cursorContext: CursorContext;
  contextFiles?: string[];
}

export type InlineEditRequest = InlineEditSelectionRequest | InlineEditCursorRequest;

export interface InlineEditResult {
  success: boolean;
  editedText?: string;      // replacement (selection mode)
  insertedText?: string;    // insertion (cursor mode)
  clarification?: string;
  error?: string;
}

/** Parses response text for <replacement> or <insertion> tag. */
export function parseInlineEditResponse(responseText: string): InlineEditResult {
  const replacementMatch = responseText.match(/<replacement>([\s\S]*?)<\/replacement>/);
  if (replacementMatch) {
    return { success: true, editedText: replacementMatch[1] };
  }

  const insertionMatch = responseText.match(/<insertion>([\s\S]*?)<\/insertion>/);
  if (insertionMatch) {
    return { success: true, insertedText: insertionMatch[1] };
  }

  const trimmed = responseText.trim();
  if (trimmed) {
    return { success: true, clarification: trimmed };
  }

  return { success: false, error: 'Empty response' };
}

export class InlineEditService {
  private plugin: ElePlugin;
  private abortController: AbortController | null = null;

  constructor(plugin: ElePlugin) {
    this.plugin = plugin;
  }

  /**
   * Performs inline edit.
   *
   * STUBBED: Inline editing requires Claude SDK, not available in Ele build.
   * Use the main chat interface instead.
   */
  async edit(
    _request: InlineEditRequest,
    _externalContextPaths: string[],
    _onProgress?: (result: InlineEditResult) => void
  ): Promise<InlineEditResult> {
    return {
      success: false,
      error: 'Inline editing not available (requires Claude SDK). Please use the main chat interface.',
    };
  }

  /** Cancels ongoing edit query. */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
