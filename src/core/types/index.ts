// Chat types
export {
  type ChatMessage,
  type ContentBlock,
  type Conversation,
  type ConversationMeta,
  type ForkSource,
  type ImageAttachment,
  type ImageMediaType,
  type SessionMetadata,
  type StreamChunk,
  type UsageInfo,
  VIEW_TYPE_ELE,
} from './chat';

// Model types
export {
  type ClaudeModel,
  CONTEXT_WINDOW_KIMI_K2_5,
  CONTEXT_WINDOW_STANDARD,
  DEFAULT_CLAUDE_MODELS,  // Legacy alias
  DEFAULT_KIMI_MODELS,
  DEFAULT_THINKING_BUDGET,
  getContextWindowSize,
  type KimiModel,
  type ModelConfig,
  resolveModelConfig,
  resolveModelWithBetas,  // Legacy compatibility
  THINKING_BUDGETS,
  type ThinkingBudget,
} from './models';

// SDK types
export { type SDKMessage } from './sdk';

// Settings types
export {
  type ApprovalDecision,
  type CCPermissions,
  type CCSettings,
  createPermissionRule,
  DEFAULT_CC_PERMISSIONS,
  DEFAULT_CC_SETTINGS,
  DEFAULT_SETTINGS,
  type EleSettings,
  type EnvSnippet,
  getBashToolBlockedCommands,
  getCurrentPlatformBlockedCommands,
  getCurrentPlatformKey,
  getDefaultBlockedCommands,
  type InstructionRefineResult,
  type KeyboardNavigationSettings,
  type LegacyPermission,
  legacyPermissionsToCCPermissions,
  legacyPermissionToCCRule,
  parseCCPermissionRule,
  type PermissionMode,
  type PermissionRule,
  type PlatformBlockedCommands,
  type SlashCommand,
  type TabBarPosition,
} from './settings';

// Re-export getHostnameKey from utils (moved from settings for architecture compliance)
export { getHostnameKey } from '../../utils/env';

// Diff types
export {
  type DiffLine,
  type DiffStats,
  type SDKToolUseResult,
  type StructuredPatchHunk,
} from './diff';

// Tool types
export {
  type AskUserAnswers,
  type AskUserQuestionItem,
  type AskUserQuestionOption,
  type AsyncSubagentStatus,
  type ExitPlanModeCallback,
  type ExitPlanModeDecision,
  type SubagentInfo,
  type SubagentMode,
  type ToolCallInfo,
  type ToolDiffData,
} from './tools';

// MCP types
export {
  DEFAULT_MCP_SERVER,
  type EleMcpConfigFile,
  type EleMcpServer,
  getMcpServerType,
  isValidMcpServerConfig,
  type McpConfigFile,
  type McpHttpServerConfig,
  type McpServerConfig,
  type McpServerType,
  type McpSSEServerConfig,
  type McpStdioServerConfig,
  type ParsedMcpConfig,
} from './mcp';

// Agent types
export {
  AGENT_PERMISSION_MODES,
  type AgentDefinition,
  type AgentFrontmatter,
  type AgentPermissionMode,
} from './agent';
