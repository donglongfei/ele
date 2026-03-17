/**
 * Settings type definitions.
 */

import type { Locale } from '../../i18n/types';
import type { ClaudeModel, ThinkingBudget } from './models';

const UNIX_BLOCKED_COMMANDS = [
  'rm -rf',
  'chmod 777',
  'chmod -R 777',
];

/** Platform-specific blocked commands (Windows - both CMD and PowerShell). */
const WINDOWS_BLOCKED_COMMANDS = [
  // CMD commands
  'del /s /q',
  'rd /s /q',
  'rmdir /s /q',
  'format',
  'diskpart',
  // PowerShell Remove-Item variants (full and abbreviated flags)
  'Remove-Item -Recurse -Force',
  'Remove-Item -Force -Recurse',
  'Remove-Item -r -fo',
  'Remove-Item -fo -r',
  'Remove-Item -Recurse',
  'Remove-Item -r',
  // PowerShell aliases for Remove-Item
  'ri -Recurse',
  'ri -r',
  'ri -Force',
  'ri -fo',
  'rm -r -fo',
  'rm -Recurse',
  'rm -Force',
  'del -Recurse',
  'del -Force',
  'erase -Recurse',
  'erase -Force',
  // PowerShell directory removal aliases
  'rd -Recurse',
  'rmdir -Recurse',
  // Dangerous disk/volume commands
  'Format-Volume',
  'Clear-Disk',
  'Initialize-Disk',
  'Remove-Partition',
];

export interface PlatformBlockedCommands {
  unix: string[];
  windows: string[];
}

export function getDefaultBlockedCommands(): PlatformBlockedCommands {
  return {
    unix: [...UNIX_BLOCKED_COMMANDS],
    windows: [...WINDOWS_BLOCKED_COMMANDS],
  };
}

export function getCurrentPlatformKey(): keyof PlatformBlockedCommands {
  return process.platform === 'win32' ? 'windows' : 'unix';
}

export function getCurrentPlatformBlockedCommands(commands: PlatformBlockedCommands): string[] {
  return commands[getCurrentPlatformKey()];
}

/**
 * Get blocked commands for the Bash tool.
 *
 * On Windows, the Bash tool runs in a Git Bash/MSYS2 environment but can still
 * invoke Windows commands (e.g., via `cmd /c` or `powershell`), so both Unix
 * and Windows blocklist patterns are merged.
 */
export function getBashToolBlockedCommands(commands: PlatformBlockedCommands): string[] {
  if (process.platform === 'win32') {
    return Array.from(new Set([...commands.unix, ...commands.windows]));
  }
  return getCurrentPlatformBlockedCommands(commands);
}

/**
 * Platform-specific Claude CLI paths.
 * @deprecated Use HostnameCliPaths instead. Kept for migration from older versions.
 */
export interface PlatformCliPaths {
  macos: string;
  linux: string;
  windows: string;
}

/** Platform key for CLI paths. Used for migration only. */
export type CliPlatformKey = keyof PlatformCliPaths;

/**
 * Map process.platform to CLI platform key.
 * @deprecated Used for migration only.
 */
export function getCliPlatformKey(): CliPlatformKey {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
}

/**
 * Hostname-keyed CLI paths for per-device configuration.
 * Each device stores its path using its hostname as key.
 * This allows settings to sync across devices without conflicts.
 */
export type HostnameCliPaths = Record<string, string>;

/** Permission mode for tool execution. */
export type PermissionMode = 'yolo' | 'plan' | 'normal';

/** User decision from the approval modal. */
export type ApprovalDecision = 'allow' | 'allow-always' | 'deny' | 'cancel';

/**
 * Legacy permission format (pre-CC compatibility).
 * @deprecated Use CCPermissions instead
 */
export interface LegacyPermission {
  toolName: string;
  pattern: string;
  approvedAt: number;
  scope: 'session' | 'always';
}

/**
 * CC-compatible permission rule string.
 * Format: "Tool(pattern)" or "Tool" for all
 * Examples: "Bash(git *)", "Read(*.md)", "WebFetch(domain:github.com)"
 */
