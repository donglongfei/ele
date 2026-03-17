/**
 * OpenCodianSettingsStorage - Handles opencodian-settings.json read/write.
 *
 * Manages the .opencode/opencodian-settings.json file for OpenCodian-specific settings.
 * These settings are NOT shared with OpenClaw Gateway.
 *
 * Includes:
 * - User preferences (userName)
 * - OpenClaw Gateway connection (gatewayUrl)
 * - Security (blocklist, permission mode)
 * - Model & thinking settings (Kimi models)
 * - Content settings (tags, media, prompts)
 * - Environment (string format, snippets)
 * - UI settings (keyboard navigation)
 * - State (merged from data.json)
 * - Note: CLI paths removed - Ele uses OpenClaw Gateway
 */

import type { ClaudeModel, ClaudianSettings, PlatformBlockedCommands } from '../types';
import { DEFAULT_SETTINGS, getDefaultBlockedCommands } from '../types';
import type { VaultFileAdapter } from './VaultFileAdapter';

/** Path to OpenCodian settings file relative to vault root. */
export const OPENCODIAN_SETTINGS_PATH = '.opencode/opencodian-settings.json';

/** Legacy path for migration support. */
export const LEGACY_CLAUDIAN_SETTINGS_PATH = '.claude/claudian-settings.json';

/** Fields that are loaded separately (slash commands from .opencode/commands/). */
type SeparatelyLoadedFields = 'slashCommands';

/** Settings stored in .opencode/opencodian-settings.json. */
export type StoredOpenCodianSettings = Omit<ClaudianSettings, SeparatelyLoadedFields>;

function normalizeCommandList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function normalizeBlockedCommands(value: unknown): PlatformBlockedCommands {
  const defaults = getDefaultBlockedCommands();

  // Migrate old string[] format to new platform-keyed structure
  if (Array.isArray(value)) {
    return {
      unix: normalizeCommandList(value, defaults.unix),
      windows: [...defaults.windows],
    };
  }

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const candidate = value as Record<string, unknown>;
  return {
    unix: normalizeCommandList(candidate.unix, defaults.unix),
    windows: normalizeCommandList(candidate.windows, defaults.windows),
  };
}

// Note: normalizeHostnameCliPaths removed - CLI paths not used with OpenClaw Gateway

export class OpenCodianSettingsStorage {
  constructor(private adapter: VaultFileAdapter) { }

  /**
  * Load OpenCodian settings from .opencode/opencodian-settings.json.
  * Returns default settings if file doesn't exist.
  * Throws if file exists but cannot be read or parsed.
  */
  async load(): Promise<StoredOpenCodianSettings> {
    // Try new path first
    if (await this.adapter.exists(OPENCODIAN_SETTINGS_PATH)) {
      return this.loadFromPath(OPENCODIAN_SETTINGS_PATH);
    }

    // Fall back to legacy path for migration
    if (await this.adapter.exists(LEGACY_CLAUDIAN_SETTINGS_PATH)) {
      const settings = await this.loadFromPath(LEGACY_CLAUDIAN_SETTINGS_PATH);
      // Auto-migrate to new path
      await this.save(settings);
      return settings;
    }

    return this.getDefaults();
  }

  private async loadFromPath(path: string): Promise<StoredOpenCodianSettings> {
    const content = await this.adapter.read(path);
    const stored = JSON.parse(content) as Record<string, unknown>;
    const { activeConversationId: _activeConversationId, ...storedWithoutLegacy } = stored;

    const blockedCommands = normalizeBlockedCommands(stored.blockedCommands);

    return {
      ...this.getDefaults(),
      ...storedWithoutLegacy,
      blockedCommands,
      // Note: CLI paths removed - Ele uses OpenClaw Gateway
    } as StoredOpenCodianSettings;
  }

  async save(settings: StoredOpenCodianSettings): Promise<void> {
    const content = JSON.stringify(settings, null, 2);
    await this.adapter.write(OPENCODIAN_SETTINGS_PATH, content);
  }

  async exists(): Promise<boolean> {
    return (
      (await this.adapter.exists(OPENCODIAN_SETTINGS_PATH)) ||
      (await this.adapter.exists(LEGACY_CLAUDIAN_SETTINGS_PATH))
    );
  }

  async update(updates: Partial<StoredOpenCodianSettings>): Promise<void> {
    const current = await this.load();
    await this.save({ ...current, ...updates });
  }

  /**
   * Read legacy activeConversationId from settings, if present.
   * Used only for one-time migration to tabManagerState.
   */
  async getLegacyActiveConversationId(): Promise<string | null> {
    const path = await this.adapter.exists(OPENCODIAN_SETTINGS_PATH)
      ? OPENCODIAN_SETTINGS_PATH
      : LEGACY_CLAUDIAN_SETTINGS_PATH;

    if (!(await this.adapter.exists(path))) {
      return null;
    }

    const content = await this.adapter.read(path);
    const stored = JSON.parse(content) as Record<string, unknown>;
    const value = stored.activeConversationId;

    if (typeof value === 'string') {
      return value;
    }

    return null;
  }

  /**
   * Remove legacy activeConversationId from settings.
   */
  async clearLegacyActiveConversationId(): Promise<void> {
    const path = await this.adapter.exists(OPENCODIAN_SETTINGS_PATH)
      ? OPENCODIAN_SETTINGS_PATH
      : LEGACY_CLAUDIAN_SETTINGS_PATH;

    if (!(await this.adapter.exists(path))) {
      return;
    }

    const content = await this.adapter.read(path);
    const stored = JSON.parse(content) as Record<string, unknown>;

    if (!('activeConversationId' in stored)) {
      return;
    }

    delete stored.activeConversationId;
    const nextContent = JSON.stringify(stored, null, 2);
    await this.adapter.write(path, nextContent);
  }

  async setLastModel(model: ClaudeModel, isCustom: boolean): Promise<void> {
    if (isCustom) {
      await this.update({ lastCustomModel: model });
    } else {
      await this.update({ lastClaudeModel: model });
    }
  }

  async setLastEnvHash(hash: string): Promise<void> {
    await this.update({ lastEnvHash: hash });
  }

  /**
   * Get default settings (excluding separately loaded fields).
   */
  private getDefaults(): StoredOpenCodianSettings {
    const {
      slashCommands: _,
      ...defaults
    } = DEFAULT_SETTINGS;

    return defaults;
  }
}

/**
 * Legacy export for backwards compatibility.
 * @deprecated Use OpenCodianSettingsStorage instead
 */
export const ClaudianSettingsStorage = OpenCodianSettingsStorage;
export const CLAUDIAN_SETTINGS_PATH = OPENCODIAN_SETTINGS_PATH;
export type StoredClaudianSettings = StoredOpenCodianSettings;
