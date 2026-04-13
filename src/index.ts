#!/usr/bin/env node
/**
 * MCP client CLI for screenshot-x402: health (free) and paid tools with x402 signing.
 *
 * Usage:
 *   screenshot-x402 health
 *   screenshot-x402 screenshot --page https://example.com
 *   screenshot-x402 screenshot --page https://example.com --color-scheme dark --device-scale-factor 2 --hide "#cookie"
 *   screenshot-x402 analyze --page https://example.com
 *
 * Env:
 *   MCP_URL              default https://screenshotx402.com/mcp
 *   X402_PRIVATE_KEY     required for paid tools (0x… test wallet with USDC on network)
 *   X402_NETWORK         default base
 */

import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function cliVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, "..", "package.json"), "utf-8");
    return (JSON.parse(raw) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = cliVersion();
const DEFAULT_OUT = join(process.cwd(), "output");
const DEFAULT_MCP = "https://localhost:8787/mcp";

/** Normalized tool output for this CLI (handles minor SDK / wrapper shape differences). */
type ToolRunResult = {
  content?: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  _meta?: unknown;
};

function usage(): void {
  console.log(`
  screenshot-x402-cli v${VERSION}

  screenshot-x402 health
      Call free health tool (no wallet).

  screenshot-x402 screenshot --page <https://...>
      Call take_screenshot ($0.01). Needs X402_PRIVATE_KEY.

  screenshot-x402 analyze --page <https://...>
      Call analyze_screenshot ($0.03). Needs X402_PRIVATE_KEY + server OPENROUTER_API_KEY or OPENAI_API_KEY.

  screenshot-x402 list-tools
      List MCP tools.

  (Install globally, or run: npx screenshot-x402-cli <command> …)

Options:
  --mcp-url <url>     MCP Streamable HTTP URL (default: ${DEFAULT_MCP})
  --page <url>        Target page URL (screenshot / analyze)
  --out <dir>         Output directory (default: ./output in current working directory)

  screenshot / analyze (render options, same as MCP tools):
  --width <px>        Viewport width (default: 1280)
  --height <px>       Viewport height (default: 720)
  --full-page         Capture full scrollable page
  --color-scheme <light|dark|no-preference>  prefers-color-scheme (default: no-preference)
  --device-scale-factor <1-3>  Pixel ratio / sharpness (default: 1)
  --hide <selector>   Repeat to hide CSS selectors before capture

  screenshot only:
  --format <png|jpeg> Output format (default: png)
  --delay <ms>        Extra wait after load (default: 0)
  --cache-ttl <sec>   R2 cache TTL; 0 skips cache reads (default: 86400)

  analyze only:
  --prompt <text>     Vision prompt (default: short summary)

Env:
  X402_PRIVATE_KEY    0x… private key for x402 (testnet USDC)
  X402_NETWORK        default base-sepolia
  MCP_URL             Override default MCP URL
  OUT_DIR             Override default output directory (same as --out)
`);
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

/** Every occurrence of `--flag value` (for repeatable flags like --hide). */
function argValuesAll(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) {
      out.push(args[i + 1]);
      i++;
    }
  }
  return out;
}

function parseOptionalInt(
  args: string[],
  flag: string,
  fallback: number,
): number {
  const v = argValue(args, flag);
  if (v === undefined) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) {
    console.error(`Invalid ${flag}: expected integer`);
    process.exit(1);
  }
  return n;
}

function parseOptionalFloat(
  args: string[],
  flag: string,
  fallback: number,
): number {
  const v = argValue(args, flag);
  if (v === undefined) return fallback;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) {
    console.error(`Invalid ${flag}: expected number`);
    process.exit(1);
  }
  return n;
}

type ColorScheme = "light" | "dark" | "no-preference";

function parseColorScheme(args: string[]): ColorScheme {
  const v = argValue(args, "--color-scheme");
  if (v === undefined) return "no-preference";
  if (v === "light" || v === "dark" || v === "no-preference") return v;
  console.error(
    'Invalid --color-scheme: use "light", "dark", or "no-preference"',
  );
  process.exit(1);
}

function parseDeviceScaleFactor(args: string[]): number {
  const n = parseOptionalFloat(args, "--device-scale-factor", 1);
  if (n < 1 || n > 3) {
    console.error("--device-scale-factor must be between 1 and 3");
    process.exit(1);
  }
  return n;
}

