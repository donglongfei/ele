/**
 * CCSettingsStorage - Handles OpenClaw-compatible settings.json read/write.
 *
 * Manages the .opencode/settings.json file in OpenClaw compatible format.
 * This file is compatible with OpenClaw Gateway configuration.
 *
 * Only OpenClaw-compatible fields are stored here:
 * - permissions (allow/deny/ask)
 * - model (optional override)
 * - env (optional environment variables)
 *
 * OpenCodian-specific settings go in opencodian-settings.json.
 */

import type {
  CCPermissions,
  CCSettings,
  LegacyPermission,
  PermissionRule,
} from '../types';
import {
  DEFAULT_CC_PERMISSIONS,
  DEFAULT_CC_SETTINGS,
  legacyPermissionsToCCPermissions,
} from '../types';
import { CLAUDIAN_ONLY_FIELDS } from './migrationConstants';
import type { VaultFileAdapter } from './VaultFileAdapter';

/** Path to OpenClaw settings file relative to vault root. */
export const CC_SETTINGS_PATH = '.opencode/settings.json';

/** Legacy path for migration support. */
export const LEGACY_CC_SETTINGS_PATH = '.claude/settings.json';

/** Schema URL for OpenClaw settings (compatible with Claude Code format). */
const CC_SETTINGS_SCHEMA = 'https://json.schemastore.org/claude-code-settings.json';

function hasClaudianOnlyFields(data: Record<string, unknown>): boolean {
  return Object.keys(data).some(key => CLAUDIAN_ONLY_FIELDS.has(key));
}

/**
 * Check if a settings object uses the legacy Claudian permissions format.
 * Legacy format: permissions is an array of objects with toolName/pattern.
 */
export function isLegacyPermissionsFormat(data: unknown): data is { permissions: LegacyPermission[] } {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.permissions)) return false;
  if (obj.permissions.length === 0) return false;

  // Check if first item has legacy structure
  const first = obj.permissions[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'toolName' in first &&
    'pattern' in first
  );
}

function normalizeRuleList(value: unknown): PermissionRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is string => typeof r === 'string') as PermissionRule[];
}

function normalizePermissions(permissions: unknown): CCPermissions {
  if (!permissions || typeof permissions !== 'object') {
    return { ...DEFAULT_CC_PERMISSIONS };
  }

  const p = permissions as Record<string, unknown>;
  return {
    allow: normalizeRuleList(p.allow),
    deny: normalizeRuleList(p.deny),
    ask: normalizeRuleList(p.ask),
    defaultMode: typeof p.defaultMode === 'string' ? p.defaultMode as CCPermissions['defaultMode'] : undefined,
    additionalDirectories: Array.isArray(p.additionalDirectories)
      ? p.additionalDirectories.filter((d): d is string => typeof d === 'string')
      : undefined,
  };
}

/**
 * Storage for CC-compatible settings.
 *
 * Note: Permission update methods (addAllowRule, addDenyRule, etc.) use a
 * read-modify-write pattern. Concurrent calls may race and lose updates.
 * In practice this is fine since user interactions are sequential.
 */
export class CCSettingsStorage {
  constructor(private adapter: VaultFileAdapter) { }

  /**
   * Load CC settings from .claude/settings.json.
   * Returns default settings if file doesn't exist.
   * Throws if file exists but cannot be read or parsed.
   */
  async load(): Promise<CCSettings> {
    // Try new path first
    let path = CC_SETTINGS_PATH;
    let shouldMigrate = false;

    if (!(await this.adapter.exists(CC_SETTINGS_PATH))) {
      // Check legacy path
      if (await this.adapter.exists(LEGACY_CC_SETTINGS_PATH)) {
        path = LEGACY_CC_SETTINGS_PATH;
        shouldMigrate = true;
      } else {
        return { ...DEFAULT_CC_SETTINGS };
      }
    }

    const content = await this.adapter.read(path);
    const stored = JSON.parse(content) as Record<string, unknown>;

    // Check for legacy format and migrate if needed
    if (isLegacyPermissionsFormat(stored)) {
      const legacyPerms = stored.permissions as LegacyPermission[];
      const ccPerms = legacyPermissionsToCCPermissions(legacyPerms);

      // Return migrated permissions but keep other CC fields
      const migrated = {
        $schema: CC_SETTINGS_SCHEMA,
        ...stored,
        permissions: ccPerms,
      };

      // Auto-migrate to new path if loading from legacy
      if (shouldMigrate) {
        await this.save(migrated, true);
      }

      return migrated;
    }

    const result = {
      $schema: CC_SETTINGS_SCHEMA,
      ...stored,
      permissions: normalizePermissions(stored.permissions),
    };

    // Auto-migrate to new path if loading from legacy
    if (shouldMigrate) {
      await this.save(result);
    }

    return result;
  }

