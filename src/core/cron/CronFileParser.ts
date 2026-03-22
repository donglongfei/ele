/**
 * Parse cron job definitions from markdown files.
 * Files should be in .ele/cron/*.md format with YAML frontmatter.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { CronFileConfig, CronJob, CronJobConfig, CronJobType } from './types';

interface ParsedCronFile {
  config: CronFileConfig;
  prompt?: string;
  targetFile?: string;
  appendMode?: 'append' | 'overwrite' | 'prepend';
}

export class CronFileParser {
  private vaultPath: string;
  private cronDir: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.cronDir = path.join(vaultPath, '.ele', 'cron');
  }

  /**
   * Check if the cron directory exists.
   */
  hasCronDirectory(): boolean {
    return fs.existsSync(this.cronDir);
  }

  /**
   * Get all cron files in the vault.
   */
  getCronFiles(): string[] {
    if (!this.hasCronDirectory()) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.cronDir);
      return files
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(this.cronDir, f));
    } catch {
      return [];
    }
  }

  /**
   * Parse a single cron file.
   */
  parseFile(filePath: string): ParsedCronFile | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      console.error(`[CronFileParser] Failed to parse ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse markdown content with YAML frontmatter.
   */
  parseContent(content: string): ParsedCronFile | null {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return null;
    }

    const yamlContent = frontmatterMatch[1];
    const bodyContent = frontmatterMatch[2].trim();

    // Parse YAML frontmatter
    const config = this.parseYaml(yamlContent);
    if (!config || !config.frequency || !config.type) {
      return null;
    }

    // Extract prompt and target from body
    const { prompt, targetFile, appendMode } = this.parseBody(bodyContent);

    // Build the complete config with required fields
    const completeConfig: CronFileConfig = {
      name: config.name,
      description: config.description,
      enabled: config.enabled,
      frequency: config.frequency,
      time: config.time,
      cronExpression: config.cronExpression,
      type: config.type,
      model: config.model,
      targetFile: config.targetFile || targetFile,
      appendMode: config.appendMode || appendMode,
      prompt: config.prompt || prompt,
    };

    return {
      config: completeConfig,
      prompt,
      targetFile,
      appendMode,
    };
  }

  /**
   * Parse YAML frontmatter (simplified parser).
   */
  private parseYaml(yaml: string): Partial<CronFileConfig> | null {
    const config: Partial<CronFileConfig> = {};

    let currentKey: string | null = null;
    let currentValue = '';

    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check for new key (no indent or less indent than current)
      if (indent === 0 && trimmed.includes(':')) {
        // Save previous key
        if (currentKey) {
          this.setYamlValue(config, currentKey, currentValue.trim());
        }

        const colonIndex = trimmed.indexOf(':');
        currentKey = trimmed.substring(0, colonIndex).trim();
        currentValue = trimmed.substring(colonIndex + 1).trim();
      } else if (currentKey && indent > 0) {
        // Continuation of previous value
        currentValue += '\n' + line;
      }
    }

    // Save last key
    if (currentKey) {
      this.setYamlValue(config, currentKey, currentValue.trim());
    }

    return config;
  }

  private setYamlValue(config: Partial<CronFileConfig>, key: string, value: string): void {
    // Remove quotes if present
    const cleanValue = value.replace(/^["'](.*)["']$/, '$1');

    switch (key) {
      case 'name':
        config.name = cleanValue;
        break;
      case 'description':
        config.description = cleanValue;
        break;
      case 'enabled':
        config.enabled = cleanValue.toLowerCase() === 'true';
        break;
      case 'frequency':
        config.frequency = cleanValue as CronFileConfig['frequency'];
        break;
      case 'time':
        config.time = cleanValue;
        break;
      case 'cronExpression':
      case 'cron_expression':
      case 'cron':
        config.cronExpression = cleanValue;
        break;
      case 'type':
        config.type = cleanValue as CronJobType;
        break;
      case 'model':
        config.model = cleanValue;
        break;
      case 'targetFile':
      case 'target_file':
        config.targetFile = cleanValue;
        break;
      case 'appendMode':
      case 'append_mode':
        config.appendMode = cleanValue as 'append' | 'overwrite' | 'prepend';
        break;
      case 'prompt':
        config.prompt = cleanValue;
        break;
    }
  }

  /**
   * Parse markdown body for prompt and target info.
   */
  private parseBody(body: string): { prompt?: string; targetFile?: string; appendMode?: 'append' | 'overwrite' | 'prepend' } {
    const result: { prompt?: string; targetFile?: string; appendMode?: 'append' | 'overwrite' | 'prepend' } = {};

    // Look for ## Prompt section
    const promptMatch = body.match(/##\s*Prompt\s*\n([\s\S]*?)(?=##|$)/i);
    if (promptMatch) {
      result.prompt = promptMatch[1].trim();
    }

    // Look for ## Target section
    const targetMatch = body.match(/##\s*Target\s*\n([\s\S]*?)(?=##|$)/i);
    if (targetMatch) {
      const targetSection = targetMatch[1];

      // Extract File: line
      const fileMatch = targetSection.match(/File:\s*(.+)/i);
      if (fileMatch) {
        result.targetFile = fileMatch[1].trim();
      }

      // Extract Append Mode: line
      const modeMatch = targetSection.match(/Append\s*Mode:\s*(append|overwrite|prepend)/i);
      if (modeMatch) {
        result.appendMode = modeMatch[1].toLowerCase() as 'append' | 'overwrite' | 'prepend';
      }
    }

    // If no explicit sections, treat entire body as prompt
    if (!result.prompt && body && !body.includes('##')) {
      result.prompt = body;
    }

    return result;
  }

  /**
   * Convert parsed file config to CronJob config.
   */
  createJobConfig(parsed: ParsedCronFile, fileName: string): { name: string; config: CronJobConfig } | null {
    const cfg = parsed.config;

    switch (cfg.type) {
      case 'openclaw-query':
        if (!cfg.prompt) {
          console.warn(`[CronFileParser] Missing prompt in ${fileName}`);
          return null;
        }
        return {
          name: cfg.name || fileName.replace('.md', ''),
          config: {
            prompt: cfg.prompt,
            model: cfg.model,
            targetFile: cfg.targetFile,
            appendMode: cfg.appendMode,
          } as CronJobConfig,
        };
      case 'file-operation':
        return {
          name: cfg.name || fileName.replace('.md', ''),
          config: {
            operation: 'scan',
            targetPath: cfg.targetFile || '${vault}',
          } as CronJobConfig,
        };
      case 'notification':
        return {
          name: cfg.name || fileName.replace('.md', ''),
          config: {
            message: cfg.prompt || 'Cron job completed',
            showBanner: true,
          } as CronJobConfig,
        };
      case 'script':
        return {
          name: cfg.name || fileName.replace('.md', ''),
          config: {
            scriptContent: cfg.prompt || '',
            timeoutMs: 30000,
          } as CronJobConfig,
        };
      default:
        return null;
    }
  }

  /**
   * Generate cron expression from time string.
   */
  static timeToCronExpression(time: string, frequency: string): string {
    const [hour, minute] = time.split(':').map(Number);

    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        return `${minute} ${hour} * * 0`;
      case 'monthly':
        return `${minute} ${hour} 1 * *`;
      default:
        return `${minute} ${hour} * * *`;
    }
  }
}

/**
 * Sync file-based cron jobs with storage.
 */
export async function syncFileBasedCronJobs(
  parser: CronFileParser,
  existingJobs: CronJob[]
): Promise<{ added: number; updated: number; removed: number }> {
  const result = { added: 0, updated: 0, removed: 0 };

  if (!parser.hasCronDirectory()) {
    return result;
  }

  const files = parser.getCronFiles();
  const processedIds = new Set<string>();

  for (const filePath of files) {
    const parsed = parser.parseFile(filePath);
    if (!parsed) continue;

    const fileName = path.basename(filePath);
    const jobConfig = parser.createJobConfig(parsed, fileName);
    if (!jobConfig) continue;

    // Create a stable ID based on file path
    const jobId = `file:${filePath}`;
    processedIds.add(jobId);

    // Check if job already exists
    const existingJob = existingJobs.find(j => j.id === jobId);

    if (existingJob) {
      // Update if changed
      // (Simplified - real implementation would compare all fields)
      result.updated++;
    } else {
      // Would add new job here
      result.added++;
    }
  }

  // Find file-based jobs that no longer exist
  for (const job of existingJobs) {
    if (job.id.startsWith('file:') && !processedIds.has(job.id)) {
      result.removed++;
    }
  }

  return result;
}
