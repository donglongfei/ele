# CLAUDE.md

## Project Overview

Ele - An Obsidian plugin that embeds OpenClaw AI agent with Kimi K2.5 backend as a sidebar chat interface. The vault directory becomes the agent's working directory, giving it full agentic capabilities: file read/write, bash commands, and multi-step workflows.

## Commands

```bash
npm run dev        # Development (watch mode)
npm run build      # Production build
npm run typecheck  # Type check
npm run lint       # Lint code
npm run lint:fix   # Lint and auto-fix
npm run test       # Run tests
npm run test:watch # Run tests in watch mode
```

## Architecture

| Layer | Purpose | Details |
|-------|---------|---------|
| **core** | Infrastructure (no feature deps) | See [`src/core/CLAUDE.md`](src/core/CLAUDE.md) |
| **features/chat** | Main sidebar interface | See [`src/features/chat/CLAUDE.md`](src/features/chat/CLAUDE.md) |
| **features/inline-edit** | Inline edit modal | `InlineEditService`, read-only tools |
| **features/settings** | Settings tab | UI components for all settings |
| **shared** | Reusable UI | Dropdowns, instruction modal, fork target modal, @-mention, icons |
| **i18n** | Internationalization | 10 locales |
| **utils** | Utility functions | date, path, env, editor, session, markdown, diff, context, sdkSession, frontmatter, slashCommand, mcp, externalContext, externalContextScanner, fileLink, imageEmbed, inlineEdit, crypto |
| **style** | Modular CSS | See [`src/style/CLAUDE.md`](src/style/CLAUDE.md) |

## Tests

```bash
npm run test -- --selectProjects unit        # Run unit tests
npm run test -- --selectProjects integration # Run integration tests
npm run test:coverage -- --selectProjects unit # Unit coverage
```

Tests mirror `src/` structure in `tests/unit/` and `tests/integration/`.

## Storage

| File | Contents |
|------|----------|
| `.opencode/settings.json` | OpenClaw-compatible: permissions, env |
| `.opencode/ele-settings.json` | Ele-specific settings (model, UI, OpenClaw connection, etc.) |
| `.opencode/settings.local.json` | Local overrides (gitignored) |
| `.opencode/mcp.json` | MCP server configs |
| `.opencode/commands/*.md` | Slash commands (YAML frontmatter) |
| `.opencode/agents/*.md` | Custom agents (YAML frontmatter) |
| `.opencode/skills/*/SKILL.md` | Skill definitions |
| `.opencode/sessions/*.meta.json` | Session metadata |
| `~/.openclaw/agents/{agent}/sessions/*.jsonl` | OpenClaw session messages |

## Development Notes

- **OpenClaw Gateway**: Ele communicates with OpenClaw Gateway via WebSocket for all agent operations. No direct SDK usage.
- **Device Pairing**: Uses Ed25519 key pairs for secure device authentication with OpenClaw Gateway. See `DEVICE_PAIRING.md` for details.
- **Comments**: Only comment WHY, not WHAT. No JSDoc that restates the function name (`/** Get servers. */` on `getServers()`), no narrating inline comments (`// Create the channel` before `new Channel()`), no module-level docs on barrel `index.ts` files. Keep JSDoc only when it adds non-obvious context (edge cases, constraints, surprising behavior).
- **TDD workflow**: For new functions/modules and bug fixes, follow red-green-refactor:
  1. Write a failing test first in the mirrored path under `tests/unit/` (or `tests/integration/`)
  2. Run it with `npm run test -- --selectProjects unit --testPathPattern <pattern>` to confirm it fails
  3. Write the minimal implementation to make it pass
  4. Refactor, keeping tests green
  - For bug fixes, write a test that reproduces the bug before fixing it
  - Test behavior and public API, not internal implementation details
  - Skip TDD for trivial changes (renaming, moving files, config tweaks) — but still verify existing tests pass
- Run `npm run typecheck && npm run lint && npm run test && npm run build` after editing
- No `console.*` in production code
  - use Obsidian's notification system if user should be notified
  - use `console.log` for debugging, but remove it before committing
- Generated docs/test scripts go in `dev/`.
