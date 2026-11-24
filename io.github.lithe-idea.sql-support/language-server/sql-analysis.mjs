// Pure SQL document analysis, completion building, formatting and diagnostics.
// No I/O, no LSP types: every function here is directly unit-testable.

import { VOCABULARY, hoverFor } from "./sql-data.mjs";

const IDENT = /[A-Za-z0-9_$#]/;

export function offsetAt(text, line, character) {
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) offset += lines[i].length + 1;
  return offset + character;
}

export function positionAt(text, offset) {
  const clamped = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, clamped);
  const lines = before.split("\n");
  return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

export function wordPrefixAt(text, line, character) {
  const offset = offsetAt(text, line, character);
  let start = offset;
  while (start > 0 && IDENT.test(text[start - 1])) start--;
  return { prefix: text.slice(start, offset), start, offset };
}

const TABLE_SOURCE = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([A-Za-z_][\w$]*)/gi;
const CTE = /\bWITH\s+([A-Za-z_][\w$]*)\s+AS\b/gi;
const ALIAS = /\bAS\s+([A-Za-z_][\w$]*)/gi;
const QUALIFIED = /([A-Za-z_][\w$]*)\s*\.\s*([A-Za-z_][\w$]*)/g;
const COLUMN_EQ = /\b([A-Za-z_][\w$]*)\s*(?:=|<|>|<=|>=|<>|!=|IS|LIKE|IN)\b/gi;
const SELECT_LIST = /\bSELECT\s+([\s\S]*?)\bFROM\b/gi;
const CREATE_TABLE = /\bCREATE\s+TABLE\s+([A-Za-z_][\w$]*)\s*\(([\s\S]*?)\)/gi;

export function analyzeDocument(text) {
  const tables = new Set();
  const columns = new Set();
  const ctes = new Set();
  const aliases = new Map();
  for (const re of [TABLE_SOURCE, CTE, ALIAS, QUALIFIED, COLUMN_EQ, SELECT_LIST, CREATE_TABLE]) {
    re.lastIndex = 0;
  }

  for (let m; (m = TABLE_SOURCE.exec(text)); ) tables.add(m[1]);
  for (let m; (m = CTE.exec(text)); ) { ctes.add(m[1]); tables.add(m[1]); }
  for (let m; (m = ALIAS.exec(text)); ) aliases.set(m[1].toUpperCase(), m[1]);

  for (let m; (m = QUALIFIED.exec(text)); ) {
    columns.add(m[2]);
    const alias = m[1].toUpperCase();
    if (!aliases.has(alias)) aliases.set(alias, m[1]);
  }
  for (let m; (m = COLUMN_EQ.exec(text)); ) columns.add(m[1]);
  for (let m; (m = SELECT_LIST.exec(text)); ) {
    for (const part of m[1].split(",")) {
      const match = /([A-Za-z_][\w$]*)\s*$/.exec(part.trim());
      if (match && !/^(DISTINCT|ALL|TOP)$/i.test(match[1])) columns.add(match[1]);
    }
  }
  for (let m; (m = CREATE_TABLE.exec(text)); ) {
    tables.add(m[1]);
    for (const part of m[2].split(",")) {
      const match = /^\s*["`[]?([A-Za-z_][\w$]*)/.exec(part);
      if (match && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|KEY|INDEX)$/i.test(match[1])) {
        columns.add(match[1]);
      }
    }
  }
  return { tables, columns, ctes, aliases };
}

const CONTEXT_WORDS = [
  "GROUP BY", "ORDER BY", "PARTITION BY", "UNION ALL", "INSERT INTO", "DELETE FROM",
  "CREATE TABLE", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN", "CROSS JOIN",
  "SELECT", "FROM", "WHERE", "HAVING", "LIMIT", "OFFSET", "JOIN", "ON", "USING",
  "UPDATE", "SET", "VALUES", "WITH", "AND", "OR", "CASE", "WHEN", "THEN", "ELSE",
  "IN", "LIKE", "BETWEEN", "AS", "BY", "JOIN", "TABLE", "INTO",
];

function contextBefore(text, offset) {
  const head = text.slice(0, offset);
  let best = null;
  for (const word of CONTEXT_WORDS) {
    const re = new RegExp(`\\b${word.replace(/ /g, "\\s+")}\\b`, "gi");
    let m;
    while ((m = re.exec(head))) {
      if (!best || m.index > best.index) best = { word: word.toUpperCase(), index: m.index };
    }
  }
  return best?.word ?? null;
}