  /**
   * Save OpenClaw settings to .opencode/settings.json.
   * Preserves unknown fields for compatibility.
   *
   * @param stripClaudianFields - If true, remove Claudian-only fields (only during migration)
   */
  async save(settings: CCSettings, stripClaudianFields: boolean = false): Promise<void> {
    // Load existing to preserve fields we don't manage
    let existing: Record<string, unknown> = {};
    if (await this.adapter.exists(CC_SETTINGS_PATH)) {
      try {
        const content = await this.adapter.read(CC_SETTINGS_PATH);
        const parsed = JSON.parse(content) as Record<string, unknown>;

        // Only strip Claudian-only fields during explicit migration
        if (stripClaudianFields && (isLegacyPermissionsFormat(parsed) || hasClaudianOnlyFields(parsed))) {
          existing = {};
          for (const [key, value] of Object.entries(parsed)) {
            if (!CLAUDIAN_ONLY_FIELDS.has(key)) {
              existing[key] = value;
            }
          }
          // Also strip legacy permissions array format
          if (Array.isArray(existing.permissions)) {
            delete existing.permissions;
          }
        } else {
          existing = parsed;
        }
      } catch {
        // Parse error - start fresh with default settings
      }
    }

    // Merge: existing fields + our updates
    const merged: CCSettings = {
      ...existing,
      $schema: CC_SETTINGS_SCHEMA,
      permissions: settings.permissions ?? { ...DEFAULT_CC_PERMISSIONS },
    };

    const content = JSON.stringify(merged, null, 2);
    await this.adapter.write(CC_SETTINGS_PATH, content);
  }

  async exists(): Promise<boolean> {
    return (
      (await this.adapter.exists(CC_SETTINGS_PATH)) ||
      (await this.adapter.exists(LEGACY_CC_SETTINGS_PATH))
    );
  }

  async getPermissions(): Promise<CCPermissions> {
    const settings = await this.load();
    return settings.permissions ?? { ...DEFAULT_CC_PERMISSIONS };
  }

  async updatePermissions(permissions: CCPermissions): Promise<void> {
    const settings = await this.load();
    settings.permissions = permissions;
    await this.save(settings);
  }

  async addAllowRule(rule: PermissionRule): Promise<void> {
    const permissions = await this.getPermissions();
    if (!permissions.allow?.includes(rule)) {
      permissions.allow = [...(permissions.allow ?? []), rule];
      await this.updatePermissions(permissions);
    }
  }

  async addDenyRule(rule: PermissionRule): Promise<void> {
    const permissions = await this.getPermissions();
    if (!permissions.deny?.includes(rule)) {
      permissions.deny = [...(permissions.deny ?? []), rule];
      await this.updatePermissions(permissions);
    }
  }

  async addAskRule(rule: PermissionRule): Promise<void> {
    const permissions = await this.getPermissions();
    if (!permissions.ask?.includes(rule)) {
      permissions.ask = [...(permissions.ask ?? []), rule];
      await this.updatePermissions(permissions);
    }
  }

  /**
   * Remove a rule from all lists.
   */
  async removeRule(rule: PermissionRule): Promise<void> {
    const permissions = await this.getPermissions();
    permissions.allow = permissions.allow?.filter(r => r !== rule);
    permissions.deny = permissions.deny?.filter(r => r !== rule);
    permissions.ask = permissions.ask?.filter(r => r !== rule);
    await this.updatePermissions(permissions);
  }
}
