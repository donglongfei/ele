import { isSkill, parsedToSlashCommand, parseSlashCommandContent, serializeCommand } from '../../utils/slashCommand';
import type { SlashCommand } from '../types';
import type { VaultFileAdapter } from './VaultFileAdapter';

export const SKILLS_PATH = '.ele/skills';
export const LEGACY_SKILLS_PATH = '.claude/skills';

export class SkillStorage {
  constructor(private adapter: VaultFileAdapter) {}

  async loadAll(): Promise<SlashCommand[]> {
    const skills: SlashCommand[] = [];
    const seenNames = new Set<string>();

    // Helper to load from a path
    const loadFromPath = async (basePath: string) => {
      try {
        const exists = await this.adapter.exists(basePath);
        console.log(`[SkillStorage] Checking ${basePath}: ${exists ? 'exists' : 'not found'}`);
        if (!exists) {
          return;
        }

        const folders = await this.adapter.listFolders(basePath);
        console.log(`[SkillStorage] Found folders in ${basePath}:`, folders);

        for (const folder of folders) {
          const skillName = folder.split('/').pop()!;
          if (seenNames.has(skillName)) {
            console.log(`[SkillStorage] Skipping duplicate: ${skillName}`);
            continue; // Skip duplicates
          }

          const skillPath = `${basePath}/${skillName}/SKILL.md`;

          try {
            const skillExists = await this.adapter.exists(skillPath);
            console.log(`[SkillStorage] Checking ${skillPath}: ${skillExists ? 'exists' : 'not found'}`);
            if (!skillExists) continue;

            const content = await this.adapter.read(skillPath);
            console.log(`[SkillStorage] Reading ${skillPath}, content length: ${content.length}`);
            const parsed = parseSlashCommandContent(content);
            console.log(`[SkillStorage] Parsed ${skillName}:`, { userInvocable: parsed.userInvocable, description: parsed.description });

            skills.push(parsedToSlashCommand(parsed, {
              id: `skill-${skillName}`,
              name: skillName,
              source: 'user',
            }));

            seenNames.add(skillName);
            console.log(`[SkillStorage] Loaded skill: ${skillName}`);
          } catch (err) {
            console.error(`[SkillStorage] Error loading skill ${skillName}:`, err);
            // Non-critical: skip malformed skill files
          }
        }
      } catch (err) {
        console.error(`[SkillStorage] Error loading from ${basePath}:`, err);
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

  /**
   * Load all user-invocable instruction skills.
   * These are skills with `userInvocable: true` that can be directly applied
   * to the system prompt without AI refinement.
   */
  async loadInstructionSkills(): Promise<SlashCommand[]> {
    console.log('[SkillStorage] Loading instruction skills...');
    const allSkills = await this.loadAll();
    console.log(`[SkillStorage] Total skills loaded: ${allSkills.length}`);
    
    const instructionSkills = allSkills.filter(skill => {
      const isSkillType = isSkill(skill);
      const isUserInvocable = skill.userInvocable === true;
      console.log(`[SkillStorage] Checking skill ${skill.name}: isSkill=${isSkillType}, userInvocable=${isUserInvocable}`);
      return isSkillType && isUserInvocable;
    });
    
    console.log(`[SkillStorage] Instruction skills found: ${instructionSkills.length}`);
    return instructionSkills;
  }
}
