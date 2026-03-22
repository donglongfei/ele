/**
 * OpenClaw Session Manager
 *
 * Manages multiple isolated sessions using OpenClaw's sessionKey naming:
 * - Format: agent:main:{name}
 * - Examples: agent:main:obsidian-sess_001, agent:main:obsidian-sess_002
 *
 * Each Ele conversation maps to a unique OpenClaw channelKey, ensuring
 * complete session isolation between conversations.
 * 
 * Key design: Uses channelKey as the internal key, so session persists
 * even when conversationId changes (e.g., from pending to created).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface OpenClawSession {
  id: string; // Ele conversation ID (or temp ID before creation)
  name: string; // Display name
  channelKey: string; // OpenClaw sessionKey, e.g., "agent:main:obsidian-sess_001"
  systemId: string | null; // OpenClaw assigned UUID (from sessions.json)
  createdAt: number;
  lastMessageAt: number;
  preview: string;
  thinkingLevel: string; // Session-specific thinking level (off | low | medium | high | adaptive)
  model: string | null; // Session-specific model override
}

interface OpenClawSessionsFile {
  [channelKey: string]: {
    systemId: string;
    createdAt: string;
    lastActiveAt: string;
  };
}

export class OpenClawSessionManager {
  // Keyed by channelKey (agent:main:obsidian-xxx) for stability
  private sessions: Map<string, OpenClawSession> = new Map();
  private activeChannelKey: string | null = null;
  private readonly ocSessionsFile: string;
  private lastSystemIdCheck: number = 0;
  private readonly SYSTEM_ID_CACHE_MS = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.ocSessionsFile = path.join(
      os.homedir(),
      '.openclaw',
      'agents',
      'main',
      'sessions',
      'sessions.json'
    );
  }

  /**
   * Create a new session with a given channelKey
   * @param channelKey - Full channelKey like "agent:main:obsidian-xxx"
   * @param name - Display name
   */
  createSession(channelKey: string, name?: string): OpenClawSession {
    const session: OpenClawSession = {
      id: channelKey.replace('agent:main:obsidian-', ''),
      name: name || `对话 ${this.sessions.size + 1}`,
      channelKey,
      systemId: null, // Will be populated from sessions.json
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      preview: '',
      thinkingLevel: 'low', // Default thinking level
      model: null, // No model override by default
    };

    this.sessions.set(channelKey, session);
    this.activeChannelKey = channelKey;

    // Try to load systemId from existing sessions.json
    this.refreshSystemId(session);

    console.log('[OpenClawSessionManager] Created session:', channelKey);
    return session;
  }

  /**
   * Get or create session by channelKey
   */
  getOrCreateSession(channelKey: string, name?: string): OpenClawSession {
    if (this.sessions.has(channelKey)) {
      return this.sessions.get(channelKey)!;
    }
    return this.createSession(channelKey, name);
  }

  /**
   * Get session by channelKey
   */
  getSession(channelKey: string): OpenClawSession | null {
    return this.sessions.get(channelKey) || null;
  }

  /**
   * Set active session by channelKey
   */
  setActiveSession(channelKey: string): boolean {
    if (!this.sessions.has(channelKey)) {
      return false;
    }
    this.activeChannelKey = channelKey;
    return true;
  }

  /**
   * Get active session
   */
  getActiveSession(): OpenClawSession | null {
    if (!this.activeChannelKey) {
      return null;
    }
    return this.sessions.get(this.activeChannelKey) || null;
  }

  /**
   * Get active session's channelKey
   */
  getActiveSessionId(): string | null {
    return this.activeChannelKey;
  }

  /**
   * Update session preview (last message)
   */
  updateSessionPreview(channelKey: string, preview: string): void {
    const session = this.sessions.get(channelKey);
    if (session) {
      session.preview = preview;
      session.lastMessageAt = Date.now();
    }
  }

  /**
   * Rename session
   */
  renameSession(channelKey: string, name: string): void {
    const session = this.sessions.get(channelKey);
    if (session) {
      session.name = name;
    }
  }

  /**
   * Get thinking level for a session
   */
  getThinkingLevel(channelKey: string): string {
    const session = this.sessions.get(channelKey);
    return session?.thinkingLevel || 'low';
  }

  /**
   * Set thinking level for a session
   */
  setThinkingLevel(channelKey: string, level: string): void {
    const session = this.sessions.get(channelKey);
    if (session) {
      session.thinkingLevel = level;
      console.log(`[OpenClawSessionManager] Session ${channelKey} thinking level set to: ${level}`);
    }
  }

  /**
   * Get model for a session
   */
  getModel(channelKey: string): string | null {
    const session = this.sessions.get(channelKey);
    return session?.model || null;
  }

  /**
   * Set model for a session
   */
  setModel(channelKey: string, model: string): void {
    const session = this.sessions.get(channelKey);
    if (session) {
      session.model = model;
      console.log(`[OpenClawSessionManager] Session ${channelKey} model set to: ${model}`);
    }
  }

  /**
   * Delete session
   */
  deleteSession(channelKey: string): void {
    this.sessions.delete(channelKey);
    if (this.activeChannelKey === channelKey) {
      this.activeChannelKey = null;
    }
  }

  /**
   * List all sessions
   */
  listSessions(): OpenClawSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );
  }

  /**
   * Build message params for sending to OpenClaw Gateway
   * Uses systemId if available, otherwise falls back to channelKey (lazy creation)
   * 
   * @param channelKey - The channelKey (agent:main:obsidian-xxx)
   * @param message - User message
   */
  buildMessageParams(
    channelKey: string,
    message: string
  ): { message: string; idempotencyKey: string; sessionId?: string; sessionKey?: string } {
    const session = this.sessions.get(channelKey);
    if (!session) {
      // Auto-create session if not exists (for lazy session creation)
      this.createSession(channelKey);
      return {
        message,
        idempotencyKey: `${channelKey}-${Date.now()}`,
        sessionKey: channelKey,
      };
    }

    // Refresh systemId if needed
    this.refreshSystemId(session);

    const idempotencyKey = `${channelKey}-${Date.now()}`;

    // Priority: use systemId if available (faster), otherwise use channelKey (lazy create)
    if (session.systemId) {
      return {
        message,
        idempotencyKey,
        sessionId: session.systemId,
      };
    } else {
      return {
        message,
        idempotencyKey,
        sessionKey: session.channelKey,
      };
    }
  }

  /**
   * Refresh systemId from OpenClaw's sessions.json
   */
  private refreshSystemId(session: OpenClawSession): void {
    const now = Date.now();
    if (now - this.lastSystemIdCheck < this.SYSTEM_ID_CACHE_MS && session.systemId) {
      return; // Use cached value
    }

    const systemId = this.readSystemIdFromFile(session.channelKey);
    if (systemId) {
      session.systemId = systemId;
    }
    this.lastSystemIdCheck = now;
  }

  /**
   * Read systemId from OpenClaw sessions.json
   */
  private readSystemIdFromFile(channelKey: string): string | null {
    try {
      if (!fs.existsSync(this.ocSessionsFile)) {
        return null;
      }

      const raw = fs.readFileSync(this.ocSessionsFile, 'utf-8');
      const sessions: OpenClawSessionsFile = JSON.parse(raw);

      return sessions[channelKey]?.systemId || null;
    } catch (error) {
      console.warn('[OpenClawSessionManager] Failed to read sessions.json:', error);
      return null;
    }
  }

  /**
   * Force refresh all systemIds from file
   */
  refreshAllSystemIds(): void {
    for (const session of this.sessions.values()) {
      const systemId = this.readSystemIdFromFile(session.channelKey);
      if (systemId) {
        session.systemId = systemId;
      }
    }
    this.lastSystemIdCheck = Date.now();
  }

  /**
   * Force refresh systemId for a specific session
   */
  refreshSystemIdForSession(channelKey: string): void {
    const session = this.sessions.get(channelKey);
    if (session) {
      const systemId = this.readSystemIdFromFile(channelKey);
      if (systemId) {
        session.systemId = systemId;
      }
    }
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear();
    this.activeChannelKey = null;
  }
}
