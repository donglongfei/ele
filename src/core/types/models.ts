/**
 * Model type definitions and constants.
 */

/** Model identifier (string to support custom models via environment variables). */
export type KimiModel = string;

/** Legacy type alias for backwards compatibility during migration */
export type ClaudeModel = KimiModel;

export const DEFAULT_KIMI_MODELS: { value: KimiModel; label: string; description: string }[] = [
  { value: 'kimi-k2.5', label: 'Kimi K2.5', description: 'Most capable - 200k context, thinking mode' },
  { value: 'kimi-k2.5-thinking', label: 'Kimi K2.5 Thinking', description: 'Extended reasoning capabilities' },
  { value: 'kimi-k1.5', label: 'Kimi K1.5', description: 'Fast and efficient' },
];

/** Legacy export for backwards compatibility */
export const DEFAULT_CLAUDE_MODELS = DEFAULT_KIMI_MODELS;

export interface ModelConfig {
  model: string;
}

/** Resolves a model to its configuration. */
export function resolveModelConfig(model: string): ModelConfig {
  if (!model || typeof model !== 'string') {
    throw new Error('resolveModelConfig: model is required and must be a non-empty string');
  }
  return { model };
}

/** Legacy function for backwards compatibility (OpenClaw doesn't use SDK betas) */
export function resolveModelWithBetas(model: string, _include1MBeta = false): ModelConfig {
  return resolveModelConfig(model);
}

export type ThinkingBudget = 'off' | 'low' | 'medium' | 'high' | 'adaptive';

export const THINKING_BUDGETS: { value: ThinkingBudget; label: string; tokens: number | null; description: string }[] = [
  { value: 'off', label: 'Off', tokens: 0, description: 'No extended thinking' },
  { value: 'low', label: 'Low', tokens: 4000, description: '~4K thinking tokens' },
  { value: 'medium', label: 'Med', tokens: 8000, description: '~8K thinking tokens' },
  { value: 'high', label: 'High', tokens: 16000, description: '~16K thinking tokens' },
  { value: 'adaptive', label: 'Auto', tokens: null, description: 'Adaptive based on complexity' },
];

/** Default thinking budget per model. */
export const DEFAULT_THINKING_BUDGET: Record<string, ThinkingBudget> = {
  'kimi-k1.5': 'off',
  'kimi-k2.5': 'medium',
  'kimi-k2.5-thinking': 'high',
  'claude-opus-4-6': 'adaptive',
};

export const CONTEXT_WINDOW_STANDARD = 200_000;
export const CONTEXT_WINDOW_KIMI_K2_5 = 200_000;

export function getContextWindowSize(
  model: string,
  _is1MEnabled = false,
  customLimits?: Record<string, number>
): number {
  if (customLimits && model in customLimits) {
    const limit = customLimits[model];
    if (typeof limit === 'number' && limit > 0 && !isNaN(limit) && isFinite(limit)) {
      return limit;
    }
  }

  // Kimi K2.5 models have 200k context window
  if (model.includes('kimi-k2.5')) {
    return CONTEXT_WINDOW_KIMI_K2_5;
  }
  return CONTEXT_WINDOW_STANDARD;
}
