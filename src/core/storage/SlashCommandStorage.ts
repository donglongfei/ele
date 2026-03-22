import { parsedToSlashCommand, parseSlashCommandContent, serializeCommand } from '../../utils/slashCommand';
import type { SlashCommand } from '../types';
import type { VaultFileAdapter } from './VaultFileAdapter';

export const COMMANDS_PATH = '.ele/commands';
export const LEGACY_COMMANDS_PATH = '.claude/commands';

export class SlashCommandStorage {
  constructor(private adapter: VaultFileAdapter) {}

  async loadAll(): Promise<SlashCommand[]> {
    const commands: SlashCommand[] = [];
    const seenIds = new Set<string>();

    // Helper to load from a path
    const loadFromPath = async (basePath: string) => {
      try {
        if (!(await this.adapter.exists(basePath))) {
          return;
        }

        const files = await this.adapter.listFilesRecursive(basePath);

        for (const filePath of files) {
          if (!filePath.endsWith('.md')) continue;

          try {
            const command = await this.loadFromFile(filePath);
            if (command && !seenIds.has(command.id)) {
              commands.push(command);
              seenIds.add(command.id);
            }
          } catch {
            // Non-critical: skip malformed command files
          }
        }
      } catch {
        // Non-critical: directory may not exist yet
      }
    };

    // Load from new path first
    await loadFromPath(COMMANDS_PATH);

    // Load from legacy path (skip duplicates)
    await loadFromPath(LEGACY_COMMANDS_PATH);

    return commands;
  }

  private async loadFromFile(filePath: string): Promise<SlashCommand | null> {
    const content = await this.adapter.read(filePath);
    return this.parseFile(content, filePath);
  }

  async save(command: SlashCommand): Promise<void> {
    const filePath = this.getFilePath(command);
    await this.adapter.write(filePath, serializeCommand(command));
  }

  async delete(commandId: string): Promise<void> {
    // Check both new and legacy paths
    for (const basePath of [COMMANDS_PATH, LEGACY_COMMANDS_PATH]) {
      try {
        if (!(await this.adapter.exists(basePath))) {
          continue;
        }

        const files = await this.adapter.listFilesRecursive(basePath);

        for (const filePath of files) {
          if (!filePath.endsWith('.md')) continue;

          const id = this.filePathToId(filePath);
          if (id === commandId) {
            await this.adapter.delete(filePath);
            // Continue to check other path too
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  getFilePath(command: SlashCommand): string {
    const safeName = command.name.replace(/[^a-zA-Z0-9_/-]/g, '-');
    return `${COMMANDS_PATH}/${safeName}.md`;
  }

  private parseFile(content: string, filePath: string): SlashCommand {
    const parsed = parseSlashCommandContent(content);
    return parsedToSlashCommand(parsed, {
      id: this.filePathToId(filePath),
      name: this.filePathToName(filePath),
    });
  }

  private filePathToId(filePath: string): string {
    // Encoding: escape `-` as `-_`, then replace `/` with `--`
    // This is unambiguous and reversible:
    //   a/b.md   -> cmd-a--b
    //   a-b.md   -> cmd-a-_b
    //   a--b.md  -> cmd-a-_-_b
    //   a/b-c.md -> cmd-a--b-_c
    const relativePath = filePath
      .replace(`${COMMANDS_PATH}/`, '')
      .replace(/\.md$/, '');
    const escaped = relativePath
      .replace(/-/g, '-_')   // Escape dashes first
      .replace(/\//g, '--'); // Then encode slashes
    return `cmd-${escaped}`;
  }

  private filePathToName(filePath: string): string {
    return filePath
      .replace(`${COMMANDS_PATH}/`, '')
      .replace(/\.md$/, '');
  }
}
