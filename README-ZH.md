<div align="center">
  <a href="https://screenshotx402.com/" title="screenshot-x402"><img src="https://screenshotx402.com/icons/favicon-96x96.png" alt="screenshot-x402" width="96" height="96"></a>
  <br />
  <p><a href="./README.md">English</a> | <a href="./README-ZH.md">中文文档</a></p>
</div>

# screenshot-x402-cli

**[screenshot-x402](https://screenshotx402.com/)** 是产品本身：为 **AI 代理**提供按次付费的**网页截图（及可选的视觉分析）**服务。采用真实的浏览器渲染，**基于流式 HTTP 的 MCP (模型上下文协议)**，并通过 **[x402](https://www.x402.org/)** 使用 USDC 进行结算 —— 无需调用者提供 API 密钥。官方营销网站、Discovery JSON、文档以及定价信息都可以在该网站上找到。

本仓库是该服务的**官方 Node.js 命令行工具 (CLI)**：它连接到代理使用的相同 MCP 端点，通过 `withX402Client` 和 **viem** 调用 `health`（免费）或付费工具（`take_screenshot`，`analyze_screenshot`），并将 **PNG/JPEG**、**JSON** 以及 **HTML** 报告写入您指定的输出目录。

**默认 MCP URL:** `https://screenshotx402.com/mcp`  
可通过 `--mcp-url` 或 `MCP_URL` 进行覆盖（例如在本地开发 worker 时使用 `http://127.0.0.1:8787/mcp`）。

## 环境要求

- **Node.js 20+**
- **付费命令：** 一个在服务器期望的网络（默认为 `base` 网络）上拥有 USDC 余额的 **EVM 钱包**。设置环境变量 `X402_PRIVATE_KEY`（切勿提交此私钥）。

## 安装

```bash
npm install -g screenshot-x402-cli
```

或者不安装直接运行：

```bash
npx screenshot-x402-cli --help
```

## 命令

全局安装后，可以使用两个等效的二进制命令：`screenshot-x402` 和 `screenshot-x402-cli`。以下示例均使用 `screenshot-x402`。

| 命令         | 需要钱包 | 描述                                                          |
| ------------ | -------- | ------------------------------------------------------------- |
| `health`     | 否       | 调用免费的 `health` 工具。                                    |
| `screenshot` | 是       | 调用 `take_screenshot`（约 $0.01）。                          |
| `analyze`    | 是       | 调用 `analyze_screenshot`（约 $0.03），包含服务端的视觉分析。 |
| `list-tools` | 否       | 以 JSON 格式打印 MCP 工具定义。                               |

### 免费：`health`

```bash
screenshot-x402 health
```

### 付费：screenshot 或 analyze

```bash
export X402_PRIVATE_KEY=0x...   # 有资金的密钥 —— 切勿提交
screenshot-x402 screenshot --page https://example.com
screenshot-x402 analyze --page https://example.com
```

## CLI 选项

**全局选项**

| 选项              | 描述                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `--mcp-url <url>` | MCP 流式 HTTP URL（默认：`https://screenshotx402.com/mcp`）                                          |
| `--page <url>`    | 目标 URL（`screenshot` 和 `analyze` 命令必填）                                                       |
| `--out <dir>`     | 输出目录（默认：**当前工作目录**下的 `./output`）                                                    |
| `--json`          | 在 stdout 打印单行 JSON 对象（`health`、`screenshot`、`analyze`、`list-tools`）；日志仍输出在 stderr |
| `-h`, `--help`    | 显示使用帮助                                                                                         |

**`screenshot` 和 `analyze` 通用选项**

| 标志                           | 描述                                        |
| ------------------------------ | ------------------------------------------- |
| `--width <px>`                 | 视口宽度（默认：`1280`）                    |
| `--height <px>`                | 视口高度（默认：`720`）                     |
| `--full-page`                  | 捕获整个可滚动页面                          |
| `--color-scheme <light\|dark>` | 颜色主题                                    |
| `--device-scale-factor <1-3>`  | 像素比例 / 清晰度（默认：`1`）              |
| `--hide <selector>`            | 截图前隐藏的 CSS 选择器，可重复使用隐藏多个 |

**仅限 `screenshot` 命令**

| 标志                   | 描述                                            |
| ---------------------- | ----------------------------------------------- |
| `--format <png\|jpeg>` | 图片格式                                        |
| `--delay <ms>`         | 页面加载后的额外等待时间（默认：`0`）           |
| `--cache-ttl <sec>`    | 缓存 TTL；`0` 表示跳过读取缓存（默认：`86400`） |

**仅限 `analyze` 命令**

| 标志              | 描述                               |
| ----------------- | ---------------------------------- |
| `--prompt <text>` | 视觉分析指令（默认：生成简短摘要） |

### 示例

```bash
# 暗黑模式 + 高分屏 + 隐藏覆盖层
screenshot-x402 screenshot --page https://example.com \
  --color-scheme dark \
  --device-scale-factor 2 \
  --hide "#cookie-consent" \
  --hide ".sticky-promo"

# 捕获全页 JPEG，自定义视口，延迟截图
screenshot-x402 screenshot --page https://example.com \
  --full-page --format jpeg --width 1920 --height 1080 --delay 1500

# 视觉分析，使用与截图相同的渲染选项
screenshot-x402 analyze --page https://example.com \
  --color-scheme dark \
  --device-scale-factor 2 \
  --prompt "List all visible headings."
```

## 环境变量

| 变量               | 描述                                       |
| ------------------ | ------------------------------------------ |
| `X402_PRIVATE_KEY` | `0x…` —— 调用付费工具必填                  |
| `X402_NETWORK`     | EVM 网络 ID（默认：`base`）                |
| `MCP_URL`          | 默认 MCP 端点（当省略 `--mcp-url` 时使用） |
| `OUT_DIR`          | 默认输出目录（当省略 `--out` 时使用）      |

## 输出

每次运行都会在您的输出目录下创建带有时间戳的文件（默认为 `./output`；如果需要，请将 `output/` 添加到项目的 `.gitignore` 中）：

| 文件              | 用途                                                        |
| ----------------- | ----------------------------------------------------------- |
| `*.html`          | 在浏览器中打开 —— 将图像作为 `data:` URL 嵌入，并包含文本块 |
| `*.png` / `*.jpg` | 当工具返回图像时，解码后的截图字节文件                      |
| `*.json`          | 原始工具结果，用于调试                                      |

使用 `--json` 参数时，CLI 还会向 stdout 打印**单行** JSON，包含 `command`、`pageUrl`、`isError`、`text`（工具文本部分）、上述文件的绝对路径 `paths`，以及 `_meta`。图片 base64 数据不会在 stdout 中重复打印（请使用保存的 `*.json` 或图像文件）。

## 基于本仓库进行开发

```bash
cd screenshot-x402-cli
npm install
npm run build
node dist/index.js --help
# 或在开发过程中运行：
npm start -- health
```

## 发布到 npm

在 `screenshot-x402-cli/` 目录下：

```bash
npm run build
npm publish --access public
```

`prepublishOnly` 脚本会自动运行 `npm run build`。请确保您已登录（`npm login`），并且包名 `screenshot-x402-cli` 在您的作用域/账户下可用。

## 安全提示

- 请将 `X402_PRIVATE_KEY` 视为生产环境机密对待；建议使用**资金有限**的钱包进行实验。
- 此 CLI 为实现自动化会在代码中**自动批准** x402 支付 —— 如果没有自己的安全防护措施，**不**适合无人值守的高价值或主网钱包使用。

## 许可证

MIT —— 详情请参见 [LICENSE](./LICENSE)。