export type PermissionRule = string & { readonly __brand: 'PermissionRule' };

/**
 * Create a PermissionRule from a string.
 * @internal Use legacyPermissionToCCRule instead.
 */
export function createPermissionRule(rule: string): PermissionRule {
  return rule as PermissionRule;
}

/**
 * CC-compatible permissions object.
 * Stored in .claude/settings.json for interoperability with Claude Code CLI.
 */
export interface CCPermissions {
  /** Rules that auto-approve tool actions */
  allow?: PermissionRule[];
  /** Rules that auto-deny tool actions (highest persistent priority) */
  deny?: PermissionRule[];
  /** Rules that always prompt for confirmation */
  ask?: PermissionRule[];
  /** Default permission mode */
  defaultMode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'plan';
  /** Additional directories to include in permission scope */
  additionalDirectories?: string[];
}

/**
 * CC-compatible settings stored in .claude/settings.json.
 * These settings are shared with Claude Code CLI.
 */
export interface CCSettings {
  /** JSON Schema reference */
  $schema?: string;
  /** Tool permissions (CC format) */
  permissions?: CCPermissions;
  /** Model override */
  model?: string;
  /** Environment variables (object format) */
  env?: Record<string, string>;
  /** MCP server settings */
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
  disabledMcpjsonServers?: string[];
  /** Plugin enabled state (CC format: { "plugin-id": true/false }) */
  enabledPlugins?: Record<string, boolean>;
  /** Allow additional properties for CC compatibility */
  [key: string]: unknown;
}

/** Saved environment variable configuration. */
export interface EnvSnippet {
  id: string;
  name: string;
  description: string;
  envVars: string;
  contextLimits?: Record<string, number>;  // Optional: context limits for custom models
}

/** Source of a slash command. */
export type SlashCommandSource = 'builtin' | 'user' | 'plugin' | 'sdk';

/** Slash command configuration with Claude Code compatibility. */
export interface SlashCommand {
  id: string;
  name: string;                // Command name used after / (e.g., "review-code")
  description?: string;        // Optional description shown in dropdown
  argumentHint?: string;       // Placeholder text for arguments (e.g., "[file] [focus]")
  allowedTools?: string[];     // Restrict tools when command is used
  model?: ClaudeModel;         // Override model for this command
  content: string;             // Prompt template with placeholders
  source?: SlashCommandSource; // Origin of the command (builtin, user, plugin, sdk)
  // Skill fields (from .claude/skills/ definitions)
  disableModelInvocation?: boolean;  // Disable model invocation for this skill
  userInvocable?: boolean;           // Whether user can invoke this skill directly
  context?: 'fork';                  // Subagent execution mode
  agent?: string;                    // Subagent type when context='fork'
  hooks?: Record<string, unknown>;   // Pass-through to SDK
}

/** Keyboard navigation settings for vim-style scrolling. */
export interface KeyboardNavigationSettings {
  scrollUpKey: string;         // Key to scroll up when focused on messages (default: 'w')
  scrollDownKey: string;       // Key to scroll down when focused on messages (default: 's')
  focusInputKey: string;       // Key to focus input (default: 'i', like vim insert mode)
}

/** Tab bar position setting. */
export type TabBarPosition = 'input' | 'header';

/**
 * Claudian-specific settings stored in .opencode/opencodian-settings.json.
 * These settings are NOT shared with OpenClaw Gateway.
 */
export interface ClaudianSettings {
  // User preferences
  userName: string;

  // OpenClaw Gateway connection
  openClawGatewayUrl: string;  // WebSocket URL for OpenClaw Gateway (default: ws://127.0.0.1:18789)
  openClawAuthToken: string;   // Authentication token for OpenClaw Gateway (for initial pairing)
  openClawDeviceToken: string; // Device token after successful pairing
  openClawSessionId: string;   // Session ID to use for agent requests (get from 'openclaw sessions')

