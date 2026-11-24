#!/usr/bin/env node
// Minimal, zero-dependency SQL language server over LAP stdio.
// Implements the features Lithe actually consumes: completion (with client-side
// prefix filtering and textEdit), hover, formatting, document symbols and
// publishDiagnostics. No database connection, no project code execution.

import { buildCompletions, diagnoseSql, formatSql, hoverAt, offsetAt, positionAt, symbolsFor } from "./sql-analysis.mjs";

const DEBUG = process.env.LITHE_SQL_DEBUG === "1";
const debug = (...args) => { if (DEBUG) process.stderr.write(`[sql-lsp] ${args.join(" ")}\n`); };

const documents = new Map();
const awaitingFullSync = new Set();

function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function respond(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, error) {
  send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(error?.message ?? error) } });
}

function applyChange(text, change) {
  if (!change || typeof change.text !== "string") return text;
  if (!change.range) return change.text; // full sync
  const { start, end } = change.range;
  const from = offsetAt(text, start.line, start.character);
  const to = offsetAt(text, end.line, end.character);
  return text.slice(0, from) + change.text + text.slice(to);
}

function handleNotification(method, params) {
  if (method === "initialized") return;
  if (method === "exit") { process.exit(0); return; }
  if (method === "$/cancelRequest") return;
  if (method === "textDocument/didOpen" || method === "textDocument/didChange" || method === "textDocument/didClose") {
    const uri = params?.textDocument?.uri;
    if (!uri) return;
    if (method === "textDocument/didClose") {
      documents.delete(uri);
      awaitingFullSync.delete(uri);
      send({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } });
      return;
    }
    if (method === "textDocument/didOpen") {
      const value = params.textDocument.text;
      if (typeof value === "string") documents.set(uri, value);
      else { documents.set(uri, ""); awaitingFullSync.add(uri); }
    } else {
      let text = documents.get(uri) ?? "";
      const changes = params.contentChanges ?? [];
      if (awaitingFullSync.has(uri) && changes.length && changes[0].range && changes[0].text) {
        // Lithe may open a document without text and then send one full-range change.
        text = changes[0].text;
        awaitingFullSync.delete(uri);
      } else {
        for (const change of changes) text = applyChange(text, change);
      }
      documents.set(uri, text);
    }
    const text = documents.get(uri) ?? "";
    send({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics: diagnoseSql(text) },
    });
  }
}

function handleRequest(id, method, params) {
  switch (method) {
    case "initialize":
      respond(id, {
        capabilities: {
          completionProvider: { resolveProvider: false, triggerCharacters: ["."] },
          hoverProvider: true,
          documentFormattingProvider: true,
          documentSymbolProvider: true,
          textDocumentSync: { openClose: true, change: 2 },
          workspace: { workspaceFolders: { supported: false } },
        },
        serverInfo: { name: "lithe-sql", version: "0.1.0" },
      });
      return;
    case "shutdown":
      respond(id, null);
      return;
    case "textDocument/completion": {
      const uri = params?.textDocument?.uri;
      const text = documents.get(uri) ?? "";
      const { line, character } = params.position ?? {};
      respond(id, buildCompletions(text, line ?? 0, character ?? 0));
      return;
    }
    case "textDocument/hover": {
      const uri = params?.textDocument?.uri;
      const text = documents.get(uri) ?? "";
      const { line, character } = params.position ?? {};
      respond(id, hoverAt(text, line ?? 0, character ?? 0));
      return;
    }
    case "textDocument/formatting": {
      const uri = params?.textDocument?.uri;
      const text = documents.get(uri) ?? "";
      const newText = formatSql(text);
      respond(id, [{
        range: { start: { line: 0, character: 0 }, end: positionAt(text, text.length) },
        newText,
      }]);
      return;
    }
    case "textDocument/documentSymbol": {
      const uri = params?.textDocument?.uri;
      respond(id, symbolsFor(documents.get(uri) ?? ""));
      return;
    }
    case "textDocument/diagnostic": {
      const uri = params?.textDocument?.uri;
      respond(id, { kind: "full", items: diagnoseSql(documents.get(uri) ?? "") });
      return;
    }
    default:
      respond(id, null);
  }
}

let buffer = Buffer.alloc(0);
function consume(chunk) {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = buffer.subarray(0, headerEnd).toString();
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) { buffer = buffer.subarray(headerEnd + 4); continue; }
    const length = Number(match[1]);
    if (buffer.length < headerEnd + 4 + length) break;
    const body = buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString();
    buffer = buffer.subarray(headerEnd + 4 + length);
    let message;
    try { message = JSON.parse(body); } catch (error) { debug("bad json", error.message); continue; }
    if (message.method && message.id === undefined) {
      handleNotification(message.method, message.params);
    } else if (message.id !== undefined) {
      try { handleRequest(message.id, message.method, message.params); }
      catch (error) { debug("request failed", message.method, error.stack ?? error.message); fail(message.id, error); }
    }
  }
}

process.stdin.on("data", consume);
process.stdin.on("end", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
debug("server ready");
