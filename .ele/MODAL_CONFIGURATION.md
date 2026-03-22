# Web Scraper Tool - Modal Configuration

## ✅ 实现完成！

Web Scraper Tool 配置现在使用**弹出式窗口**，让主设置页面保持简洁。

---

## 使用方法

### 1. 打开配置窗口

**路径:** Settings → Ele → Web Scraper Tool

你会看到一个简洁的配置项：

```
┌─────────────────────────────────────────┐
│ Web Scraper Tool                        │  ← 标题
├─────────────────────────────────────────┤
│ Web Scraper Configuration               │
│ Configure Node.js path, scraper         │
│ script location, output directory...    │
│                                          │
│  [Edit Configuration] ⚙️                │  ← 点击这个按钮
└─────────────────────────────────────────┘
```

### 2. 点击 "Edit Configuration" 按钮

弹出配置窗口，包含所有设置：

```
╔═══════════════════════════════════════════╗
║ Web Scraper Tool Configuration           ║
╠═══════════════════════════════════════════╣
║                                           ║
║ Node.js Binary Path                       ║
║ Path to node executable                   ║
║ [                              ] 🔍       ║
║                                           ║
║ Scraper Script Path                       ║
║ Path to scraper.js (supports $HOME)       ║
║ [$HOME/.openclaw/workspace/...]           ║
║                                           ║
║ Output Directory                          ║
║ Default output directory for clippings    ║
║ [Clippings                              ] ║
║                                           ║
║ Request Delay (ms)                        ║
║ Delay between scraping requests           ║
║ [2000    ]                                ║
║                                           ║
║ Page Load Timeout (ms)                    ║
║ Maximum time to wait for page to load     ║
║ [60000   ]                                ║
║                                           ║
║                    [Cancel]  [Save]       ║
╚═══════════════════════════════════════════╝
```

### 3. 配置选项

**Node.js Binary Path:**
- 留空 = 自动检测
- 点击 🔍 = 自动查找 Node.js
- 或手动输入路径

**Scraper Script Path:**
- 默认: `$HOME/.openclaw/workspace/tools/web-scraper/scraper.js`
- 支持 `$HOME` 和 `~` 路径展开

**Output Directory:**
- 默认: `Clippings` (相对于 vault)
- 可以使用绝对路径

**Request Delay:**
- 默认: 2000 ms (2秒)
- 避免被网站限流

**Page Load Timeout:**
- 默认: 60000 ms (60秒)
- 页面加载超时时间

### 4. 保存配置

点击 **Save** 按钮保存，或 **Cancel** 取消修改。

---

## 优势

### ✅ 简洁的主设置页面

**以前:** 5个设置项占据大量空间
```
Web Scraper Tool
  Node.js Binary Path    [........]
  Scraper Script Path    [........]
  Output Directory       [........]
  Request Delay (ms)     [........]
  Page Load Timeout (ms) [........]
```

**现在:** 只有1个按钮
```
Web Scraper Tool
  Web Scraper Configuration  [Edit Configuration]
```

### ✅ 扩展性好

未来添加更多 command 的配置时，每个只占一行：

```
Web Scraper Tool          [Edit Configuration]
PDF Converter             [Edit Configuration]
Image Optimizer           [Edit Configuration]
Code Formatter            [Edit Configuration]
...
```

主设置页面始终保持简洁！

### ✅ 更好的用户体验

- 集中配置：所有相关设置在一个窗口
- 视觉清晰：弹窗更专注，无干扰
- 易于导航：主设置页面不会过长

---

## 技术实现

### 文件结构

```
src/features/settings/
├── OpenCodianSettings.ts          # 主设置页面
└── ui/
    └── WebScraperConfigModal.ts   # Web Scraper 配置弹窗
```

### 主设置页面 (OpenCodianSettings.ts)

```typescript
new Setting(containerEl).setName('Web Scraper Tool').setHeading();

new Setting(containerEl)
  .setName('Web Scraper Configuration')
  .setDesc('Configure Node.js path, scraper script location...')
  .addButton((button) => {
    button
      .setButtonText('Edit Configuration')
      .setIcon('settings')
      .onClick(() => {
        const modal = new WebScraperConfigModal(this.app, this.plugin);
        modal.open();
      });
  });
```

### 配置弹窗 (WebScraperConfigModal.ts)

```typescript
export class WebScraperConfigModal extends Modal {
  private plugin: ElePlugin;
  private nodeBin: string;
  private toolPath: string;
  // ... 其他配置

  onOpen() {
    // 渲染所有配置项
    // 保存按钮点击时更新 plugin.settings
  }
}
```

---

## 下一步：添加更多 Tool 配置

### 模式

每个新的 tool 只需要：

1. **在 settings.ts 添加类型:**
```typescript
interface EleSettings {
  // ... 现有字段

  // PDF Converter Tool Configuration
  pdfConverterToolPath: string;
  pdfConverterQuality: number;
  // ...
}
```

2. **创建 Modal:**
```typescript
// src/features/settings/ui/PdfConverterConfigModal.ts
export class PdfConverterConfigModal extends Modal {
  // 类似 WebScraperConfigModal 的结构
}
```

3. **在主设置页面添加一行:**
```typescript
new Setting(containerEl).setName('PDF Converter').setHeading();

new Setting(containerEl)
  .setName('PDF Converter Configuration')
  .setDesc('Configure PDF conversion settings')
  .addButton((button) => {
    button
      .setButtonText('Edit Configuration')
      .setIcon('settings')
      .onClick(() => {
        const modal = new PdfConverterConfigModal(this.app, this.plugin);
        modal.open();
      });
  });
```

**就这么简单！** 主设置页面永远不会变得拥挤。

---

## 测试清单

### ✅ 功能测试

1. **打开弹窗**
   - Settings → Ele → Web Scraper Tool
   - 点击 "Edit Configuration"
   - ✅ 弹窗打开

2. **自动检测 Node.js**
   - 点击 🔍 按钮
   - ✅ 自动检测到 Node.js 路径
   - ✅ 显示通知: "Node.js found: /path/to/node"

3. **修改配置**
   - 修改任意字段
   - 点击 Save
   - ✅ 保存成功
   - ✅ 关闭弹窗

4. **取消修改**
   - 修改任意字段
   - 点击 Cancel
   - ✅ 修改未保存
   - ✅ 关闭弹窗

5. **配置持久化**
   - 修改并保存
   - 重新打开弹窗
   - ✅ 显示之前保存的值

---

## 完成！

**现在你有了：**
- ✅ 简洁的主设置页面（只有一个按钮）
- ✅ 专业的配置弹窗
- ✅ 自动检测 Node.js 功能
- ✅ 完整的配置选项
- ✅ 易于扩展的架构

**重启 Obsidian 后即可使用！** 🎉
