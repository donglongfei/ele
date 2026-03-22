# Quick Start Checklist

## ✅ Setup Complete - Ready to Configure

### Files Created

```
.opencode/
├── commands/
│   └── scrape-web.md          ✅ Slash command (fully configurable)
├── WEB_SCRAPER_SETUP.md       ✅ Complete setup guide
├── ENVIRONMENT_CONFIG.md      ✅ Environment configuration reference
└── QUICK_START.md             ✅ This file
```

### Your Next Steps

#### 1. Configure Environment Variables (One-Time Setup)

Open **Obsidian Settings → Ele → Environment → Custom variables** and paste:

```bash
# ============================================
# Web Scraper Tool Configuration
# ============================================

# PATH Configuration (works on all Macs)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Node.js Binary (auto-detect)
export NODE_BIN=$(command -v node 2>/dev/null || \
  ([ -x /opt/homebrew/bin/node ] && echo /opt/homebrew/bin/node) || \
  ([ -x /usr/local/bin/node ] && echo /usr/local/bin/node) || \
  echo node)

# Web Scraper Tool Path
export WEB_SCRAPER_TOOL="$HOME/.openclaw/workspace/tools/web-scraper/scraper.js"

# Default Output Directory
export WEB_SCRAPER_OUTPUT="Clippings"
```

Then click **Apply/Save**.

#### 2. Reload Obsidian

Press **`Cmd+R`**

This loads the `/scrape-web` command and applies environment variables.

#### 3. Test the Command

Open Ele chat and run:

```
/scrape-web https://example.com --dry-run
```

**Expected:** Preview without saving (to verify configuration works)

#### 4. Real Scrape Test

```
/scrape-web https://example.com
```

**Expected:** File saved to `Clippings/06-Uncategorized/example.md`

---

## ✨ What We Accomplished

### ✅ Fully Configurable Design

**ALL tools configured in plugin settings:**
- ✅ `NODE_BIN` - Node.js path (auto-detected or manual)
- ✅ `WEB_SCRAPER_TOOL` - Scraper script location
- ✅ `WEB_SCRAPER_OUTPUT` - Default output directory
- ✅ `PATH` - Binary search paths

**Benefits:**
- ✅ **No hardcoded paths** in command
- ✅ **Works on all Macs** (Intel + Apple Silicon)
- ✅ **Customizable** per user/system
- ✅ **Portable** - share command, users configure once
- ✅ **Maintainable** - change paths in one place

### ✅ Clean Architecture

```
Command (.opencode/commands/scrape-web.md)
├─ Uses: $NODE_BIN (from settings)
├─ Uses: $WEB_SCRAPER_TOOL (from settings)
├─ Uses: $WEB_SCRAPER_OUTPUT (from settings)
├─ Uses: $VAULT_PATH (dynamic)
└─ Uses: $ARGUMENTS (user input)

Settings (Obsidian → Ele → Environment)
├─ NODE_BIN="/opt/homebrew/bin/node"
├─ WEB_SCRAPER_TOOL="~/.openclaw/..."
└─ WEB_SCRAPER_OUTPUT="Clippings"

Tool (~/.openclaw/workspace/tools/web-scraper/)
└─ Shared, system-independent
```

**Principle:** Configuration in settings, pure logic in commands!

---

## 🔧 Customization Examples

### Change Output Location

**Save to Documents:**
```bash
export WEB_SCRAPER_OUTPUT="$HOME/Documents/Web Clippings"
```

**Save to Dropbox:**
```bash
export WEB_SCRAPER_OUTPUT="$HOME/Dropbox/Research/Articles"
```

**Vault subfolder:**
```bash
export WEB_SCRAPER_OUTPUT="Research/Clippings"
```

### Use Specific Node Version

**Explicit path:**
```bash
export NODE_BIN="/opt/homebrew/bin/node"
```

**nvm-specific version:**
```bash
export NODE_BIN="$HOME/.nvm/versions/node/v20.11.0/bin/node"
```

### Custom Tool Location

```bash
export WEB_SCRAPER_TOOL="$HOME/my-tools/scraper.js"
```

See `ENVIRONMENT_CONFIG.md` for more examples!

---

## 🎯 Next Phase: Auto-Skill

After the slash command works perfectly:

1. **Implement auto-skill version**
   - AI detects URLs in conversation
   - Auto-triggers scraping on intent detection
   - Natural language: "Save this article for me: URL"

2. **Test both workflows**
   - Explicit: `/scrape-web URL`
   - Natural: "Hey, save this: URL"

3. **Refine categorization**
   - Tune keyword patterns
   - Add custom categories
   - Test accuracy

---

## 📋 Troubleshooting Quick Reference

| Error | Solution | Reference |
|-------|----------|-----------|
| `NODE_BIN: command not found` | Check NODE_BIN in settings | ENVIRONMENT_CONFIG.md |
| Command not in dropdown | Press `Cmd+R` to reload | - |
| Permission denied | Settings → Safety → YOLO/Safe | WEB_SCRAPER_SETUP.md |
| scraper.js not found | Check WEB_SCRAPER_TOOL path | ENVIRONMENT_CONFIG.md |
| Output directory error | Check WEB_SCRAPER_OUTPUT | ENVIRONMENT_CONFIG.md |

---

## 🚀 Ready to Test!

**Your action:**
1. ✅ Copy environment config to settings
2. ✅ Click Apply/Save
3. ✅ Reload: `Cmd+R`
4. ✅ Test: `/scrape-web https://example.com --dry-run`

Let me know when it works or if you need help with configuration!