  // Device Pairing credentials (persisted after first pairing)
  deviceId: string;            // Derived from publicKey (SHA-256 hash)
  devicePublicKey: string;     // Ed25519 public key (base64url encoded)
  devicePrivateKeyJwk: string; // Ed25519 private key (JWK format, JSON stringified)

  // Security (Claudian-specific, CC uses permissions.deny instead)
  enableBlocklist: boolean;
  blockedCommands: PlatformBlockedCommands;
  permissionMode: PermissionMode;

  // Model & thinking (using Kimi models instead of Claude)
  model: ClaudeModel;
  thinkingBudget: ThinkingBudget;
  reasoningEnabled: boolean;  // Show reasoning/thinking process to user
  enableAutoTitleGeneration: boolean;
  titleGenerationModel: string;  // Model for auto title generation (empty = auto)
  show1MModel: boolean;  // Show Sonnet (1M) in model selector (deprecated for Kimi)
  enableChrome: boolean;  // Enable Chrome extension support (passes --chrome flag)
  enableBangBash: boolean;  // Enable ! bash mode for direct command execution

  // Content settings
  excludedTags: string[];
  mediaFolder: string;
  systemPrompt: string;
  allowedExportPaths: string[];
  persistentExternalContextPaths: string[];  // Paths that persist across all sessions

  // Environment (string format, OpenClaw uses object format in Gateway config)
  environmentVariables: string;
  envSnippets: EnvSnippet[];
  /**
   * Custom context window limits for models configured via environment variables.
   * Keys are model IDs (from ANTHROPIC_MODEL, ANTHROPIC_DEFAULT_*_MODEL env vars).
   * Values are token counts in range [1000, 10000000].
   * Empty object means all models use default context limits (200k for Kimi K2.5).
   */
  customContextLimits: Record<string, number>;

  // UI settings
  keyboardNavigation: KeyboardNavigationSettings;

  // Internationalization
  locale: Locale;  // UI language setting

  // Deprecated: CLI paths removed - Ele uses OpenClaw Gateway, not Claude CLI
  // claudeCliPath?: string;  // REMOVED: Not applicable for OpenClaw
  // claudeCliPathsByHost?: HostnameCliPaths;  // REMOVED: Not applicable for OpenClaw
  // loadUserClaudeSettings?: boolean;  // REMOVED: Not applicable for OpenClaw

  // State (merged from data.json)
  lastClaudeModel?: ClaudeModel;
  lastCustomModel?: ClaudeModel;
  lastEnvHash?: string;

  // Slash commands (loaded separately from .claude/commands/)
  slashCommands: SlashCommand[];

  // UI preferences
  maxTabs: number;  // Maximum number of chat tabs (3-10, default 3)
  tabBarPosition: TabBarPosition;  // Where to show tab bar ('input' or 'header')
  enableAutoScroll: boolean;  // Enable auto-scroll during streaming (default: true)
  openInMainTab: boolean;  // Open chat panel in main editor area instead of sidebar

  // Slash commands
  hiddenSlashCommands: string[];  // Command names to hide from dropdown (user preference)
}