const TABLE_CONTEXT = new Set(["FROM", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN", "CROSS JOIN", "UPDATE", "INTO", "TABLE", "CREATE TABLE"]);
const COLUMN_CONTEXT = new Set(["SELECT", "WHERE", "ON", "HAVING", "SET", "BY", "AND", "OR", "LIKE", "BETWEEN"]);

export function buildCompletions(text, line, character, { limit = 200 } = {}) {
  const { prefix, start } = wordPrefixAt(text, line, character);
  const offset = offsetAt(text, line, character);
  const analysis = analyzeDocument(text);
  const context = contextBefore(text, offset);

  // Qualified reference: alias.column → only that alias's columns from this document.
  const head = text.slice(0, start);
  const qualified = /([A-Za-z_][\w$]*)\s*\.\s*$/.exec(head);
  const qualifiedAlias = qualified ? qualified[1].toUpperCase() : null;

  const candidates = new Map();
  const add = (item, bucket) => {
    const key = item.label.toUpperCase();
    if (!key || candidates.has(key)) return;
    candidates.set(key, { ...item, bucket });
  };

  for (const item of VOCABULARY) {
    if (qualifiedAlias) continue;
    if (context && TABLE_CONTEXT.has(context) && item.vocabulary === "function") continue;
    add(item, 3);
  }
  for (const table of analysis.tables) {
    add({ label: table, detail: "Table or CTE in this document", kind: 6, vocabulary: "table" }, 0);
  }
  for (const cte of analysis.ctes) {
    add({ label: cte, detail: "CTE in this document", kind: 6, vocabulary: "cte" }, 0);
  }
  for (const alias of analysis.aliases.values()) {
    add({ label: alias, detail: "Alias in this document", kind: 6, vocabulary: "alias" }, 1);
  }
  for (const column of analysis.columns) {
    add({ label: column, detail: "Column in this document", kind: 5, vocabulary: "column" }, 2);
  }

  const needle = prefix.toUpperCase();
  const scored = [];
  for (const entry of candidates.values()) {
    const upper = entry.label.toUpperCase();
    let rank;
    if (!needle) rank = 4;
    else if (upper === needle) rank = 0;
    else if (upper.startsWith(needle)) rank = 1;
    else if (upper.includes(needle)) rank = 2;
    else continue;

    let bucket = entry.bucket;
    if (context && TABLE_CONTEXT.has(context)) {
      if (entry.vocabulary === "table" || entry.vocabulary === "cte") bucket = 0;
      else if (entry.vocabulary === "keyword") bucket = 4;
    } else if (context && COLUMN_CONTEXT.has(context)) {
      if (entry.vocabulary === "column") bucket = 0;
      else if (entry.vocabulary === "table" || entry.vocabulary === "cte") bucket = 4;
    }
    if (qualifiedAlias) {
      if (entry.vocabulary !== "column") continue;
      bucket = 0;
    }
    scored.push({ entry, rank, bucket });
  }

  scored.sort((a, b) => a.rank - b.rank || a.bucket - b.bucket || a.entry.label.localeCompare(b.entry.label));
  const range = {
    start: { line, character: character - prefix.length },
    end: { line, character },
  };
  return scored.slice(0, limit).map(({ entry }) => ({
    label: entry.label,
    detail: entry.detail,
    kind: entry.kind,
    sortText: String(entry.rank) + String(entry.bucket).padStart(2, "0") + entry.label.toUpperCase(),
    textEdit: { range, newText: entry.label },
  }));
}

const TOKEN_RE = /('(?:''|[^'])*'|"(?:[^"])*"|`[^`]*`|--[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][\w$]*|\d+(?:\.\d+)?|[(),.;=<>+\-*/]|\s+)/g;
const UPPER_KEYWORDS = new Set([
  "SELECT", "DISTINCT", "ALL", "FROM", "WHERE", "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC",
  "LIMIT", "OFFSET", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "ON", "USING", "AS",
  "UNION", "INTERSECT", "EXCEPT", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "TABLE", "VIEW", "INDEX", "ALTER", "DROP", "TRUNCATE", "PRIMARY", "KEY", "FOREIGN",
  "REFERENCES", "UNIQUE", "NOT", "NULL", "DEFAULT", "CHECK", "WITH", "RECURSIVE", "CASE",
  "WHEN", "THEN", "ELSE", "END", "CAST", "AND", "OR", "IN", "IS", "LIKE", "BETWEEN", "EXISTS",
  "OVER", "PARTITION", "ROWS", "RANGE", "TRUE", "FALSE", "RETURNING", "EXPLAIN",
]);
const CLAUSE_START = new Set(["SELECT", "FROM", "WHERE", "GROUP", "HAVING", "ORDER", "LIMIT", "OFFSET", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "ON", "SET", "VALUES", "UNION", "WITH", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "RETURNING"]);

export function formatSql(text) {
  const tokens = text.match(TOKEN_RE) ?? [];
  let out = "";
  let atLineStart = true;
  let lastSignificant = "";
  for (const raw of tokens) {
    if (/^\s+$/.test(raw)) {
      if (out.endsWith("\n") || out === "") continue;
      if (atLineStart) continue;
      out += " ";
      continue;
    }
    const upper = raw.toUpperCase();
    const isWord = /^[A-Za-z_][\w$]*$/.test(raw);
    const value = isWord && UPPER_KEYWORDS.has(upper) ? upper : raw;

    if (raw === ",") {
      out = out.replace(/ +$/, "") + ",\n  ";
      atLineStart = true;
      lastSignificant = ",";
      continue;
    }
    if (raw === ";") {
      out = out.replace(/ +$/, "") + ";\n";
      atLineStart = true;
      lastSignificant = ";";
      continue;
    }
    if (isWord && CLAUSE_START.has(upper) && out.trim() && !atLineStart && lastSignificant !== ".") {
      out = out.replace(/ +$/, "") + "\n" + value;
      atLineStart = false;
    } else {
      out += value;
    }
    if (raw === "." || /^--/.test(raw) || /^\/\*/.test(raw)) atLineStart = false;
    else if (!/^\s+$/.test(raw)) atLineStart = false;
    lastSignificant = isWord ? upper : raw;
  }
  return out
    .split("\n")
    .map((line) => line.replace(/ +$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

export function diagnoseSql(text) {
  const diagnostics = [];
  const lines = text.split("\n");
  let quoteLine = -1;
  let quoteChar = -1;
  let depth = 0;
  let openParen = null;

  for (let line = 0; line < lines.length; line++) {
    const content = lines[line];
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (quoteLine >= 0) {
        if (ch === quoteChar) {
          if (content[i + 1] === quoteChar) i++;
          else { quoteLine = -1; quoteChar = -1; }
        }
        continue;
      }
      if (ch === "'" || ch === '"') { quoteLine = line; quoteChar = ch; continue; }
      if (ch === "-" && content[i + 1] === "-") break;
      if (ch === "/" && content[i + 1] === "*") {
        const close = content.indexOf("*/", i + 2);
        if (close >= 0) i = close + 1;
        else break;
        continue;
      }
      if (ch === "(") { if (depth === 0) openParen = { line, character: i }; depth++; }
      if (ch === ")") {
        depth--;
        if (depth < 0) {
          diagnostics.push({
            range: { start: { line, character: i }, end: { line, character: i + 1 } },
            severity: 1,
            source: "lithe-sql",
            message: "Unmatched closing parenthesis.",
          });
          depth = 0;
        }
      }
    }
  }
  if (quoteLine >= 0) {
    const chars = lines[quoteLine] ?? "";
    diagnostics.push({
      range: { start: { line: quoteLine, character: Math.max(0, chars.length - 1) }, end: { line: quoteLine, character: chars.length } },
      severity: 1,
      source: "lithe-sql",
      message: `Unterminated ${quoteChar === "'" ? "string literal" : "quoted identifier"}.`,
    });
  }
  if (depth > 0 && openParen) {
    diagnostics.push({
      range: { start: openParen, end: { ...openParen, character: openParen.character + 1 } },
      severity: 1,
      source: "lithe-sql",
      message: "Unclosed parenthesis.",
    });
  }
  return diagnostics;
}

export function symbolsFor(text) {
  const analysis = analyzeDocument(text);
  const result = [];
  for (const name of analysis.ctes) {
    const index = text.toUpperCase().indexOf(`WITH ${name.toUpperCase()}`);
    result.push({
      name,
      kind: 12, // SymbolKind.Function-ish for CTEs
      range: { start: positionAt(text, index), end: positionAt(text, index + name.length) },
      selectionRange: { start: positionAt(text, index), end: positionAt(text, index + name.length) },
    });
  }
  for (const name of analysis.tables) {
    if (analysis.ctes.has(name)) continue;
    const index = text.toUpperCase().indexOf(name.toUpperCase());
    result.push({
      name,
      kind: 5, // SymbolKind.Class
      range: { start: positionAt(text, index), end: positionAt(text, index + name.length) },
      selectionRange: { start: positionAt(text, index), end: positionAt(text, index + name.length) },
    });
  }
  return result;
}

export function hoverAt(text, line, character) {
  const { prefix, start } = wordPrefixAt(text, line, character);
  const offset = offsetAt(text, line, character);
  let end = offset;
  while (end < text.length && IDENT.test(text[end])) end++;
  const word = text.slice(start, end) || prefix;
  if (!word) return null;
  const analysis = analyzeDocument(text);
  if (analysis.tables.has(word)) return { contents: { kind: "markdown", value: `**${word}** — table or CTE in this document.` } };
  if (analysis.columns.has(word)) return { contents: { kind: "markdown", value: `**${word}** — column in this document.` } };
  const description = hoverFor(word);
  if (!description) return null;
  return { contents: { kind: "markdown", value: `**${word.toUpperCase()}** — ${description}` } };
}
