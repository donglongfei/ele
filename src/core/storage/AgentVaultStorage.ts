import { serializeAgent } from '../../utils/agent';
import { buildAgentFromFrontmatter, parseAgentFile } from '../agents/AgentStorage';
import type { AgentDefinition } from '../types';
import type { VaultFileAdapter } from './VaultFileAdapter';

export const AGENTS_PATH = '.ele/agents';
export const LEGACY_AGENTS_PATH = '.claude/agents';

export class AgentVaultStorage {
  constructor(private adapter: VaultFileAdapter) {}

  async loadAll(): Promise<AgentDefinition[]> {
    const agents: AgentDefinition[] = [];
    const seenIds = new Set<string>();

    // Helper to load from a path
    const loadFromPath = async (basePath: string) => {
      try {
        if (!(await this.adapter.exists(basePath))) {
          return;
        }

        const files = await this.adapter.listFiles(basePath);

        for (const filePath of files) {
          if (!filePath.endsWith('.md')) continue;

          try {
            const content = await this.adapter.read(filePath);
            const parsed = parseAgentFile(content);
            if (!parsed) continue;

            const { frontmatter, body } = parsed;
            const agentId = frontmatter.name;

            if (seenIds.has(agentId)) {
              continue; // Skip duplicates
            }

            agents.push(buildAgentFromFrontmatter(frontmatter, body, {
              id: agentId,
              source: 'vault',
              filePath,
            }));

            seenIds.add(agentId);
          } catch { /* Non-critical: skip malformed agent files */ }
        }
      } catch { /* Non-critical: directory may not exist yet */ }
    };

    // Load from new path first
    await loadFromPath(AGENTS_PATH);

    // Load from legacy path (skip duplicates)
    await loadFromPath(LEGACY_AGENTS_PATH);

    return agents;
  }

  async load(agent: AgentDefinition): Promise<AgentDefinition | null> {
    // Try new path first, then legacy
    for (const basePath of [AGENTS_PATH, LEGACY_AGENTS_PATH]) {
      const filePath = this.resolvePath(agent, basePath);
      try {
        if (!(await this.adapter.exists(filePath))) {
          continue;
        }

        const content = await this.adapter.read(filePath);
        const parsed = parseAgentFile(content);
        if (!parsed) continue;

        const { frontmatter, body } = parsed;
        return buildAgentFromFrontmatter(frontmatter, body, {
          id: frontmatter.name,
          source: agent.source,
          filePath,
        });
      } catch (error) {
        if (this.isFileNotFoundError(error)) {
          continue;
        }
        throw error;
      }
    }

    return null;
  }

  async save(agent: AgentDefinition): Promise<void> {
    await this.adapter.write(this.resolvePath(agent), serializeAgent(agent));
  }

  async delete(agent: AgentDefinition): Promise<void> {
    // Delete from both paths to ensure cleanup
    for (const basePath of [AGENTS_PATH, LEGACY_AGENTS_PATH]) {
      try {
        const filePath = this.resolvePath(agent, basePath);
        if (await this.adapter.exists(filePath)) {
          await this.adapter.delete(filePath);
        }
      } catch {
        // Ignore errors
      }
    }
  }

  private resolvePath(agent: AgentDefinition, basePath = AGENTS_PATH): string {
    if (!agent.filePath) {
      return `${basePath}/${agent.name}.md`;
    }

    const normalized = agent.filePath.replace(/\\/g, '/');

    // Check if filePath contains the new path
    let idx = normalized.lastIndexOf(`${AGENTS_PATH}/`);
    if (idx !== -1) {
      return normalized.slice(idx);
    }

    // Check if filePath contains the legacy path
    idx = normalized.lastIndexOf(`${LEGACY_AGENTS_PATH}/`);
    if (idx !== -1) {
      // Map legacy path to new path
      const relativePath = normalized.slice(idx + LEGACY_AGENTS_PATH.length + 1);
      return `${AGENTS_PATH}/${relativePath}`;
    }

    return `${basePath}/${agent.name}.md`;
  }

  private isFileNotFoundError(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === 'string') {
      return /enoent|not found|no such file/i.test(error);
    }

    if (typeof error === 'object') {
      const maybeCode = (error as { code?: unknown }).code;
      if (typeof maybeCode === 'string' && /enoent|not.?found/i.test(maybeCode)) {
        return true;
      }

      const maybeMessage = (error as { message?: unknown }).message;
      if (typeof maybeMessage === 'string' && /enoent|not found|no such file/i.test(maybeMessage)) {
        return true;
      }
    }

    return false;
  }
}