/** Default Claudian-specific settings. */
export const DEFAULT_SETTINGS: ClaudianSettings = {
  // User preferences
  userName: '',

  // OpenClaw Gateway
  openClawGatewayUrl: 'ws://127.0.0.1:18789',
  openClawAuthToken: '',  // Must be configured by user
  openClawDeviceToken: '', // Saved after first successful pairing
  openClawSessionId: '',  // Optional: configure session ID (or leave empty to auto-detect)

  // Device Pairing credentials (generated on first connection)
  deviceId: '',
  devicePublicKey: '',
  devicePrivateKeyJwk: '',

  // Security
  enableBlocklist: true,
  blockedCommands: getDefaultBlockedCommands(),
  permissionMode: 'yolo',

  // Model & thinking (default to Kimi K2.5)
  model: 'kimi-k2.5',
  thinkingBudget: 'medium',
  reasoningEnabled: true,  // Show reasoning by default
  enableAutoTitleGeneration: true,
  titleGenerationModel: '',  // Empty = auto (kimi-k1.5 for speed)
  show1MModel: false,  // Deprecated for Kimi
  enableChrome: false,  // Disabled by default
  enableBangBash: false,  // Disabled by default

  // Content settings
  excludedTags: [],
  mediaFolder: '',
  systemPrompt: '',
  allowedExportPaths: ['~/Desktop', '~/Downloads'],
  persistentExternalContextPaths: [],

  // Environment
  environmentVariables: '',
  envSnippets: [],
  customContextLimits: {},

  // UI settings
  keyboardNavigation: {
    scrollUpKey: 'w',
    scrollDownKey: 's',
    focusInputKey: 'i',
  },

  // Internationalization
  locale: 'en',  // Default to English

  // Deprecated: CLI paths removed - Ele uses OpenClaw Gateway
  // claudeCliPath, claudeCliPathsByHost, loadUserClaudeSettings removed

  lastClaudeModel: 'kimi-k2.5',
  lastCustomModel: '',
  lastEnvHash: '',

  // Slash commands (loaded separately)
  slashCommands: [],

  // UI preferences
  maxTabs: 3,  // Default to 3 tabs (safe resource usage)
  tabBarPosition: 'input',  // Default to input mode (current behavior)
  enableAutoScroll: true,  // Default to auto-scroll enabled
  openInMainTab: false,  // Default to sidebar (current behavior)

  // Slash commands
  hiddenSlashCommands: [],  // No commands hidden by default
};

/** Default CC-compatible settings. */
export const DEFAULT_CC_SETTINGS: CCSettings = {
  $schema: 'https://json.schemastore.org/claude-code-settings.json',
  permissions: {
    allow: [],
    deny: [],
    ask: [],
  },
};

/** Default CC permissions. */
export const DEFAULT_CC_PERMISSIONS: CCPermissions = {
  allow: [],
  deny: [],
  ask: [],
};

/** Result from instruction refinement agent query. */
export interface InstructionRefineResult {
  success: boolean;
  refinedInstruction?: string;  // The refined instruction text
  clarification?: string;       // Agent's clarifying question (if any)
  error?: string;               // Error message (if failed)
}

/**
 * Convert a legacy permission to CC permission rule format.
 * Examples:
 *   { toolName: "Bash", pattern: "git *" } → "Bash(git *)"
 *   { toolName: "Read", pattern: "/path/to/file" } → "Read(/path/to/file)"
 *   { toolName: "WebSearch", pattern: "*" } → "WebSearch"
 */
export function legacyPermissionToCCRule(legacy: LegacyPermission): PermissionRule {
  const pattern = legacy.pattern.trim();

  // If pattern is empty, wildcard, or JSON object (old format), just use tool name
  if (!pattern || pattern === '*' || pattern.startsWith('{')) {
    return createPermissionRule(legacy.toolName);
  }

  return createPermissionRule(`${legacy.toolName}(${pattern})`);
}

/**
 * Convert legacy permissions array to CC permissions object.
 * Only 'always' scope permissions are converted (session = ephemeral).
 */
export function legacyPermissionsToCCPermissions(
  legacyPermissions: LegacyPermission[]
): CCPermissions {
  const allow: PermissionRule[] = [];

  for (const perm of legacyPermissions) {
    if (perm.scope === 'always') {
      allow.push(legacyPermissionToCCRule(perm));
    }
  }

  return {
    allow: [...new Set(allow)],  // Deduplicate
    deny: [],
    ask: [],
  };
}

/**
 * Parse a CC permission rule into tool name and pattern.
 * Examples:
 *   "Bash(git *)" → { tool: "Bash", pattern: "git *" }
 *   "Read" → { tool: "Read", pattern: undefined }
 *   "WebFetch(domain:github.com)" → { tool: "WebFetch", pattern: "domain:github.com" }
 */
export function parseCCPermissionRule(rule: PermissionRule): {
  tool: string;
  pattern?: string;
} {
  const match = rule.match(/^(\w+)(?:\((.+)\))?$/);
  if (!match) {
    return { tool: rule };
  }

  const [, tool, pattern] = match;
  return { tool, pattern };
}
