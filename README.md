# Ele

An Obsidian plugin that embeds OpenClaw AI agent with Kimi K2.5 backend as an AI collaborator in your vault. Your vault becomes the agent's working directory, giving it full agentic capabilities: file read/write, search, bash commands, and multi-step workflows.

## Features

- **Full Agentic Capabilities**: Leverage OpenClaw's power to read, write, and edit files, search, and execute bash commands, all within your Obsidian vault.
- **OpenClaw Gateway Integration**: Direct WebSocket connection to OpenClaw Gateway for real-time agent communication.
- **Kimi K2.5 Backend**: Powered by Moonshot AI's Kimi K2.5 model with extended thinking capabilities.
- **Context-Aware**: Automatically attach the focused note, mention files with `@`, exclude notes by tag, include editor selection (Highlight), and access external directories for additional context.
- **Vision Support**: Analyze images by sending them via drag-and-drop, paste, or file path.
- **Inline Edit**: Edit selected text or insert content at cursor position directly in notes with word-level diff preview.
- **Instruction Mode (`#`)**: Add refined custom instructions to your system prompt directly from the chat input, with review/edit in a modal.
- **Slash Commands**: Create reusable prompt templates triggered by `/command`, with argument placeholders and `@file` references.
- **Skills**: Extend Ele with reusable capability modules that are automatically invoked based on context.
- **Custom Agents**: Define custom subagents that the AI can invoke, with support for tool restrictions and model overrides.
- **MCP Support**: Connect external tools and data sources via Model Context Protocol servers (stdio, SSE, HTTP) with context-saving mode and `@`-mention activation.
- **Plan Mode**: Toggle plan mode via Shift+Tab in the chat input. Ele explores and designs before implementing, presenting a plan for approval.
- **Security**: Permission modes (YOLO/Safe/Plan), safety blocklist, and vault confinement with symlink-safe checks.

## Requirements

