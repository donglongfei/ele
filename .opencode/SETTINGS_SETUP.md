# Web Scraper Setup - Plugin Settings Method

## ✅ Setup Complete!

All web scraper configuration is now managed through **Plugin Settings UI** - no need to edit environment variables!

---

## Quick Setup (3 Steps)

### Step 1: Open Plugin Settings

**Obsidian Settings → Ele → Web Scraper Tool**

You'll see these configurable fields:

| Setting | Default | Description |
|---------|---------|-------------|
| **Node.js Binary Path** | Auto-detect | Path to node (e.g., `/opt/homebrew/bin/node`) |
| **Scraper Script Path** | `$HOME/.openclaw/workspace/tools/web-scraper/scraper.js` | Path to scraper tool |
| **Output Directory** | `Clippings` | Where to save clippings (relative to vault) |
| **Request Delay (ms)** | `2000` | Delay between requests |
| **Page Load Timeout (ms)** | `60000` | Max time to load pages |

### Step 2: Auto-Detect Node.js (Recommended)

1. Click the **🔍 search icon** next to "Node.js Binary Path"
2. The plugin will auto-detect node from your PATH
3. If found, it will show the path (e.g., `/opt/homebrew/bin/node`)

**Or manually specify:**
- Intel Mac: `/usr/local/bin/node`
- Apple Silicon: `/opt/homebrew/bin/node`
- nvm: `~/.nvm/versions/node/vXX.XX.X/bin/node`

### Step 3: Verify Scraper Tool Path

The default path should work if you installed the tool to:
```
~/.openclaw/workspace/tools/web-scraper/scraper.js
```

If you installed it elsewhere, update the path.

### Step 4: Reload & Test

1. Press **`Cmd+R`** to reload Obsidian
2. Open Ele chat
3. Test:  `/scrape-web https://example.com --dry-run`

---

## ✨ What This Changes

### Before (Environment Variables)
❌ Had to manually edit environment variables
❌ Syntax errors possible (bash syntax)
❌ No validation or auto-detection
❌ Hidden in text field

### After (Plugin Settings UI)
✅ Visual configuration interface
✅ Auto-detect Node.js with one click
✅ Input validation
✅ Clear labels and descriptions
✅ Easy to modify

---

## Configuration Details

### Node.js Binary Path

**Leave empty for auto-detection** (recommended)

The plugin will find node in your PATH automatically.

**Or specify manually:**
```
/opt/homebrew/bin/node          # Apple Silicon (M1/M2/M3)
/usr/local/bin/node             # Intel Mac
~/.nvm/versions/node/v20.11.0/bin/node  # nvm
```

**Auto-detect:**
Click the 🔍 icon and the plugin will search these locations:
1. `command -v node` (current PATH)
2. `/opt/homebrew/bin/node` (Homebrew Apple Silicon)
3. `/usr/local/bin/node` (Homebrew Intel)

### Scraper Script Path

Default: `$HOME/.openclaw/workspace/tools/web-scraper/scraper.js`

**Supports:**
- `$HOME` expansion → your home directory
- `~` expansion → your home directory
- Absolute paths → `/full/path/to/scraper.js`
- Relative paths → `./tools/scraper.js` (relative to vault)

### Output Directory

Default: `Clippings`

**Options:**
- Relative to vault: `Clippings`, `Research/Articles`
- Absolute path: `$HOME/Documents/Web Clippings`
- With spaces: `My Clippings` (works fine)

### Request Delay

Default: `2000` ms (2 seconds)

How long to wait between scraping multiple URLs to avoid rate limiting.

**Recommended values:**
- Fast sites: `1000` ms
- Normal: `2000` ms
- Conservative: `5000` ms

### Page Load Timeout

Default: `60000` ms (60 seconds)

Maximum time to wait for a page to fully load.

**Recommended values:**
- Fast sites: `30000` ms
- Normal: `60000` ms
- Slow sites: `120000` ms

---

## Usage

After configuring settings, use the command normally:

```
/scrape-web https://example.com
/scrape-web https://article.com --category 02-AI-Infrastructure
/scrape-web --input .obsidian/bookmarks.json
/scrape-web https://example.com --dry-run
```

The plugin automatically uses your configured settings!

---

## Troubleshooting

### "node: command not found"

**Solution 1: Auto-detect**
1. Settings → Ele → Web Scraper Tool
2. Click 🔍 icon next to "Node.js Binary Path"

**Solution 2: Manual**
1. Find node: `which node` in terminal
2. Copy the path (e.g., `/opt/homebrew/bin/node`)
3. Paste into "Node.js Binary Path" field

### "scraper.js not found"

**Check installation:**
```bash
ls -la ~/.openclaw/workspace/tools/web-scraper/scraper.js
```

**If missing:**
```bash
cd ~/.openclaw/workspace/tools/web-scraper
npm install
npx playwright install chromium
```

**Update path in settings** if you installed elsewhere.

### Settings not taking effect

1. Reload Obsidian: `Cmd+R`
2. Check settings were saved (re-open settings to verify)

---

## Advanced: Custom Configuration

### Multiple Output Directories

You can't configure multiple directories in settings, but you can override per-command:

```
/scrape-web https://example.com --output "Research/Papers"
/scrape-web https://blog.com --output "$HOME/Dropbox/Articles"
```

### Different Node Versions

If you use nvm and want specific node version:

```
~/.nvm/versions/node/v20.11.0/bin/node
```

---

## For Developers: How It Works

### Settings Storage

Settings are stored in `.opencode/ele-settings.json`:

```json
{
  "webScraperNodeBin": "/opt/homebrew/bin/node",
  "webScraperToolPath": "$HOME/.openclaw/workspace/tools/web-scraper/scraper.js",
  "webScraperOutputDir": "Clippings",
  "webScraperDelay": 2000,
  "webScraperTimeout": 60000
}
```

### Auto-Detection Logic

When you click the auto-detect button, the plugin runs:

```typescript
findNodeExecutable()
  → checks: command -v node
  → checks: /opt/homebrew/bin/node
  → checks: /usr/local/bin/node
  → returns first found
```

### Command Execution

The AI receives the command prompt which references "plugin settings", and constructs commands like:

```bash
node ~/.openclaw/workspace/tools/web-scraper/scraper.js \
  --url "https://example.com" \
  --output "Clippings"
```

Node is resolved from PATH (or explicit path from settings).

---

## Distribution

When sharing your setup:

1. ✅ **Share:** `.opencode/commands/scrape-web.md`
2. ✅ **Share:** Web scraper tool directory
3. ✅ **Instruct users:** Configure via Settings → Ele → Web Scraper Tool
4. ✅ **They click:** Auto-detect button for Node.js

**No manual file editing required!** 🎉
