// Client-side completion filtering.
//
// tsserver returns the full identifier/keyword list for an "invoked" completion
// (the shape Lithe asks for) and expects the editor to narrow it by the word
// being typed. Lithe renders the list verbatim, so users see _APIURL/_HOST/...
// instead of `console`/`const` when typing `cons`. This module supplies the
// missing client-side step for the Node plugin's stdio proxy.

const IDENTIFIER = /[A-Za-z0-9_$]+$/;

export function wordPrefixBefore(text, line, character) {
  if (typeof text !== "string" || !Number.isInteger(line) || line < 0 || !Number.isInteger(character) || character < 1) {
    return "";
  }
  // LSP positions are UTF-16 code-unit offsets, which is exactly how JS indexes strings.
  const lines = text.split("\n");
  if (line >= lines.length) return "";
  const before = lines[line].slice(0, character);
  const match = IDENTIFIER.exec(before);
  return match ? match[0] : "";
}

export function applyContentChanges(text, changes) {
  let result = typeof text === "string" ? text : "";
  if (!Array.isArray(changes)) return result;
  for (const change of changes) {
    if (!change || typeof change.text !== "string") continue;
    if (!change.range) {
      result = change.text;
      continue;
    }
    const start = offsetAt(result, change.range.start);
    const end = offsetAt(result, change.range.end);
    result = result.slice(0, start) + change.text + result.slice(end);
  }
  return result;
}

function offsetAt(text, position) {
  const line = Math.max(0, position?.line ?? 0);
  const character = Math.max(0, position?.character ?? 0);
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += lines[i].length + 1;
  }
  return Math.min(offset + character, text.length);
}

function filterTextOf(item) {
  const value = item?.filterText ?? item?.label ?? item?.insertText;
  return typeof value === "string" ? value : "";
}

// tsserver returns plain completion items (label + data) with neither textEdit
// nor insertText for identifier/keyword completions. Lithe's editor only
// inserts item.label at the caret when textEdit is absent, which turns `cons`
// + `const` into `consconst`. Give the item a textEdit that replaces exactly
// the identifier already typed.
function withReplacementTextEdit(item, prefix, position) {
  if (item?.textEdit || typeof item?.insertText === "string") return item;
  if (!prefix || !position || !Number.isInteger(position.line) || !Number.isInteger(position.character)) {
    return item;
  }
  const startCharacter = position.character - prefix.length;
  if (startCharacter < 0) return item;
  const range = {
    start: { line: position.line, character: startCharacter },
    end: { line: position.line, character: position.character },
  };
  const label = filterTextOf(item);
  return {
    ...item,
    textEdit: { range, newText: label },
  };
}

export function filterCompletionResult(result, prefix, position) {
  const isList = result && !Array.isArray(result) && Array.isArray(result.items);
  const items = isList ? result.items : Array.isArray(result) ? result : null;
  // No prefix (e.g. an explicit invoke at an empty position) or no data: pass through.
  if (!items || !prefix) return result;

  const needle = prefix.toLowerCase();
  const scored = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = filterTextOf(item);
    const lowered = label.toLowerCase();
    let score;
    if (lowered === needle) score = 0;
    else if (lowered.startsWith(needle)) score = 1;
    else if (lowered.includes(needle)) score = 2;
    else continue;
    scored.push({ item, score, index: i });
  }
  // If the server returned no plausible match, keep the original list rather
  // than showing an empty popup.
  if (scored.length === 0) return result;

  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  const narrowed = scored.map((entry) => withReplacementTextEdit(entry.item, prefix, position));
  if (isList) {
    return { ...result, items: narrowed, isIncomplete: false };
  }
  return narrowed;
}
