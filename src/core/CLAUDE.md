# Core Infrastructure

Core modules have **no feature dependencies**. Features depend on core, never the reverse.

## Modules

| Module | Purpose | Key Files |
|--------|---------|-----------|
| `agent/` | OpenClaw Gateway wrapper | `EleService` (incl. fork session tracking), `OpenClawService`, `SessionManager`, `QueryOptionsBuilder`, `MessageChannel`, `customSpawn` |
| `agents/` | Custom agent discovery | `AgentManager`, `AgentStorage` |
| `commands/` | Built-in command actions | `builtInCommands` |
| `hooks/` | Security hooks | `SecurityHooks` |
| `images/` | Image caching | SHA-256 dedup, base64 encoding |
| `mcp/` | Model Context Protocol | `McpServerManager`, `McpTester` |
| `skills/` | OpenClaw skills (SKILL.md) | `SkillStorage` |
| `prompts/` | System prompts | `mainAgent`, `inlineEdit`, `instructionRefine`, `titleGeneration` |
| `sdk/` | SDK message transform | `transformSDKMessage`, `typeGuards`, `types` |
| `security/` | Access control | `ApprovalManager` (permission utilities), `BashPathValidator`, `BlocklistChecker` |
| `storage/` | Persistence layer | `StorageService`, `SessionStorage`, `CCSettingsStorage`, `EleSettingsStorage`, `McpStorage`, `SkillStorage`, `SlashCommandStorage`, `VaultFileAdapter` |
| `tools/` | Tool utilities | `toolNames` (incl. plan mode tools), `toolIcons`, `toolInput`, `todo` |
| `types/` | Type definitions | `settings`, `agent`, `mcp`, `chat` (incl. `forkSource?: { sessionId, resumeAt }`), `tools`, `models`, `sdk`, `diff` |

## Dependency Rules

```
types/ ← (all modules can import)
storage/ ← security/, agent/, mcp/
security/ ← agent/
sdk/ ← agent/
hooks/ ← agent/
prompts/ ← agent/
```

## Key Patterns

### EleService
```typescript
// One instance per tab (lazy init on first query)
const service = new EleService(plugin, mcpManager);
await service.query(prompt, options);  // Returns async iterator
service.abort();  // Cancel streaming
```

### OpenClawService
```typescript
// WebSocket connection to OpenClaw Gateway
const openClawService = new OpenClawService(plugin, vaultPath);
await openClawService.sendMessage(message);  // Send to Gateway
```

### QueryOptionsBuilder
```typescript
// Builds query options from settings
const builder = new QueryOptionsBuilder(plugin, settings);
const options = builder.build({ sessionId, maxThinkingTokens });
```

### Storage (OpenClaw pattern)
```typescript
// Settings in vault/.opencode/settings.json
await CCSettingsStorage.load(vaultPath);
await CCSettingsStorage.save(vaultPath, settings);

// Sessions: OpenClaw Gateway (~/.openclaw/) + metadata overlay (.meta.json)
await SessionStorage.loadSession(vaultPath, sessionId);
```

### Security
- `BashPathValidator`: Vault-only by default, symlink-safe via `realpath`
- `ApprovalManager`: Permission utility functions (`buildPermissionUpdates`, `matchesRulePattern`, etc.)
- `BlocklistChecker`: Platform-specific dangerous commands

## Gotchas

- `EleService` must be disposed on tab close (abort + cleanup)
- `SessionManager` handles OpenClaw session resume via `sessionId`
- Fork uses `pendingForkSession` + `pendingResumeAt` on `EleService` to pass resume point; these are one-shot flags consumed on the next query
- Storage paths are encoded: non-alphanumeric → `-`
- `customSpawn` handles cross-platform process spawning
- Plan mode uses dedicated callbacks (`exitPlanModeCallback`, `permissionModeSyncCallback`) that bypass normal approval flow in `canUseTool`. `EnterPlanMode` is auto-approved; the stream event is detected to sync UI state.
