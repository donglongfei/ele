/**
 * OpenClawService - WebSocket client for OpenClaw Gateway
 *
 * Replaces EleService and Claude Agent SDK with direct WebSocket
 * communication to OpenClaw Gateway (running on port 18789).
 *
 * Architecture:
 * - WebSocket connection to Gateway at ws://127.0.0.1:18789
 * - Message-based protocol: { type, payload }
 * - Transforms OpenClaw messages to StreamChunk format for UI compatibility
 * - Session management via Gateway commands
 * - Dynamic configuration (model, permission mode) via Gateway
 *
 * TODO: Integration testing with real OpenClaw Gateway required
 * TODO: Verify message protocol matches OpenClaw Gateway implementation
 */

import { randomUUID } from 'crypto';
import { Notice } from 'obsidian';

import type OpenCodianPlugin from '../../main';
import { getActionDescription } from '../security';
import { TOOL_ASK_USER_QUESTION, TOOL_ENTER_PLAN_MODE, TOOL_EXIT_PLAN_MODE, TOOL_SKILL } from '../tools/toolNames';
import type {
  ApprovalDecision,
  ChatMessage,
  ExitPlanModeCallback,
  ExitPlanModeDecision,
  ImageAttachment,
  PermissionMode,
  StreamChunk,
} from '../types';
import { OpenClawSessionManager } from './OpenClawSessionManager';

export type { ApprovalDecision };

export interface ApprovalCallbackOptions {
  decisionReason?: string;
  blockedPath?: string;
  agentID?: string;
}

export type ApprovalCallback = (
  toolName: string,
  input: Record<string, unknown>,
  description: string,
  options?: ApprovalCallbackOptions,
) => Promise<ApprovalDecision>;

