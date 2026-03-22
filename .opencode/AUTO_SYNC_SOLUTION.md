# 修复方案：自动同步设置到环境变量

## ✅ 问题已解决！

### 问题原因

**错误:** `/bin/sh: node: command not found`

**原因:** 虽然在 UI 中配置了 Node.js 路径，但这些配置没有被命令使用。Slash command 需要通过环境变量访问这些配置。

### 解决方案

**自动同步机制：** 当你在 UI 中保存 Web Scraper 配置时，设置会自动同步到环境变量。

---

## 工作流程

### 1. **配置 Web Scraper Tool**

Settings → Ele → Web Scraper Tool → [Edit Configuration]

1. 点击 🔍 自动检测 Node.js
2. 配置其他选项
3. 点击 **Save**

### 2. **自动同步**

保存时，插件会自动：

```typescript
// 自动添加到环境变量：
export NODE_BIN="/opt/homebrew/bin/node"
export WEB_SCRAPER_TOOL="$HOME/.openclaw/workspace/tools/web-scraper/scraper.js"
export WEB_SCRAPER_OUTPUT="Clippings"
export WEB_SCRAPER_DELAY="2000"
export WEB_SCRAPER_TIMEOUT="60000"
```

### 3. **命令使用这些变量**

`/scrape-web` 命令现在会使用这些环境变量：

```bash
"$NODE_BIN" "$WEB_SCRAPER_TOOL" \
  --url "https://example.com" \
  --output "$WEB_SCRAPER_OUTPUT"
```

---

## 现在如何测试

### Step 1: 重新配置（重要！）

即使你之前配置过，也需要**重新保存一次**以触发同步：

1. Settings → Ele → Web Scraper Tool
2. 点击 **[Edit Configuration]**
3. 点击 🔍 **自动检测 Node.js**
4. 点击 **Save**

这会触发自动同步到环境变量。

### Step 2: 重启 Obsidian

```bash
Cmd+Q  # 完全退出
# 重新启动
```

### Step 3: 验证环境变量

打开 Settings → Ele → Environment，应该看到自动添加的部分：

```bash
# Web Scraper Tool Configuration (auto-generated from settings)
export NODE_BIN="/opt/homebrew/bin/node"
export WEB_SCRAPER_TOOL="$HOME/.openclaw/workspace/tools/web-scraper/scraper.js"
export WEB_SCRAPER_OUTPUT="Clippings"
export WEB_SCRAPER_DELAY="2000"
export WEB_SCRAPER_TIMEOUT="60000"
```

### Step 4: 测试命令

```
/scrape-web https://example.com --dry-run
```

**预期结果：**
```
🚀 Launching browser...
📄 Scraping: https://example.com
  [DRY RUN] Would save to: .../Clippings/06-Uncategorized/example.md
```

✅ 不再出现 "node: command not found" 错误！

---

## 技术实现

### WebScraperConfigModal.ts

```typescript
private async syncToEnvironmentVariables(): Promise<void> {
  // 解析现有环境变量
  const lines = envVars.split('\n');

  // 移除旧的 Web Scraper 变量
  const newLines = lines.filter(line =>
    !isWebScraperVariable(line)
  );

  // 添加新的配置
  newLines.push('# Web Scraper Tool Configuration');
  newLines.push(`export NODE_BIN="${this.nodeBin}"`);
  newLines.push(`export WEB_SCRAPER_TOOL="${this.toolPath}"`);
  // ... 其他变量

  // 更新并应用
  this.plugin.settings.environmentVariables = newLines.join('\n');
  await this.plugin.applyEnvironmentVariables(...);
}
```

### 保存时触发

```typescript
saveBtn.addEventListener('click', async () => {
  // 保存设置
  this.plugin.settings.webScraperNodeBin = this.nodeBin;
  // ...

  // 自动同步到环境变量
  await this.syncToEnvironmentVariables();

  await this.plugin.saveSettings();
  new Notice('Web Scraper Tool configuration saved');
});
```

---

## 优势

### ✅ 用户无感知

**用户只需要：**
1. 在 UI 配置
2. 点击 Save

**系统自动：**
- 同步到环境变量
- 应用配置
- 命令可以立即使用

### ✅ 配置一致性

- UI 配置 = 环境变量配置
- 单一数据源
- 不会出现不同步的问题

### ✅ 向后兼容

- 仍然可以手动编辑环境变量
- UI 配置会覆盖对应的变量
- 其他自定义环境变量不受影响

---

## 故障排除

### 问题 1: 仍然显示 "node: command not found"

**解决方案：**
1. 重新打开配置窗口
2. 点击 🔍 自动检测
3. 确认看到路径（如 `/opt/homebrew/bin/node`）
4. 点击 **Save**
5. 完全重启 Obsidian (`Cmd+Q`)

### 问题 2: 环境变量中没有看到 Web Scraper 配置

**检查：**
1. 确认你点击了 **Save** 按钮（不是 Cancel）
2. 查看 Settings → Ele → Environment
3. 应该看到 `# Web Scraper Tool Configuration` 部分

**如果没有：**
重新保存一次配置。

### 问题 3: Node.js 路径不正确

**手动指定：**
1. 终端运行: `which node`
2. 复制输出的路径（如 `/opt/homebrew/bin/node`）
3. 在配置窗口的 "Node.js Binary Path" 粘贴
4. 点击 **Save**

---

## 环境变量详解

### 自动生成的变量

| 变量 | 来源 | 用途 |
|------|------|------|
| `NODE_BIN` | UI 配置或自动检测 | Node.js 可执行文件路径 |
| `WEB_SCRAPER_TOOL` | UI 配置 | scraper.js 脚本路径 |
| `WEB_SCRAPER_OUTPUT` | UI 配置 | 默认输出目录 |
| `WEB_SCRAPER_DELAY` | UI 配置 | 请求延迟（毫秒） |
| `WEB_SCRAPER_TIMEOUT` | UI 配置 | 页面加载超时（毫秒） |

### 命令如何使用

```bash
# 命令示例
"$NODE_BIN" "$WEB_SCRAPER_TOOL" \
  --url "https://example.com" \
  --output "$WEB_SCRAPER_OUTPUT" \
  --delay "$WEB_SCRAPER_DELAY"
```

展开后：
```bash
"/opt/homebrew/bin/node" "$HOME/.openclaw/workspace/tools/web-scraper/scraper.js" \
  --url "https://example.com" \
  --output "Clippings" \
  --delay "2000"
```

---

## 完成！

**现在你应该能够成功使用 `/scrape-web` 命令了！** 🎉

**记住关键步骤：**
1. ✅ 在 UI 配置并保存（触发自动同步）
2. ✅ 重启 Obsidian
3. ✅ 测试命令

如果还有问题，请检查环境变量部分是否正确生成。
