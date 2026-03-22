# Ele Environment Configuration for Web Scraper

## Copy-Paste Configuration Template

**Paste this into Obsidian Settings → Ele → Environment → Custom variables:**

```bash
# ============================================
# Web Scraper Tool Configuration
# ============================================

# PATH Configuration (works on all Macs)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Node.js Binary
# Auto-detect or specify manually
export NODE_BIN=$(command -v node 2>/dev/null || \
  ([ -x /opt/homebrew/bin/node ] && echo /opt/homebrew/bin/node) || \
  ([ -x /usr/local/bin/node ] && echo /usr/local/bin/node) || \
  echo node)

# Web Scraper Tool Path
export WEB_SCRAPER_TOOL="$HOME/.openclaw/workspace/tools/web-scraper/scraper.js"

# Default Output Directory (where clippings are saved)
# Uses vault-relative path by default, change if needed
export WEB_SCRAPER_OUTPUT="Clippings"

# Optional: Custom Playwright Browser Path
# export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"

# Optional: Scraper Default Settings
# export WEB_SCRAPER_DELAY=2000        # Delay between requests (ms)
# export WEB_SCRAPER_TIMEOUT=60000     # Page load timeout (ms)
```

## Platform-Specific Configurations

### Apple Silicon (M1/M2/M3/M4)

```bash
export PATH="/opt/homebrew/bin:$PATH"
export NODE_BIN="/opt/homebrew/bin/node"
export WEB_SCRAPER_TOOL="$HOME/.openclaw/workspace/tools/web-scraper/scraper.js"
export WEB_SCRAPER_OUTPUT="Clippings"
```

### Intel Mac

```bash
export PATH="/usr/local/bin:$PATH"
export NODE_BIN="/usr/local/bin/node"
export WEB_SCRAPER_TOOL="$HOME/.openclaw/workspace/tools/web-scraper/scraper.js"
export WEB_SCRAPER_OUTPUT="Clippings"
```

### Using nvm

```bash
export NVM_DIR="$HOME/.nvm"
export PATH="$NVM_DIR/versions/node/$(ls -1 $NVM_DIR/versions/node | tail -1)/bin:$PATH"
export NODE_BIN="$(command -v node)"
export WEB_SCRAPER_TOOL="$HOME/.openclaw/workspace/tools/web-scraper/scraper.js"
export WEB_SCRAPER_OUTPUT="Clippings"
```

## Custom Output Locations

### Save to Documents

```bash
export WEB_SCRAPER_OUTPUT="$HOME/Documents/Web Clippings"
```

### Save to Vault Subfolder

```bash
export WEB_SCRAPER_OUTPUT="Research/Clippings"
```

### Save to External Directory

```bash
export WEB_SCRAPER_OUTPUT="$HOME/Dropbox/Research/Articles"
```

## Verification

After configuring, verify the settings work:

### Check in Terminal

```bash
# Check what values would be set
source <(cat <<'EOF'
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export NODE_BIN=$(command -v node 2>/dev/null || echo "NOT FOUND")
export WEB_SCRAPER_TOOL="$HOME/.openclaw/workspace/tools/web-scraper/scraper.js"
export WEB_SCRAPER_OUTPUT="Clippings"
EOF
)

echo "NODE_BIN: $NODE_BIN"
echo "WEB_SCRAPER_TOOL: $WEB_SCRAPER_TOOL"
echo "WEB_SCRAPER_OUTPUT: $WEB_SCRAPER_OUTPUT"

# Test if node is accessible
"$NODE_BIN" --version

# Test if scraper exists
ls -la "$WEB_SCRAPER_TOOL"
```

### Test in Ele

After adding configuration and reloading Obsidian (`Cmd+R`), test:

```
/scrape-web https://example.com --dry-run
```

## Environment Variable Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_BIN` | Node.js executable path | `/opt/homebrew/bin/node` |
| `WEB_SCRAPER_TOOL` | Scraper script path | `~/.openclaw/workspace/tools/web-scraper/scraper.js` |
| `WEB_SCRAPER_OUTPUT` | Default output directory | `Clippings` or `/Users/you/Documents/Articles` |
| `PATH` | Binary search paths | `/opt/homebrew/bin:/usr/local/bin:...` |

## Troubleshooting

### "NODE_BIN: command not found"

**Issue:** `NODE_BIN` variable not set correctly

**Solution:**
```bash
# Find your node path
which node

# Set explicitly
export NODE_BIN="/path/from/which/command"
```

### "WEB_SCRAPER_TOOL: No such file"

**Issue:** Scraper not installed

**Solution:**
```bash
cd ~/.openclaw/workspace/tools/web-scraper
npm install
npx playwright install chromium
```

### Output directory permission denied

**Issue:** `WEB_SCRAPER_OUTPUT` points to restricted location

**Solution:**
```bash
# Create directory with proper permissions
mkdir -p "$HOME/Documents/Clippings"
export WEB_SCRAPER_OUTPUT="$HOME/Documents/Clippings"
```

## Advanced Configuration

### Multiple Scraper Profiles

Create profile-specific configurations:

```bash
# Default profile
export WEB_SCRAPER_OUTPUT="Clippings"

# Research profile
export WEB_SCRAPER_OUTPUT_RESEARCH="$HOME/Documents/Research"

# Work profile
export WEB_SCRAPER_OUTPUT_WORK="$HOME/Work/Articles"
```

Then modify the command to use specific profiles when needed.

### Custom User Agent

```bash
# Add to scraper.js context configuration if needed
export WEB_SCRAPER_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
```

### Proxy Configuration

```bash
export HTTP_PROXY="http://proxy.example.com:8080"
export HTTPS_PROXY="http://proxy.example.com:8080"
```

## Best Practices

1. ✅ **Use auto-detection** for `NODE_BIN` (works across systems)
2. ✅ **Use `$HOME`** instead of absolute paths for portability
3. ✅ **Use relative paths** for vault directories when possible
4. ✅ **Test after changes** - Reload Obsidian and run test command
5. ✅ **Document custom settings** - Add comments explaining changes

## Distribution

When sharing your setup with others, give them:

1. **This configuration file** with your settings
2. **Clear instructions** on what to change (paths, etc.)
3. **Verification steps** to confirm it works

Users can copy your config and only change system-specific paths like `$HOME` (which should already be correct).