export type AskUserQuestionCallback = (
  input: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<Record<string, string> | null>;

export interface QueryOptions {
  allowedTools?: string[];
  model?: string;
  /** MCP servers @-mentioned in the prompt. */
  mcpMentions?: Set<string>;
  /** MCP servers enabled via UI selector (in addition to @-mentioned servers). */
  enabledMcpServers?: Set<string>;
  /** Session-specific external context paths (directories with full access). */
  externalContextPaths?: string[];
}

/**
 * OpenClaw Gateway message format
 */
interface OpenClawMessage {
  type: string;
  id?: string;
  event?: string;
  payload: any;
}

/**
 * Response handler for managing async iteration
 */
interface ResponseHandler {
  id: string;
  onChunk: (chunk: StreamChunk) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export class OpenClawService {
  private plugin: OpenCodianPlugin;
  private vaultPath: string;
  private ws: WebSocket | null = null;
  private gatewayUrl: string;
  private messageHandlers = new Map<string, (payload: any) => void>();
  private sessionId: string | null = null;
  private sessionValidatedAt: number = 0; // Timestamp of last session validation
  private currentModel: string | null = null;  // Track configured model
  private responseHandlers: ResponseHandler[] = [];
  private approvalCallback: ApprovalCallback | null = null;
  private askUserQuestionCallback: AskUserQuestionCallback | null = null;
  private exitPlanModeCallback: ExitPlanModeCallback | null = null;
  private permissionModeSyncCallback: ((mode: string) => void) | null = null;
  private connectionPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isAuthenticated = false;  // Track auth state

  // Session manager for multi-conversation support
  readonly sessionManager: OpenClawSessionManager;

  constructor(plugin: OpenCodianPlugin, vaultPath: string) {
    this.plugin = plugin;
    this.vaultPath = vaultPath;
    this.gatewayUrl = plugin.settings.openClawGatewayUrl || 'ws://127.0.0.1:18789';
    this.sessionManager = new OpenClawSessionManager();
  }

  /**
   * Connect to OpenClaw Gateway
   */
  async connect(): Promise<void> {
    // Return existing connection promise if connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // Connect without token in URL - auth token goes in connect request
      this.ws = new WebSocket(this.gatewayUrl);

      this.ws.onopen = () => {
        console.log('[OpenClawService] Connected to OpenClaw Gateway, waiting for challenge...');
        this.reconnectAttempts = 0;
        this.isAuthenticated = false;
        // Don't resolve yet - wait for successful auth
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        try {
          const msg: OpenClawMessage = JSON.parse(event.data);

          // Handle auth challenge before normal message routing
          if (msg.type === 'event' && msg.event === 'connect.challenge' && !this.isAuthenticated) {
            await this.handleAuthChallenge(msg.payload, resolve, reject);
            return;
          }

          this.handleMessage(msg);
        } catch (error) {
          console.error('[OpenClawService] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[OpenClawService] WebSocket error:', err);
        this.connectionPromise = null;
        reject(err);
      };

      this.ws.onclose = () => {
        console.log('[OpenClawService] Disconnected from Gateway');
        this.connectionPromise = null;
        this.handleDisconnect();
      };
    });

    return this.connectionPromise;
  }

  /**
   * Handle authentication challenge from Gateway
   * Protocol: After receiving connect.challenge, send connect request with device signature
   */
  private async handleAuthChallenge(
    payload: any,
    resolve: () => void,
    reject: (err: Error) => void
  ): Promise<void> {
    const nonce = payload.nonce;
    const ts = payload.ts;
    console.log('[OpenClawService] Received auth challenge');

    try {
      // Generate request ID
      const reqId = randomUUID();

      // Check if we have device credentials
      const hasDeviceCredentials =
        this.plugin.settings.deviceId &&
        this.plugin.settings.devicePublicKey &&
        this.plugin.settings.devicePrivateKeyJwk;

      let deviceId: string;
      let devicePublicKey: string;
      let devicePrivateKey: Buffer;

      if (!hasDeviceCredentials) {
        // First-time pairing: generate new keypair
        console.log('[OpenClawService] First-time pairing: generating device credentials...');
        const { generateEd25519Keypair, exportPrivateKeyHex, deriveDeviceId, toBase64Url } = await import('../../utils/crypto');

        const keypair = generateEd25519Keypair();
        const publicKeyRaw = keypair.publicKey;
        const privateKeyRaw = keypair.privateKey;

        deviceId = deriveDeviceId(publicKeyRaw);
        devicePublicKey = toBase64Url(publicKeyRaw);
        const privateKeyHex = exportPrivateKeyHex(privateKeyRaw);

        // Save credentials
        this.plugin.settings.deviceId = deviceId;
        this.plugin.settings.devicePublicKey = devicePublicKey;
        this.plugin.settings.devicePrivateKeyJwk = privateKeyHex; // Reusing field name for hex
        await this.plugin.saveSettings();

        devicePrivateKey = privateKeyRaw;

        console.log('[OpenClawService] Device credentials generated and saved');
      } else {
        // Use existing credentials
        console.log('[OpenClawService] Using existing device credentials');
        const { importPrivateKeyHex } = await import('../../utils/crypto');

        deviceId = this.plugin.settings.deviceId;
        devicePublicKey = this.plugin.settings.devicePublicKey;
        devicePrivateKey = importPrivateKeyHex(this.plugin.settings.devicePrivateKeyJwk);
      }

      // Build device auth payload and sign it
      const { buildDeviceAuthPayloadV3, signMessage, toBase64Url } = await import('../../utils/crypto');

      const authToken = this.plugin.settings.openClawAuthToken || '';
      const platform = navigator.platform.toLowerCase();
      const deviceFamily = this.getDeviceFamily().toLowerCase();

      const authPayload = buildDeviceAuthPayloadV3({
        deviceId,
        clientId: 'gateway-client',
        clientMode: 'webchat',
        role: 'operator',
        scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'],
        signedAtMs: ts,
        token: authToken,
        nonce: nonce,
        platform: platform,
        deviceFamily: deviceFamily,
      });

      console.log('[OpenClawService] Signing auth payload...');
      const signatureBytes = signMessage(devicePrivateKey, authPayload);
      const signature = toBase64Url(signatureBytes);

      // Build connect request with device signature
      const connectRequest = {
        type: 'req',
        id: reqId,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'gateway-client',
            version: '0.1.0',
            platform: platform,
            mode: 'webchat',
            deviceFamily: deviceFamily,
          },
          role: 'operator',
          scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'],
          caps: ['tool-events'],
          device: {
            id: deviceId,
            publicKey: devicePublicKey,
            signature: signature,
            signedAt: ts,
            nonce: nonce,
          },
          auth: authToken ? { token: authToken } : {},
        },
      };

      console.log('[OpenClawService] Sending connect request with device signature...');

      // Set up handler for connect response
      this.messageHandlers.set(reqId, async (response: any) => {
        if (response.error) {
          console.error('[OpenClawService] Connect failed:', response.error);
          this.isAuthenticated = false;
          reject(new Error(`Auth failed: ${response.error.message || response.error}`));
        } else {
          console.log('[OpenClawService] Connected successfully');
          this.isAuthenticated = true;

          // Save deviceToken if returned (first-time pairing)
          if (response.payload?.auth?.deviceToken) {
            console.log('[OpenClawService] Received deviceToken, saving...');
            this.plugin.settings.openClawDeviceToken = response.payload.auth.deviceToken;
            await this.plugin.saveSettings();
          }

          this.connectionPromise = null;
          resolve();
        }
      });

      // Send the connect request
      this.sendMessage(connectRequest);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isAuthenticated) {
          reject(new Error('Authentication timeout'));
        }
      }, 10000);
    } catch (error) {
      console.error('[OpenClawService] Error during authentication:', error);
      reject(error as Error);
    }
  }

  /**
   * Get device family string (e.g., "mac", "windows", "linux")
   */
  private getDeviceFamily(): string {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) return 'mac';
    if (platform.includes('win')) return 'windows';
    if (platform.includes('linux')) return 'linux';
    return 'unknown';
  }

  /**
   * Handle WebSocket disconnect with exponential backoff reconnection
   */
  private handleDisconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      new Notice('Lost connection to OpenClaw Gateway. Please restart the Gateway.');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`[OpenClawService] Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect().catch(() => {
        // Error already logged, will retry
      });
    }, delay);
  }

  /**
   * Route incoming Gateway messages to handlers
   */
  private handleMessage(msg: OpenClawMessage): void {
    // Handle response messages (res type) - must check this FIRST
    if (msg.type === 'res') {
      // Check if we have a handler waiting for this response ID
      if (msg.id) {
        const handler = this.messageHandlers.get(msg.id);
        if (handler) {
          handler(msg.payload || msg);
          this.messageHandlers.delete(msg.id);
          return;
        }
      }

      // No handler found - this is OK, might be unsolicited response
      console.debug('[OpenClawService] Received response without handler:', msg.id);
      return;
    }

    // Check for response to specific command (has _msgId in payload)
    if (msg.payload?._msgId) {
      const handler = this.messageHandlers.get(msg.payload._msgId);
      if (handler) {
        handler(msg.payload);
        this.messageHandlers.delete(msg.payload._msgId);
        return;
      }
    }

    // Route by message type
    switch (msg.type) {
      case 'agent.response':
        this.handleAgentResponse(msg.payload);
        break;
      case 'agent.thinking':
        this.handleAgentThinking(msg.payload);
        break;
      case 'tool.call':
        this.handleToolCall(msg.payload);
        break;
      case 'tool.result':
        this.handleToolResult(msg.payload);
        break;
      case 'tool.approval_required':
        this.handleToolApproval(msg.payload);
        break;
      case 'session.init':
        this.handleSessionInit(msg.payload);
        break;
      case 'error':
        this.handleError(msg.payload);
        break;
      case 'event':
        // Route event-type messages by event name
        switch (msg.event) {
          case 'agent':
            // Agent response event
            this.handleAgentResponse(msg.payload);
            break;
          case 'thinking':
            // Thinking event
            this.handleAgentThinking(msg.payload);
            break;
          case 'tool':
            // Tool event
            this.handleToolCall(msg.payload);
            break;
          case 'health':
          case 'tick':
            // Gateway informational events - ignore
            break;
          default:
            console.debug('[OpenClawService] Unhandled event:', msg.event);
        }
        break;
      case 'pong':
        // Response to ping (keep-alive)
        break;
      default:
        console.warn('[OpenClawService] Unknown message type:', msg.type);
    }
  }

  /**
   * Transform OpenClaw messages to StreamChunk format for UI compatibility
   */
  private transformToStreamChunk(type: string, payload: any): StreamChunk | null {
    switch (type) {
      case 'text':
        // Try multiple possible content fields
        const textContent = payload.content || payload.data?.content || payload.data?.text || payload.text;
        if (!textContent) return null;
        return { type: 'text', content: textContent };
      case 'thinking':
        const thinkingContent = payload.content || payload.data?.content || payload.data?.text;
        if (!thinkingContent) return null;
        return { type: 'thinking', content: thinkingContent };
      case 'tool_use':
        return {
          type: 'tool_use',
          id: payload.id,
          name: payload.tool,
          input: payload.arguments,
        };
      case 'tool_result':
        return {
          type: 'tool_result',
          id: payload.id,
          content: payload.output,
          isError: payload.isError || false,
        };
      case 'usage':
        return {
          type: 'usage',
          usage: payload.usage,
          sessionId: this.sessionId,
        };
      case 'error':
        return {
          type: 'error',
          content: payload.message || 'Unknown error',
        };
      default:
        return null;
    }
  }

  private handleAgentResponse(payload: any): void {
    // Handle lifecycle events
    if (payload.stream === 'lifecycle') {
      if (payload.data?.phase === 'end') {
        this.emitDone();
      }
      return;
    }

    // Fast path: directly emit text from assistant stream
    if (payload.stream === 'assistant') {
      const delta = payload.data?.delta;
      if (delta) {
        // Skip transformToStreamChunk - emit directly for better performance
        this.emitChunk({ type: 'text', content: delta });
      }
    }
  }

  private handleAgentThinking(payload: any): void {
    const chunk = this.transformToStreamChunk('thinking', payload);
    if (chunk) {
      this.emitChunk(chunk);
    }
  }

  private handleToolCall(payload: any): void {
    const chunk = this.transformToStreamChunk('tool_use', payload);
    if (chunk) {
      this.emitChunk(chunk);
    }
  }

  private handleToolResult(payload: any): void {
    const chunk = this.transformToStreamChunk('tool_result', payload);
    if (chunk) {
      this.emitChunk(chunk);
    }
  }

  private async handleToolApproval(payload: any): Promise<void> {
    const { toolName, input, id } = payload;

    if (!this.approvalCallback) {
      this.sendCommand('tool.approve', {
        id,
        approved: false,
        message: 'No approval handler available',
      });
      return;
    }

    const description = getActionDescription(toolName, input);
    const decision = await this.approvalCallback(toolName, input, description);

    this.sendCommand('tool.approve', {
      id,
      approved: decision === 'allow' || decision === 'allow-always',
      persistRule: decision === 'allow-always',
    });
  }

  private handleSessionInit(payload: any): void {
    this.sessionId = payload.sessionId;
    console.log('[OpenClawService] Session initialized:', this.sessionId);
  }

  private handleError(payload: any): void {
    const chunk = this.transformToStreamChunk('error', payload);
    if (chunk) {
      this.emitChunk(chunk);
    }
  }

  /**
   * Emit chunk to active response handlers (optimized for single handler)
   */
  private emitChunk(chunk: StreamChunk): void {
    // Fast path: usually only one handler
    if (this.responseHandlers.length === 1) {
      this.responseHandlers[0].onChunk(chunk);
      return;
    }

    // Slow path: multiple handlers
    for (const handler of this.responseHandlers) {
      try {
        handler.onChunk(chunk);
      } catch (error) {
        console.error('[OpenClawService] Handler error:', error);
      }
    }
  }

  /**
   * Signal completion to active response handlers (optimized for single handler)
   */
  private emitDone(): void {
    // Fast path: usually only one handler
    if (this.responseHandlers.length === 1) {
      this.responseHandlers[0].onDone();
      return;
    }

    // Slow path: multiple handlers
    for (const handler of this.responseHandlers) {
      try {
        handler.onDone();
      } catch (error) {
        console.error('[OpenClawService] Handler done error:', error);
      }
    }
  }

  /**
   * Main query function - sends prompt to Gateway and streams response
   * 
   * @param prompt - User message
   * @param images - Image attachments
   * @param conversationHistory - Previous messages for context
   * @param queryOptions - Query options including conversationId for session routing
   */
  async *query(
    prompt: string,
    images?: ImageAttachment[],
    conversationHistory?: ChatMessage[],
    queryOptions?: QueryOptions & { conversationId?: string }
  ): AsyncGenerator<StreamChunk> {
    // Ensure connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isAuthenticated) {
      try {
        await this.connect();
      } catch (error) {
        yield {
          type: 'error',
          content: 'Failed to connect to OpenClaw Gateway. Is it running on port 18789?',
        };
        return;
      }
    }

    // Get conversation ID from options or use active session
    const conversationId = queryOptions?.conversationId || this.sessionManager.getActiveSessionId();
    if (!conversationId) {
      yield {
        type: 'error',
        content: 'No active conversation. Please create a new conversation.',
      };
      return;
    }

    // Get or create session for this conversation
    const session = this.sessionManager.getOrCreateSession(conversationId);
    
    // Build message params with sessionKey (uses channelKey for lazy session creation)
    const messageParams = this.sessionManager.buildMessageParams(conversationId, prompt);

    // Generate request ID
    const reqId = randomUUID();

    // Get model for potential future use
    const model = queryOptions?.model || this.plugin.settings.model;

    // Build OpenClaw agent request with sessionKey for multi-session support
    const agentRequest: any = {
      type: 'req',
      id: reqId,
      method: 'agent',
      params: {
        ...messageParams,  // Includes message, idempotencyKey, sessionId or sessionKey
        // sessionKey format: "agent:main:obsidian-{conversationId}"
      },
    };

    // Stream responses with micro-batching for better performance
    let done = false;
    let resolver: (() => void) | null = null;
    const pendingChunks: StreamChunk[] = [];

    // Create response handler
    const handlerId = randomUUID();
    const handler: ResponseHandler = {
      id: handlerId,
      onChunk: (chunk) => {
        pendingChunks.push(chunk);
        // Wake up generator immediately
        if (resolver) {
          const r = resolver;
          resolver = null;
          r();
        }
      },
      onDone: () => {
        done = true;
        if (resolver) {
          const r = resolver;
          resolver = null;
          r();
        }
      },
      onError: (error) => {
        pendingChunks.push({
          type: 'error',
          content: error.message,
        });
        done = true;
        if (resolver) {
          const r = resolver;
          resolver = null;
          r();
        }
      },
    };

    this.responseHandlers.push(handler);

    // Register message handler to catch error responses
    this.messageHandlers.set(reqId, (response: any) => {
      if (response.error) {
        // Gateway returned an error
        const errorMsg = response.error.message || response.error.toString?.() || 'Unknown error';
        console.error('[OpenClawService] Agent request failed:', errorMsg);

        // Check if this is a session-related error
        const sessionErrorPatterns = [
          'session',
          'choose a session',
          'session not found',
          'invalid session',
        ];
        const isSessionError = sessionErrorPatterns.some(pattern =>
          errorMsg.toLowerCase().includes(pattern)
        );

        if (isSessionError) {
          console.log('[OpenClawService] Session error detected, invalidating cache for retry');
          this.sessionId = null;
          this.sessionValidatedAt = 0;
        }

        handler.onError(new Error(errorMsg));
        this.messageHandlers.delete(reqId);
      } else {
        // Success response - check if session ID is returned
        if (response.payload?.sessionId && !this.sessionId) {
          this.sessionId = response.payload.sessionId;
          console.log('[OpenClawService] Session auto-created:', this.sessionId);
        }
        // Continue waiting for streaming events
        // (some gateways may send an ack before streaming begins)
      }
    });

    // Send to Gateway
    this.sendMessage(agentRequest);

    try {
      // Event-driven streaming with micro-batching
      while (!done) {
        // Yield all pending chunks (micro-batch)
        while (pendingChunks.length > 0) {
          yield pendingChunks.shift()!;
        }

        // Wait for next chunk or completion
        if (!done) {
          await new Promise<void>(resolve => { resolver = resolve; });
        }
      }

      // Yield any remaining chunks
      while (pendingChunks.length > 0) {
        yield pendingChunks.shift()!;
      }

      yield { type: 'done' };
    } finally {
      // Cleanup handlers
      this.messageHandlers.delete(reqId);
      const idx = this.responseHandlers.findIndex(h => h.id === handlerId);
      if (idx >= 0) {
        this.responseHandlers.splice(idx, 1);
      }
    }
  }

  /**
   * Transform conversation history to OpenClaw format
   */
  private transformHistory(history?: ChatMessage[]): any[] {
    if (!history) return [];

    return history.map(msg => ({
      role: msg.role,
      content: msg.content,
      images: msg.images?.map(img => ({
        mediaType: img.mediaType,
        data: img.data,
      })),
    }));
  }

  /**
   * Send command to Gateway and wait for response
   */
  private async sendCommand(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const msgId = randomUUID();
      this.messageHandlers.set(msgId, (response: any) => {
        if (response.error) {
          reject(new Error(response.error.message || response.error.toString?.() || 'Command failed'));
        } else {
          resolve(response.payload || response);
        }
      });

      this.sendMessage({
        type: 'req',
        id: msgId,
        method: type,
        params: payload,
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(msgId)) {
          this.messageHandlers.delete(msgId);
          reject(new Error('Command timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Send message to Gateway
   */
  private sendMessage(msg: OpenClawMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[OpenClawService] Cannot send message: not connected');
      return;
    }

    try {
      // Safe JSON stringification to avoid circular reference errors
      const jsonString = JSON.stringify(msg, (key, value) => {
        // Skip circular references and non-serializable objects
        if (typeof value === 'object' && value !== null) {
          // Skip objects that look like DOM elements or Obsidian internals
          if (value.constructor && value.constructor.name === 'e') {
            return undefined;
          }
          // Convert Sets to arrays
          if (value instanceof Set) {
            return Array.from(value);
          }
          // Convert Maps to objects
          if (value instanceof Map) {
            return Object.fromEntries(value);
          }
        }
        return value;
      });

      this.ws.send(jsonString);
    } catch (error) {
      console.error('[OpenClawService] Failed to serialize message:', error);
      console.error('[OpenClawService] Message:', msg);
    }
  }

  /**
   * Dynamic configuration: set model
   */
  async setModel(model: string): Promise<void> {
    await this.sendCommand('config.setModel', { model });
  }

  /**
   * Dynamic configuration: set thinking level
   * OpenClaw uses thinkingLevel: off | low | medium | high | adaptive
   * 
   * Uses chat.send to send /think command to the session.
   * Note: webchat clients cannot use sessions.patch, must use chat.send
   */
  async setThinkingLevel(
    level: 'off' | 'low' | 'medium' | 'high' | 'adaptive',
    channelKey?: string
  ): Promise<void> {
    // Get active session or use provided channelKey
    const session = channelKey 
      ? this.sessionManager.getSession(channelKey)
      : this.sessionManager.getActiveSession();
    
    if (!session) {
      console.error('[OpenClawService] setThinkingLevel: No active session found');
      console.error('[OpenClawService] channelKey provided:', channelKey);
      console.error('[OpenClawService] active session:', this.sessionManager.getActiveSessionId());
      throw new Error('No active session');
    }

    console.log(`[OpenClawService] Setting thinking level: ${level}`);
    console.log(`[OpenClawService] Session channelKey: ${session.channelKey}`);
    
    try {
      // Use chat.send to send /think command
      // webchat clients cannot use sessions.patch, must use chat.send
      // Required params: sessionKey, message, idempotencyKey
      const result = await this.sendCommand('chat.send', {
        sessionKey: session.channelKey,
        message: `/think ${level}`,
        idempotencyKey: `think-${Date.now()}`,
      });
      
      console.log(`[OpenClawService] Thinking level set to: ${level}`, result);
    } catch (error) {
      console.error(`[OpenClawService] Failed to set thinking level:`, error);
      throw error;
    }
  }

  /**
   * Dynamic configuration: toggle reasoning display
   * Controls whether thinking process is shown to user
   * Maps to OpenClaw's /reasoning command
   * Independent from thinking level
   */
  async setReasoning(enabled: boolean, channelKey?: string): Promise<void> {
    const session = channelKey
      ? this.sessionManager.getSession(channelKey)
      : this.sessionManager.getActiveSession();

    if (!session) {
      throw new Error('No active session');
    }

    // Use /reasoning command to control thinking display
    // /reasoning on = show thinking process
    // /reasoning off = hide thinking process
    const reasoningState = enabled ? 'on' : 'off';
    
    try {
      // Use chat.send to send /reasoning command
      // Required params: sessionKey, message, idempotencyKey
      const result = await this.sendCommand('chat.send', {
        sessionKey: session.channelKey,
        message: `/reasoning ${reasoningState}`,
        idempotencyKey: `reasoning-${Date.now()}`,
      });
      
      console.log(`[OpenClawService] Reasoning ${enabled ? 'enabled' : 'disabled'}`, result);
    } catch (error) {
      console.error(`[OpenClawService] Failed to set reasoning:`, error);
      throw error;
    }
  }

  /**
   * Read session ID from OpenClaw's sessions.json file.
   * This provides session persistence across Gateway restarts.
   * Note: Sessions reset daily at 4:00 AM by default.
   */
  private async readSessionFromFile(agentName = 'main'): Promise<string | null> {
    try {
      const { homedir } = await import('os');
      const { readFileSync } = await import('fs');
      const { join } = await import('path');

      const sessionFile = join(homedir(), '.openclaw', 'agents', agentName, 'sessions', 'sessions.json');
      const raw = readFileSync(sessionFile, 'utf-8');
      const sessions = JSON.parse(raw);

      // sessionKey format: "agent:main:main"
      const targetKey = `agent:${agentName}:${agentName}`;
      const session = sessions[targetKey] || Object.values(sessions)[0];

      return (session as any)?.systemId || (session as any)?.id || null;
    } catch (error) {
      // File not found or parse error - not fatal
      return null;
    }
  }

  /**
   * Validate and refresh session if needed.
   * Priority:
   *   1. Read from sessions.json (survives Gateway restart + daily rotation)
   *   2. Fallback to user-configured session ID in settings
   *   3. Fallback to Gateway API session listing
   * Returns true if session is valid, false if needs user intervention.
   */
  private async validateSession(): Promise<boolean> {
    const now = Date.now();
    const SESSION_CACHE_MS = 60 * 60 * 1000; // 1 hour cache (balance freshness vs file I/O)

    // Skip if recently validated
    if (this.sessionId && (now - this.sessionValidatedAt) < SESSION_CACHE_MS) {
      return true;
    }

    // Priority 1: Read from sessions.json (auto-tracks daily rotation)
    const fromFile = await this.readSessionFromFile();
    if (fromFile) {
      if (this.sessionId !== fromFile) {
        console.log('[OpenClawService] Session from sessions.json:', fromFile);
        this.sessionId = fromFile;
      }
      this.sessionValidatedAt = now;
      return true;
    }

    // Priority 2: User-configured session ID (manual override)
    const configuredSessionId = this.plugin.settings.openClawSessionId;
    if (configuredSessionId && configuredSessionId.trim()) {
      if (this.sessionId !== configuredSessionId) {
        console.log('[OpenClawService] Using configured session from settings:', configuredSessionId);
        this.sessionId = configuredSessionId;
      }
      this.sessionValidatedAt = now;
      return true;
    }

    // Priority 3: Try Gateway API (least reliable, but still useful)
    try {
      const response = await this.sendCommand('sessions', {});
      if (response.sessions && response.sessions.length > 0) {
        const detectedSessionId = response.sessions[0].id;
        if (this.sessionId !== detectedSessionId) {
          console.log('[OpenClawService] Auto-detected session via API:', detectedSessionId);
          this.sessionId = detectedSessionId;
        }
        this.sessionValidatedAt = now;
        return true;
      }
    } catch (error) {
      console.warn('[OpenClawService] Failed to list sessions:', (error as Error).message);
    }

    // No session available
    this.sessionId = null;
    this.sessionValidatedAt = 0;
    return false;
  }

  /**
   * Dynamic configuration: set permission mode
   * Maps plugin's permission mode to OpenClaw's tool-level permissions
   */
  async setPermissionMode(mode: PermissionMode): Promise<void> {
    // Get active session from sessionManager
    const session = this.sessionManager.getActiveSession();
    if (!session) {
      throw new Error('No active session');
    }
    
    // Map plugin permission mode to OpenClaw permission directives
    const permissionMap: Record<PermissionMode, string> = {
      'yolo': '/permission all allow',
      'normal': '/permission all ask',
      'plan': '/permission plan enable',
    };
    
    await this.sendCommand('agent', {
      sessionKey: session.channelKey,
      message: permissionMap[mode],
      idempotencyKey: `permission-${Date.now()}`,
    });
  }

  /**
   * Session management: create new session
   */
  async createSession(): Promise<string> {
    const response = await this.sendCommand('session.create', {
      workingDirectory: this.vaultPath,
    });
    this.sessionId = response.sessionId;
    return response.sessionId;
  }

  /**
   * Session management: resume session
   */
  async resumeSession(sessionId: string): Promise<void> {
    await this.sendCommand('session.resume', { sessionId });
    this.sessionId = sessionId;
  }

  /**
   * Reset session
   */
  resetSession(): void {
    this.sessionId = null;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Set session ID (for restoration)
   */
  setSessionId(id: string | null): void {
    this.sessionId = id;
  }

  /**
   * Start a fresh OpenClaw session for a new conversation.
   * This creates a new session immediately, ensuring session isolation.
   * 
   * @param _externalContextPaths - External context paths (reserved for future use)
   * @returns true if successfully started, false otherwise
   */
  async startNewSession(_externalContextPaths?: string[]): Promise<boolean> {
    try {
      // Ensure connection to Gateway
      await this.connect();

      // Reset current session
      this.sessionId = null;
      this.sessionValidatedAt = 0;

      // Create a new session
      const newSessionId = await this.createSession();
      console.log('[OpenClawService] New session created:', newSessionId);

      new Notice('OpenClaw session ready');
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to start OpenClaw session';
      console.error('[OpenClawService] startNewSession failed:', msg);
      new Notice(msg);
      return false;
    }
  }

  /**
   * Cancel current query
   */
  cancel(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendCommand('agent.cancel', {});
    }
  }

  /**
   * Check if service is ready (connected to Gateway)
   */
  isReady(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.responseHandlers = [];
  }

  // Callback setters (maintain API compatibility with EleService)

  setApprovalCallback(callback: ApprovalCallback | null): void {
    this.approvalCallback = callback;
  }

  setAskUserQuestionCallback(callback: AskUserQuestionCallback | null): void {
    this.askUserQuestionCallback = callback;
  }

  setExitPlanModeCallback(callback: ExitPlanModeCallback | null): void {
    this.exitPlanModeCallback = callback;
  }

  setPermissionModeSyncCallback(callback: ((mode: string) => void) | null): void {
    this.permissionModeSyncCallback = callback;
  }

  setApprovalDismisser(_dismisser: (() => void) | null): void {
    // Not implemented for OpenClaw (no persistent approval modal)
  }

  // Stub methods for API compatibility (not implemented in OpenClaw)

  async getSupportedCommands(): Promise<any[]> {
    // TODO: Implement via Gateway command
    return [];
  }

  async rewindFiles(_sdkUserUuid: string, _dryRun?: boolean): Promise<any> {
    throw new Error('Rewind not implemented for OpenClaw');
  }

  async rewind(_sdkUserUuid: string, _sdkAssistantUuid: string): Promise<any> {
    throw new Error('Rewind not implemented for OpenClaw');
  }

  consumeSessionInvalidation(): boolean {
    return false;
  }

  async reloadMcpServers(): Promise<void> {
    // TODO: Implement via Gateway command
  }

  async ensureReady(_options?: any): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }

  isPersistentQueryActive(): boolean {
    return this.isReady();
  }

  closePersistentQuery(_reason?: string): void {
    // No-op for OpenClaw (Gateway manages persistence)
  }

  onReadyStateChange(listener: (ready: boolean) => void): () => void {
    // Immediately call with current state
    listener(this.isReady());

    // Return no-op unsubscribe (TODO: implement proper state tracking)
    return () => {};
  }

  setPendingResumeAt(_uuid: string | undefined): void {
    // No-op for OpenClaw
  }

  applyForkState(_conv: any): string | null {
    // No-op for OpenClaw
    return null;
  }
}
