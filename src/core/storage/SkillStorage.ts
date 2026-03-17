import { parsedToSlashCommand, parseSlashCommandContent, serializeCommand } from '../../utils/slashCommand';
import type { SlashCommand } from '../types';
import type { VaultFileAdapter } from './VaultFileAdapter';

export const SKILLS_PATH = '.opencode/skills';
export const LEGACY_SKILLS_PATH = '.claude/skills';

export class SkillStorage {
  constructor(private adapter: VaultFileAdapter) {}

  async loadAll(): Promise<SlashCommand[]> {
    const skills: SlashCommand[] = [];
    const seenNames = new Set<string>();

    // Helper to load from a path
    const loadFromPath = async (basePath: string) => {
      try {
        if (!(await this.adapter.exists(basePath))) {
          return;
        }

        const folders = await this.adapter.listFolders(basePath);

        for (const folder of folders) {
          const skillName = folder.split('/').pop()!;
          if (seenNames.has(skillName)) {
            continue; // Skip duplicates
          }

          const skillPath = `${basePath}/${skillName}/SKILL.md`;

          try {
            if (!(await this.adapter.exists(skillPath))) continue;

            const content = await this.adapter.read(skillPath);
            const parsed = parseSlashCommandContent(content);

            skills.push(parsedToSlashCommand(parsed, {
              id: `skill-${skillName}`,
              name: skillName,
              source: 'user',
            }));

            seenNames.add(skillName);
          } catch {
            // Non-critical: skip malformed skill files
          }
        }
      } catch {
        // Non-critical: directory may not exist
      }
    };

    // Load from new path first
    await loadFromPath(SKILLS_PATH);

    // Load from legacy path (skip duplicates)
    await loadFromPath(LEGACY_SKILLS_PATH);

    return skills;
  }

  async save(skill: SlashCommand): Promise<void> {
    const name = skill.name;
    const dirPath = `${SKILLS_PATH}/${name}`;
    const filePath = `${dirPath}/SKILL.md`;

    await this.adapter.ensureFolder(dirPath);
    await this.adapter.write(filePath, serializeCommand(skill));
  }

  async delete(skillId: string): Promise<void> {
    const name = skillId.replace(/^skill-/, '');

    // Delete from both paths to ensure cleanup
    for (const basePath of [SKILLS_PATH, LEGACY_SKILLS_PATH]) {
      try {
        const dirPath = `${basePath}/${name}`;
        const filePath = `${dirPath}/SKILL.md`;

        if (await this.adapter.exists(filePath)) {
          await this.adapter.delete(filePath);
        }
        if (await this.adapter.exists(dirPath)) {
          await this.adapter.deleteFolder(dirPath);
        }
      } catch {
        // Ignore errors
      }
    }
  }
}