- [OpenClaw Gateway](https://github.com/openclaw/gateway) running locally or remotely
- Obsidian v1.8.9+
- Kimi API key (from [Moonshot AI](https://platform.moonshot.ai/))
- Desktop only (macOS, Linux, Windows)

## Installation

### From GitHub Release (recommended)

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/donglongfei/ele/releases/latest)
2. Create a folder called `ele` in your vault's plugins folder:
   ```
   /path/to/vault/.obsidian/plugins/ele/
   ```
3. Copy the downloaded files into the `ele` folder
4. Enable the plugin in Obsidian:
   - Settings → Community plugins → Enable "Ele"

### From source (development)

1. Clone this repository into your vault's plugins folder:
   ```bash
   cd /path/to/vault/.obsidian/plugins
   git clone https://github.com/donglongfei/ele.git
   cd ele
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Enable the plugin in Obsidian:
   - Settings → Community plugins → Enable "Ele"

### Development

```bash
# Watch mode
npm run dev

# Production build
npm run build

# Type check
npm run typecheck

# Run tests
npm run test
```

## Usage

**Two modes:**
1. Click the bot icon in ribbon or use command palette to open chat
2. Select text + hotkey for inline edit

Use it like an AI coding assistant—read, write, edit, search files in your vault.

### Context

- **File**: Auto-attaches focused note; type `@` to attach other files
- **@-mention dropdown**: Type `@` to see MCP servers, agents, external contexts, and vault files
  - `@Agents/` shows custom agents for selection
  - `@mcp-server` enables context-saving MCP servers
  - `@folder/` filters to files from that external context (e.g., `@workspace/`)
  - Vault files shown by default
- **Selection**: Select text in editor, or elements in canvas, then chat—selection included automatically
- **Images**: Drag-drop, paste, or type path; configure media folder for `![[image]]` embeds
- **External contexts**: Click folder icon in toolbar for access to directories outside vault

### Features

- **Inline Edit**: Select text + hotkey to edit directly in notes with word-level diff preview
- **Instruction Mode**: Type `#` to add refined instructions to system prompt
- **Slash Commands**: Type `/` for custom prompt templates or skills
- **Skills**: Add `skill/SKILL.md` files to `{vault}/.opencode/skills/`
- **Custom Agents**: Add `agent.md` files to `{vault}/.opencode/agents/` (vault-specific); select via `@Agents/` in chat
- **MCP**: Add external tools via Settings → MCP Servers; use `@mcp-server` in chat to activate

## Configuration

### OpenClaw Gateway Setup

1. Start OpenClaw Gateway:
   ```bash
   openclaw gateway start
   ```

2. Configure Ele settings:
   - **Gateway URL**: WebSocket URL (default: `ws://127.0.0.1:18789`)
   - **Auth Token**: Initial authentication token from Gateway
   - **Device Token**: Automatically obtained after first pairing
   - **Session ID**: Get from `openclaw sessions` command

### Settings

**OpenClaw Connection**
- **Gateway URL**: OpenClaw Gateway WebSocket endpoint
- **Auth Token**: Authentication token for initial pairing
- **Device Token**: Device token after successful pairing (auto-filled)
- **Session ID**: Session ID to use for agent requests

**Customization**
- **User name**: Your name for personalized greetings
- **Excluded tags**: Tags that prevent notes from auto-loading (e.g., `sensitive`, `private`)
- **Media folder**: Configure where vault stores attachments for embedded image support (e.g., `attachments`)
- **Custom system prompt**: Additional instructions appended to the default system prompt (Instruction Mode `#` saves here)
- **Enable auto-scroll**: Toggle automatic scrolling to bottom during streaming (default: on)
- **Auto-generate conversation titles**: Toggle AI-powered title generation after the first user message is sent
- **Title generation model**: Model used for auto-generating conversation titles (default: Auto/Haiku)

**Hotkeys**
- **Inline edit hotkey**: Hotkey to trigger inline edit on selected text
- **Open chat hotkey**: Hotkey to open the chat sidebar

**Slash Commands**
- Create/edit/import/export custom `/commands` (optionally override model and allowed tools)

**MCP Servers**
- Add/edit/verify/delete MCP server configurations with context-saving mode

**Safety**
- **Enable command blocklist**: Block dangerous bash commands (default: on)
- **Blocked commands**: Patterns to block (supports regex, platform-specific)
- **Allowed export paths**: Paths outside the vault where files can be exported (default: `~/Desktop`, `~/Downloads`). Supports `~`, `$VAR`, `${VAR}`, and `%VAR%` (Windows).

**Environment**
- **Custom variables**: Environment variables for the agent (KEY=VALUE format, supports `export ` prefix)
- **Environment snippets**: Save and restore environment variable configurations

## Safety and Permissions

| Scope | Access |
|-------|--------|
| **Vault** | Full read/write (symlink-safe via `realpath`) |
| **Export paths** | Write-only (e.g., `~/Desktop`, `~/Downloads`) |
| **External contexts** | Full read/write (session-only, added via folder icon) |

- **YOLO mode**: No approval prompts; all tool calls execute automatically (default)
- **Safe mode**: Approval prompt per tool call; Bash requires exact match, file tools allow prefix match
- **Plan mode**: Explores and designs a plan before implementing. Toggle via Shift+Tab in the chat input

## Privacy & Data Use

- **Sent to API**: Your input, attached files, images, and tool call outputs sent to OpenClaw Gateway, which forwards to Kimi API.
- **Local storage**: Settings, session metadata, and commands stored in `vault/.opencode/`; session messages in `~/.openclaw/`.
- **No telemetry**: No tracking beyond your configured OpenClaw Gateway.

## Architecture

```
src/
├── main.ts                      # Plugin entry point
├── core/                        # Core infrastructure
│   ├── agent/                   # OpenClaw Gateway wrapper (EleService, OpenClawService)
│   ├── agents/                  # Custom agent management (AgentManager)
│   ├── commands/                # Slash command management
│   ├── hooks/                   # PreToolUse/PostToolUse hooks
│   ├── images/                  # Image caching and loading
│   ├── mcp/                     # MCP server config, service, and testing
│   ├── prompts/                 # System prompts for agents
│   ├── sdk/                     # SDK message transformation
│   ├── security/                # Approval, blocklist, path validation
│   ├── storage/                 # Distributed storage system
│   ├── tools/                   # Tool constants and utilities
│   └── types/                   # Type definitions
├── features/                    # Feature modules
│   ├── chat/                    # Main chat view + UI, rendering, controllers, tabs
│   ├── inline-edit/             # Inline edit service + UI
│   └── settings/                # Settings tab UI
├── shared/                      # Shared UI components and modals
│   ├── components/              # Input toolbar bits, dropdowns, selection highlight
│   ├── mention/                 # @-mention dropdown controller
│   ├── modals/                  # Instruction modal
│   └── icons/                   # Shared SVG icons
├── i18n/                        # Internationalization (10 locales)
├── utils/                       # Modular utility functions
└── style/                       # Modular CSS (→ styles.css)
```

## License

Licensed under the [MIT License](LICENSE).

## Acknowledgments

- [Obsidian](https://obsidian.md) for the plugin API
- [OpenClaw](https://github.com/openclaw) for the Gateway architecture
- [Moonshot AI](https://platform.moonshot.ai/) for Kimi K2.5 model
- Original [Claudian](https://github.com/YishenTu/claudian) project for the foundation
