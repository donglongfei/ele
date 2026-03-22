# Web Scraper Setup Guide

## One-Time Setup

### Step 1: Install Dependencies

```bash
cd ~/.openclaw/workspace/tools/web-scraper
npm install
npx playwright install chromium
```

### Step 2: Configure PATH in Ele Settings

**For ALL Mac users** (Intel or Apple Silicon):

1. Open **Obsidian Settings → Ele → Environment**

2. Click **Custom variables**

3. Add this configuration:

   ```bash
   # Universal PATH configuration for macOS
   # Works on Intel Macs, Apple Silicon (M1/M2/M3), nvm, and Homebrew
   export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
   ```

4. Click **Apply** or **Save**

5. **Reload Obsidian** (`Cmd+R`)

**Why this works:**
- `/opt/homebrew/bin` → Apple Silicon Macs (M1/M2/M3)
- `/usr/local/bin` → Intel Macs
- `$PATH` → Preserves existing paths (like nvm)

### Step 3: Verify Setup

Open Ele chat and run:

```
/scrape-web https://example.com --dry-run
```

**Expected output:**
```
[DRY RUN] Would save to: <vault>/Clippings/06-Uncategorized/example.md
```

✅ If you see this, setup is complete!

---

## Usage

### Basic Scraping

```
/scrape-web https://example.com/article
```

### With Category

```
/scrape-web https://nvidia.com/article --category 01-NVIDIA-Hardware
```

### Scrape All Bookmarks

```
/scrape-web --input .obsidian/bookmarks.json
```

### Custom Output Directory

```
/scrape-web https://example.com --output ~/Documents/Research
```

### Dry Run (Preview)

```
/scrape-web https://example.com --dry-run
```

---

## Troubleshooting

### Error: "node: command not found"

**Your node installation:**

Find where node is installed:
```bash
which node
```

**Common locations:**
- `/opt/homebrew/bin/node` → Apple Silicon + Homebrew
- `/usr/local/bin/node` → Intel Mac + Homebrew
- `~/.nvm/versions/node/vX.X.X/bin/node` → nvm

**Solution:**

Add the directory containing `node` to PATH in **Settings → Ele → Environment:**

```bash
# If using nvm
export PATH="$HOME/.nvm/versions/node/$(ls -1 ~/.nvm/versions/node | tail -1)/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# If using Homebrew only (recommended)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
```

### Error: "scraper.js not found"

Install the web scraper tool:

```bash
cd ~/.openclaw/workspace/tools/web-scraper
npm install
npx playwright install chromium
```

### Error: "Permission denied"

Change Ele permission mode:

- **Settings → Ele → Safety → Permission Mode**
- Set to **YOLO** or **Safe** (not Plan)

### Error: Playwright browser not found

Install Chromium for Playwright:

```bash
cd ~/.openclaw/workspace/tools/web-scraper
npx playwright install chromium
```

---

## Platform-Specific Notes

### Apple Silicon (M1/M2/M3/M4)

**Homebrew location:** `/opt/homebrew/`

**PATH config:**
```bash
export PATH="/opt/homebrew/bin:$PATH"
```

### Intel Mac

**Homebrew location:** `/usr/local/`

**PATH config:**
```bash
export PATH="/usr/local/bin:$PATH"
```

### Using nvm (Node Version Manager)

**Node location:** `~/.nvm/versions/node/<version>/bin/`

**PATH config:**
```bash
export NVM_DIR="$HOME/.nvm"
export PATH="$NVM_DIR/versions/node/$(ls -1 $NVM_DIR/versions/node | tail -1)/bin:$PATH"
```

### Universal Config (Recommended)

**Works on all Macs:**
```bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
```

This automatically uses the correct path depending on your Mac's architecture.

---

## Advanced Configuration

### Custom Categories

Edit `~/.openclaw/workspace/tools/web-scraper/scraper.js` and add to `CATEGORY_PATTERNS`:

```javascript
const CATEGORY_PATTERNS = {
  '08-My-Category': [
    /keyword1/i, /keyword2/i, /中文关键词/i
  ],
  // ... existing categories
};
```

### Rate Limiting

Scrape with delay between requests:

```
/scrape-web --input bookmarks.json --delay 5000
```

### Batch Processing

Create `urls.txt`:
```
https://example1.com
https://example2.com
https://example3.com
```

Scrape all:
```
/scrape-web --file urls.txt
```

---

## Distribution Guide

**To share this setup with other Mac users:**

1. ✅ **Include this setup guide** (WEB_SCRAPER_SETUP.md)
2. ✅ **Slash command file** (.opencode/commands/scrape-web.md)
3. ✅ **Web scraper tool** (~/.openclaw/workspace/tools/web-scraper/)
4. ✅ **Environment config instructions** (in this guide)

**Users only need to:**
1. Copy files to their system
2. Run `npm install` in web-scraper directory
3. Add PATH to Ele settings (one line)
4. Reload Obsidian

**No hardcoded paths!** All configuration is in plugin settings.
