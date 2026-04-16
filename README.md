<div align="center">
  <a href="https://screenshotx402.com/" title="screenshot-x402"><img src="https://screenshotx402.com/icons/favicon-96x96.png" alt="screenshot-x402" width="96" height="96"></a>
  <br />
  <p><a href="./README.md">English</a> | <a href="./README-ZH.md">中文文档</a></p>
</div>

# screenshot-x402-cli

**[screenshot-x402](https://screenshotx402.com/)** is the product: pay-per-request **screenshots (and optional vision) for AI agents**, with real browser rendering, **MCP over Streamable HTTP**, and **[x402](https://www.x402.org/)** settlement in USDC—no caller API keys. The marketing site, discovery JSON, docs, and pricing all live there.

This repo is the **official Node.js CLI** for that service: it connects to the same MCP endpoint agents use, calls `health` (free) or paid tools (`take_screenshot`, `analyze_screenshot`) with `withX402Client` and **viem**, and writes **PNG/JPEG**, **JSON**, and an **HTML** report under your chosen output directory.

**Default MCP URL:** `https://screenshotx402.com/mcp`  
Override with `--mcp-url` or `MCP_URL` (for example `http://127.0.0.1:8787/mcp` when developing the worker locally).

## Requirements

- **Node.js 20+**
- **Paid commands:** a funded **EVM wallet** with **USDC** on the same network the server expects (default: `base`). Set `X402_PRIVATE_KEY` (never commit this).

## Install

```bash
npm install -g screenshot-x402-cli
```

Or run without installing:

```bash
npx screenshot-x402-cli --help
```

## Commands

After a global install, two equivalent binaries are available: `screenshot-x402` and `screenshot-x402-cli`. Examples below use `screenshot-x402`.

| Command      | Wallet | Description                                                  |
| ------------ | ------ | ------------------------------------------------------------ |
| `health`     | No     | Calls the free `health` tool.                                |
| `screenshot` | Yes    | Calls `take_screenshot` (~$0.01).                            |
| `analyze`    | Yes    | Calls `analyze_screenshot` (~$0.03) plus server-side vision. |
| `list-tools` | No     | Prints MCP tool definitions as JSON.                         |

### Free: `health`

```bash
screenshot-x402 health
```

### Paid: screenshot or analyze

```bash
export X402_PRIVATE_KEY=0x...   # funded key — never commit
screenshot-x402 screenshot --page https://example.com
screenshot-x402 analyze --page https://example.com
```

## CLI options

**Global**

| Option            | Description                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `--mcp-url <url>` | MCP Streamable HTTP URL (default: `https://screenshotx402.com/mcp`)                                    |
| `--page <url>`    | Target URL (required for `screenshot` and `analyze`)                                                   |
| `--out <dir>`     | Output directory (default: `./output` in the **current working directory**)                            |
| `--json`          | Print one JSON object on stdout (`health`, `screenshot`, `analyze`, `list-tools`); logs stay on stderr |
| `-h`, `--help`    | Show usage                                                                                             |

**Common to `screenshot` and `analyze`**

| Flag                          | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `--width <px>`                | Viewport width (default: `1280`)                    |
| `--height <px>`               | Viewport height (default: `720`)                    |
| `--full-page`                 | Capture the full scrollable page                    |
| `--color-scheme <light\|dark>` | Color scheme                                        |
| `--device-scale-factor <1-3>` | Pixel ratio / sharpness (default: `1`)              |
| `--hide <selector>`           | Repeat for each CSS selector to hide before capture |

**`screenshot` only**

| Flag                | Description                                         |
| ------------------- | --------------------------------------------------- |
| `--format <png\|jpeg>`         | Output format                                       |
| `--delay <ms>`      | Extra wait after load (default: `0`)                |
| `--cache-ttl <sec>` | Cache TTL; `0` skips cache reads (default: `86400`) |

**`analyze` only**

| Flag              | Description                                 |
| ----------------- | ------------------------------------------- |
| `--prompt <text>` | Vision instruction (default: short summary) |

### Examples

```bash
# Dark mode + HiDPI + hide overlays
screenshot-x402 screenshot --page https://example.com \
  --color-scheme dark \
  --device-scale-factor 2 \
  --hide "#cookie-consent" \
  --hide ".sticky-promo"

# Full-page JPEG, custom viewport, delay
screenshot-x402 screenshot --page https://example.com \
  --full-page --format jpeg --width 1920 --height 1080 --delay 1500

# Vision with the same render options as screenshot
screenshot-x402 analyze --page https://example.com \
  --color-scheme dark \
  --device-scale-factor 2 \
  --prompt "List all visible headings."
```

## Environment variables

| Variable           | Description                                    |
| ------------------ | ---------------------------------------------- |
| `X402_PRIVATE_KEY` | `0x…` — required for paid tools                |
| `X402_NETWORK`     | EVM network id (default: `base`)               |
| `MCP_URL`          | Default MCP endpoint if `--mcp-url` is omitted |
| `OUT_DIR`          | Default output directory if `--out` is omitted |

## Output

Each run creates timestamped files under your output directory (default `./output`; add `output/` to `.gitignore` in your project if needed):

| File              | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `*.html`          | Open in a browser — embeds images as `data:` URLs and text blocks |
| `*.png` / `*.jpg` | Decoded screenshot bytes when the tool returns an image           |
| `*.json`          | Raw tool result for debugging                                     |

With `--json`, the CLI also prints a **single line** of JSON on stdout with `command`, `pageUrl`, `isError`, `text` (tool text parts), absolute `paths` to the files above, and `_meta`. Image base64 is not repeated on stdout (use the saved `*.json` or image files).

## Develop from this repo

```bash
cd screenshot-x402-cli
npm install
npm run build
node dist/index.js --help
# or during development:
npm start -- health
```

## Publish to npm

From `screenshot-x402-cli/`:

```bash
npm run build
npm publish --access public
```

`prepublishOnly` runs `npm run build` automatically. Ensure you are logged in (`npm login`) and the package name `screenshot-x402-cli` is available on your scope/account.

## Safety

- Treat `X402_PRIVATE_KEY` like a production secret; use **limited fund** wallet for experiments.
- This CLI **auto-approves** x402 payments in code for automation — **not** suitable for unattended use with high-value or mainnet wallets without your own safeguards.

## License

MIT — see [LICENSE](./LICENSE).
