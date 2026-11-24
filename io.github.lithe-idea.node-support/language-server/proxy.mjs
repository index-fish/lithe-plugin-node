// stdio LSP proxy for the TypeScript/JavaScript language server.
//
// It forwards every message untouched except textDocument/completion responses,
// which are narrowed by the identifier being typed. Lithe renders the raw LSP
// completion list without client-side filtering, so without this step typing
// `cons` surfaces _APIURL/_HOST/... instead of `console`/`const`.
//
// Kept dependency-free so it runs on the same managed Node toolchain as the
// language server itself.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { applyContentChanges, filterCompletionResult, wordPrefixBefore } from "./completion-filter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, "node_modules", "typescript-language-server", "lib", "cli.mjs");
if (!existsSync(serverEntry)) {
  process.stderr.write(`[lithe-completion-proxy] missing language server entry: ${serverEntry}\n`);
  process.exit(1);
}

const VERBOSE = process.env.LITHE_COMPLETION_PROXY_VERBOSE === "1";
const debug = (msg) => {
  if (VERBOSE) process.stderr.write(`[lithe-completion-proxy] ${msg}\n`);
};

// Preserve the node runtime flags (e.g. --max-old-space-size=...) and the
// arguments Lithe appended to the entry (e.g. --stdio) for the real server.
const forwardedNodeArgs = (process.execArgv ?? []).slice();
const forwardedServerArgs = (process.argv ?? []).slice(2);
if (!forwardedServerArgs.includes("--stdio")) forwardedServerArgs.push("--stdio");
const child = spawn(process.execPath, [...forwardedNodeArgs, serverEntry, ...forwardedServerArgs], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

// uri -> latest text we have observed. didOpen in Lithe carries textLength but
// no text; the editor sends a full-range didChange before the first completion,
// so we fall back to reading the file from disk until that arrives.
const documents = new Map();
// LSP request id -> {prefix, position} captured when the request was sent.
const completionContext = new Map();

function readUri(uri) {
  if (typeof uri !== "string" || !uri.startsWith("file://")) return "";
  try {
    return readFileSync(new URL(uri), "utf8");
  } catch {
    return "";
  }
}

function documentUri(params) {
  return params?.textDocument?.uri ?? params?.uri;
}

function handleClientMessage(message) {
  const method = message.method;
  const params = message.params ?? {};
  if (method === "textDocument/didOpen") {
    const uri = documentUri(params);
    if (uri) {
      const text = params.textDocument?.text ?? params.text ?? readUri(uri);
      documents.set(uri, typeof text === "string" ? text : "");
    }
  } else if (method === "textDocument/didChange") {
    const uri = documentUri(params);
    if (uri) {
      const previous = documents.get(uri) ?? readUri(uri);
      documents.set(uri, applyContentChanges(previous, params.contentChanges));
    }
  } else if (method === "textDocument/didClose") {
    documents.delete(documentUri(params));
  } else if (method === "textDocument/completion" && message.id !== undefined) {
    const uri = documentUri(params);
    const position = params.position ?? {};
    const prefix = wordPrefixBefore(documents.get(uri) ?? readUri(uri), position.line, position.character);
    completionContext.set(message.id, { prefix, position });
    debug(`completion id=${message.id} prefix=${JSON.stringify(prefix)}`);
  }
}

function handleServerMessage(message) {
  if (message.id === undefined || message.error || !completionContext.has(message.id)) return;
  const { prefix, position } = completionContext.get(message.id);
  completionContext.delete(message.id);
  if (!prefix) return;
  const before = countItems(message.result);
  message.result = filterCompletionResult(message.result, prefix, position);
  debug(`completion id=${message.id} items ${before} -> ${countItems(message.result)}`);
}

function countItems(result) {
  if (Array.isArray(result)) return result.length;
  if (Array.isArray(result?.items)) return result.items.length;
  return 0;
}

function pump(readable, onMessage, destination) {
  let buffer = Buffer.alloc(0);
  readable.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      if (buffer.length < headerEnd + 4 + length) break;
      const body = buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString("utf8");
      buffer = buffer.subarray(headerEnd + 4 + length);
      let message;
      try {
        message = JSON.parse(body);
      } catch {
        continue;
      }
      onMessage(message);
      const payload = Buffer.from(JSON.stringify(message), "utf8");
      destination.write(Buffer.concat([Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, "ascii"), payload]));
    }
  });
  readable.on("end", () => destination.end());
}

pump(process.stdin, handleClientMessage, child.stdin);
pump(child.stdout, handleServerMessage, process.stdout);

process.stdin.on("end", () => child.stdin.end());
child.on("exit", (code, signal) => {
  debug(`language server exited code=${code} signal=${signal}`);
  process.exit(code ?? (signal ? 1 : 0));
});