function parseFormat(args: string[]): "png" | "jpeg" {
  const v = argValue(args, "--format");
  if (v === undefined) return "png";
  if (v === "png" || v === "jpeg") return v;
  console.error('Invalid --format: use "png" or "jpeg"');
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || hasFlag(args, "--help") || hasFlag(args, "-h")) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const command = args[0];
  const mcpUrl =
    argValue(args, "--mcp-url") ?? process.env.MCP_URL ?? DEFAULT_MCP;
  const outDir = argValue(args, "--out") ?? process.env.OUT_DIR ?? DEFAULT_OUT;
  const pageUrl = argValue(args, "--page");

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  const client = new Client(
    { name: "screenshot-x402-cli", version: VERSION },
    { capabilities: {} },
  );

  const pk = process.env.X402_PRIVATE_KEY as `0x${string}` | undefined;
  const network = process.env.X402_NETWORK ?? "base-sepolia";
  const usePayment = Boolean(pk);

  const mcp = usePayment
    ? withX402Client(client, {
        account: privateKeyToAccount(pk!),
        network,
        maxPaymentValue: BigInt(1_000_000),
        confirmationCallback: async () => {
          console.error("[x402] approving payment (CLI)");
          return true;
        },
      })
    : client;

  console.error(`Connecting to ${mcpUrl} …`);
  await mcp.connect(transport);
  console.error("Connected.");

  if (command === "list-tools") {
    const { tools } = await mcp.listTools();
    console.log(JSON.stringify(tools, null, 2));
    await mcp.close();
    return;
  }

  if (command === "health") {
    const result = await callToolMaybePaid(mcp, usePayment, "health", {});
    await writeOutputs(outDir, "health", pageUrl ?? "", result, false);
    printResult(result);
    await mcp.close();
    return;
  }

  if (command === "screenshot") {
    if (!pageUrl) {
      console.error("Missing --page <url>");
      process.exit(1);
    }
    if (!usePayment) {
      console.error("screenshot requires X402_PRIVATE_KEY for paid tool.");
      process.exit(1);
    }
    const width = parseOptionalInt(args, "--width", 1280);
    const height = parseOptionalInt(args, "--height", 720);
    const hideSelectors = argValuesAll(args, "--hide");
    const result = await callToolMaybePaid(mcp, usePayment, "take_screenshot", {
      url: pageUrl,
      width,
      height,
      fullPage: hasFlag(args, "--full-page"),
      delay: parseOptionalInt(args, "--delay", 0),
      cacheTtl: parseOptionalInt(args, "--cache-ttl", 86_400),
      format: parseFormat(args),
      colorScheme: parseColorScheme(args),
      deviceScaleFactor: parseDeviceScaleFactor(args),
      hideSelectors,
    });
    await writeOutputs(outDir, "screenshot", pageUrl, result, true);
    printResult(result);
    await mcp.close();
    return;
  }

  if (command === "analyze") {
    if (!pageUrl) {
      console.error("Missing --page <url>");
      process.exit(1);
    }
    if (!usePayment) {
      console.error("analyze requires X402_PRIVATE_KEY for paid tool.");
      process.exit(1);
    }
    const width = parseOptionalInt(args, "--width", 1280);
    const height = parseOptionalInt(args, "--height", 720);
    const hideSelectors = argValuesAll(args, "--hide");
    const prompt =
      argValue(args, "--prompt") ??
      "Summarize the visible content in 2 sentences.";
    const result = await callToolMaybePaid(
      mcp,
      usePayment,
      "analyze_screenshot",
      {
        url: pageUrl,
        prompt,
        width,
        height,
        fullPage: hasFlag(args, "--full-page"),
        colorScheme: parseColorScheme(args),
        deviceScaleFactor: parseDeviceScaleFactor(args),
        hideSelectors,
      },
    );
    await writeOutputs(outDir, "analyze", pageUrl, result, true);
    printResult(result);
    await mcp.close();
    return;
  }

  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(1);
}

async function callToolMaybePaid(
  mcp: Client | ReturnType<typeof withX402Client>,
  usePayment: boolean,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolRunResult> {
  const params = { name, arguments: args };
  if (usePayment) {
    const wrapped = mcp as ReturnType<typeof withX402Client>;
    return (await wrapped.callTool(null, params)) as ToolRunResult;
  }
  return (await (mcp as Client).callTool(params)) as ToolRunResult;
}

function printResult(result: ToolRunResult): void {
  if (result.isError) {
    console.error("Tool returned isError=true");
  }
  for (const block of result.content ?? []) {
    if (block.type === "text" && "text" in block && block.text) {
      console.log(block.text);
    }
    if (block.type === "image" && "data" in block && block.data) {
      console.log(
        `[image ${block.mimeType ?? "?"}] ${block.data.length} base64 chars`,
      );
    }
  }
}

async function writeOutputs(
  outDir: string,
  prefix: string,
  pageUrl: string,
  result: ToolRunResult,
  writeImages: boolean,
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = join(outDir, `${prefix}-${ts}`);

  await writeFile(
    `${base}.json`,
    JSON.stringify(
      {
        pageUrl,
        isError: result.isError,
        _meta: result._meta,
        content: result.content,
      },
      null,
      2,
    ),
    "utf-8",
  );

  const imgs: { mime: string; data: string }[] = [];
  for (const block of result.content ?? []) {
    if (
      block.type === "image" &&
      "data" in block &&
      block.data &&
      writeImages
    ) {
      imgs.push({ mime: block.mimeType ?? "image/png", data: block.data });
    }
  }

  let i = 0;
  for (const img of imgs) {
    const ext =
      img.mime.includes("jpeg") || img.mime.includes("jpg") ? "jpg" : "png";
    const buf = Buffer.from(img.data, "base64");
    const path = `${base}-${i}.${ext}`;
    await writeFile(path, buf);
    console.error(`Wrote image: ${path}`);
    i++;
  }

  const htmlParts: string[] = [
    "<!DOCTYPE html><html><head><meta charset=utf-8><title>screenshot-x402-cli</title>",
    "<style>body{font-family:system-ui;margin:2rem} img{max-width:100%;border:1px solid #ccc}</style>",
    "</head><body>",
    `<h1>screenshot-x402-cli / ${prefix}</h1>`,
    `<p><strong>Page:</strong> ${escapeHtml(pageUrl || "(n/a)")}</p>`,
  ];

  for (const block of result.content ?? []) {
    if (block.type === "text" && "text" in block && block.text) {
      htmlParts.push(`<pre>${escapeHtml(block.text)}</pre>`);
    }
    if (block.type === "image" && "data" in block && block.data) {
      const mime = block.mimeType ?? "image/png";
      htmlParts.push(
        `<p><img alt="screenshot" src="data:${mime};base64,${block.data}" /></p>`,
      );
    }
  }

  htmlParts.push("</body></html>");
  const htmlPath = `${base}.html`;
  await writeFile(htmlPath, htmlParts.join("\n"), "utf-8");
  console.error(`Wrote report: ${htmlPath}`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
