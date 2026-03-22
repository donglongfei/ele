---
description: Scrape web content using Playwright browser automation and save as categorized Markdown in vault
argument-hint: [url] [category] [--embed-images]
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

You are an expert web scraping assistant using Playwright browser automation.

## 🎯 How This Works

This command uses a **Playwright headless browser** (same as this afternoon's successful batch scraping) to:
1. Load the URL in Chromium
2. Wait for JavaScript content to render
3. Extract full article text + images
4. Auto-categorize and save to vault

## 📋 Environment Variables (Auto-set from plugin settings)
- `$NODE_BIN` - Path to Node.js binary
- `$WEB_SCRAPER_TOOL` - Path to scraper.js (Playwright-based)
- `$WEB_SCRAPER_OUTPUT` - Output directory for clippings
- `$VAULT_PATH` - Current vault path

## 🚀 Usage

### Single URL with Auto-Categorization (Images as separate files)
```bash
"$NODE_BIN" "$WEB_SCRAPER_TOOL" \
  --url "$ARGUMENTS" \
  --output "${WEB_SCRAPER_OUTPUT:-$VAULT_PATH/Clippings}"
```

### Single URL with Embedded Images (Base64 in markdown)
```bash
"$NODE_BIN" "$WEB_SCRAPER_TOOL" \
  --url "<url>" \
  --embed-images \
  --output "${WEB_SCRAPER_OUTPUT:-$VAULT_PATH/Clippings}"
```

### Single URL with Specific Category
```bash
"$NODE_BIN" "$WEB_SCRAPER_TOOL" \
  --url "<url>" \
  --category "02-AI-Infrastructure" \
  --output "${WEB_SCRAPER_OUTPUT:-$VAULT_PATH/Clippings}"
```

### Batch Scrape from Bookmarks
```bash
"$NODE_BIN" "$WEB_SCRAPER_TOOL" \
  --input "$VAULT_PATH/.obsidian/bookmarks.json" \
  --output "${WEB_SCRAPER_OUTPUT:-$VAULT_PATH/Clippings}" \
  --delay 2000
```

## 📁 Auto-Categorization Categories

| Category | Keywords |
|----------|----------|
| `01-NVIDIA-Hardware` | NVIDIA, GPU, CUDA, Tensor, Blackwell, Hopper, Rubin, VLA, Vera, Grace, DGX, 液冷 |
| `02-AI-Infrastructure` | Data Center, Cluster, RDMA, NCCL, Network, Storage, Aegis, Alibaba, 万卡 |
| `03-Inference-Optimization` | Inference, Optimization, Roofline, DeepSeek, vLLM, 推理, 优化, 推理优化 |
| `04-Agent-RL` | Agent, RL, OpenClaw, Skill, 智能体, 强化学习 |
| `05-Personal-Growth` | Productivity, Growth, Writing, Career, 个人成长, 效率, 写作 |
| `07-Model-Architecture` | Transformer, Attention, Architecture, Paper, arXiv, MoE, Mamba, 模型架构 |
| `06-Uncategorized` | Default for unmatched content |

## 🖼️ Image Handling Modes

### Mode 1: Separate Files (Default)
- Images downloaded to `images/` subfolder
- Referenced in markdown as `![alt](images/filename.png)`
- Pros: Smaller markdown file, images reusable
- Cons: Multiple files per article

### Mode 2: Embedded Base64 (Use `--embed-images`)
- Images embedded as `data:image/png;base64,...` directly in markdown
- Pros: Single self-contained file, no external dependencies
- Cons: Larger markdown file size

## ⚡ Instructions

1. **Parse the user's $ARGUMENTS** to extract URL and optional flags
2. **Check for `--embed-images` flag** in arguments
3. **Build the command** using the environment variables above
4. **Execute with Bash tool** - use proper quoting for URLs
5. **Report results** - show saved file path, category, and image mode
6. **If failed** - check if tool exists and provide install instructions

## 🔧 Tool Installation (if missing)

If the tool is not installed:
```bash
cd ~/.openclaw/workspace/tools/web-scraper && bash install.sh
```

## 📝 Example Outputs

**Success (separate images):**
```
✅ Successfully scraped: https://example.com/article
📁 Saved to: Clippings/02-AI-Infrastructure/article-title.md
📊 Size: 45KB | Images: 5 files in images/ folder
```

**Success (embedded images):**
```
✅ Successfully scraped: https://example.com/article
📁 Saved to: Clippings/02-AI-Infrastructure/article-title.md
📊 Size: 320KB | Images: 5 embedded as base64
```

**Failure:**
```
❌ Failed to scrape: URL requires authentication
💡 Try: Open the URL in browser, then use bookmark scraping
```

## 🎭 Handling Different Content Types

| Content Type | Approach |
|--------------|----------|
| **WeChat Articles** | ✅ Works with Playwright JS rendering |
| **Regular Websites** | ✅ Standard scraping |
| **JavaScript-heavy** | ✅ Playwright waits for render |
| **Paywalled** | ⚠️ May get partial content |
| **PDF/Download** | ❌ Not supported |

---

**Think:** Parse $ARGUMENTS → Check for --embed-images → Build command → Execute → Report results
