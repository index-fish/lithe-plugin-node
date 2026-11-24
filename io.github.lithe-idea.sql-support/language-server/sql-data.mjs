// Static SQL vocabulary used by the completion and hover providers.
// Kept as data only: no imports, no side effects, easy to unit test.

const keyword = (label, detail) => ({
  label,
  detail: detail ?? "SQL keyword",
  kind: 15, // CompletionItemKind.Keyword
  vocabulary: "keyword",
});

const func = (label, detail) => ({
  label,
  detail: detail ?? "SQL function",
  kind: 3, // CompletionItemKind.Function
  vocabulary: "function",
});

const type = (label) => ({
  label,
  detail: "SQL data type",
  kind: 7, // CompletionItemKind.Class
  vocabulary: "type",
});

export const KEYWORDS = [
  "SELECT", "DISTINCT", "ALL", "FROM", "WHERE", "GROUP BY", "HAVING", "ORDER BY",
  "ASC", "DESC", "LIMIT", "OFFSET", "FETCH", "TOP", "AS",
  "JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "CROSS JOIN", "ON", "USING",
  "UNION", "UNION ALL", "INTERSECT", "EXCEPT",
  "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "UPSERT", "REPLACE INTO",
  "CREATE TABLE", "CREATE VIEW", "CREATE INDEX", "ALTER TABLE", "DROP TABLE", "TRUNCATE TABLE",
  "PRIMARY KEY", "FOREIGN KEY", "REFERENCES", "UNIQUE", "NOT NULL", "DEFAULT", "CHECK", "CONSTRAINT",
  "WITH", "RECURSIVE", "CASE", "WHEN", "THEN", "ELSE", "END", "CAST",
  "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE", "ILIKE", "BETWEEN", "EXISTS", "ANY", "SOME",
  "TRUE", "FALSE", "COLLATE", "ESCAPE", "OVER", "PARTITION BY", "ROWS", "RANGE",
  "GRANT", "REVOKE", "BEGIN", "COMMIT", "ROLLBACK", "EXPLAIN", "RETURNING", "FOR UPDATE",
].map((label) => keyword(label));

export const FUNCTIONS = [
  ["COUNT", "COUNT(*) — count rows"],
  ["SUM", "SUM(expr) — sum of values"],
  ["AVG", "AVG(expr) — arithmetic mean"],
  ["MIN", "MIN(expr) — minimum value"],
  ["MAX", "MAX(expr) — maximum value"],
  ["COALESCE", "COALESCE(a, b, ...) — first non-null value"],
  ["NULLIF", "NULLIF(a, b) — null when a equals b"],
  ["GREATEST", "GREATEST(a, b, ...) — largest value"],
  ["LEAST", "LEAST(a, b, ...) — smallest value"],
  ["ABS", "ABS(n) — absolute value"],
  ["ROUND", "ROUND(n, digits) — round to digits"],
  ["CEIL", "CEIL(n) — round up"],
  ["FLOOR", "FLOOR(n) — round down"],
  ["MOD", "MOD(a, b) — remainder"],
  ["POWER", "POWER(base, exp) — exponentiation"],
  ["SQRT", "SQRT(n) — square root"],
  ["LOWER", "LOWER(s) — lowercase string"],
  ["UPPER", "UPPER(s) — uppercase string"],
  ["LENGTH", "LENGTH(s) — string length"],
  ["CHAR_LENGTH", "CHAR_LENGTH(s) — character count"],
  ["TRIM", "TRIM(s) — remove surrounding whitespace"],
  ["LTRIM", "LTRIM(s) — trim leading whitespace"],
  ["RTRIM", "RTRIM(s) — trim trailing whitespace"],
  ["SUBSTRING", "SUBSTRING(s FROM i FOR n) — substring"],
  ["SUBSTR", "SUBSTR(s, i, n) — substring"],
  ["REPLACE", "REPLACE(s, from, to) — replace text"],
  ["CONCAT", "CONCAT(a, b, ...) — join strings"],
  ["POSITION", "POSITION(sub IN s) — find substring"],
  ["LPAD", "LPAD(s, len, pad) — pad on the left"],
  ["RPAD", "RPAD(s, len, pad) — pad on the right"],
  ["NOW", "NOW() — current timestamp"],
  ["CURRENT_DATE", "CURRENT_DATE — current date"],
  ["CURRENT_TIME", "CURRENT_TIME — current time"],
  ["CURRENT_TIMESTAMP", "CURRENT_TIMESTAMP — current timestamp"],
  ["EXTRACT", "EXTRACT(field FROM date) — date part"],
  ["DATE_TRUNC", "DATE_TRUNC(field, date) — truncate date"],
  ["DATE_ADD", "DATE_ADD(date, INTERVAL n unit) — add interval"],
  ["DATEDIFF", "DATEDIFF(a, b) — day difference"],
  ["STRFTIME", "STRFTIME(date, format) — format date"],
  ["JSON_EXTRACT", "JSON_EXTRACT(json, path) — read JSON path"],
  ["JSON_OBJECT", "JSON_OBJECT(k, v, ...) — build JSON object"],
  ["ROW_NUMBER", "ROW_NUMBER() OVER (...) — row sequence"],
  ["RANK", "RANK() OVER (...) — rank with gaps"],
  ["DENSE_RANK", "DENSE_RANK() OVER (...) — rank without gaps"],
  ["LAG", "LAG(expr, n) OVER (...) — previous row value"],
  ["LEAD", "LEAD(expr, n) OVER (...) — next row value"],
  ["FIRST_VALUE", "FIRST_VALUE(expr) OVER (...) — first value in window"],
  ["LAST_VALUE", "LAST_VALUE(expr) OVER (...) — last value in window"],
  ["GROUP_CONCAT", "GROUP_CONCAT(expr) — aggregate strings"],
  ["STRING_AGG", "STRING_AGG(expr, sep) — aggregate strings"],
  ["ARRAY_AGG", "ARRAY_AGG(expr) — aggregate into array"],
  ["BOOL_AND", "BOOL_AND(expr) — aggregate AND"],
  ["BOOL_OR", "BOOL_OR(expr) — aggregate OR"],
].map(([label, detail]) => func(label, detail));

export const TYPES = [
  "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "SERIAL", "BIGSERIAL",
  "VARCHAR", "CHAR", "TEXT", "CLOB", "NVARCHAR", "BLOB", "BYTEA",
  "BOOLEAN", "BOOL", "DATE", "TIME", "TIMESTAMP", "DATETIME", "INTERVAL",
  "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "MONEY",
  "JSON", "JSONB", "XML", "UUID", "ARRAY", "ENUM",
].map((label) => type(label));

export const VOCABULARY = [...KEYWORDS, ...FUNCTIONS, ...TYPES];

const HOVER_TEXT = {
  SELECT: "Retrieve rows from one or more tables.",
  FROM: "Specify the source table or subquery.",
  WHERE: "Filter rows before grouping.",
  "GROUP BY": "Group rows by one or more expressions.",
  HAVING: "Filter groups after aggregation.",
  "ORDER BY": "Sort the result set.",
  JOIN: "Combine rows from two tables.",
  "LEFT JOIN": "Keep all rows from the left table.",
  "WITH": "Define a common table expression (CTE).",
  DISTINCT: "Remove duplicate rows from the result.",
  "INSERT INTO": "Insert new rows into a table.",
  UPDATE: "Modify existing rows.",
  "DELETE FROM": "Remove rows from a table.",
  "CREATE TABLE": "Create a new table.",
  "PRIMARY KEY": "Uniquely identify each row in a table.",
  "FOREIGN KEY": "Reference a key in another table.",
  COUNT: "COUNT(expr) → BIGINT — count rows or non-null values.",
  SUM: "SUM(expr) — sum of numeric values.",
  AVG: "AVG(expr) — arithmetic mean.",
  COALESCE: "COALESCE(a, b, ...) — first non-null argument.",
  "ROW_NUMBER": "ROW_NUMBER() OVER (...) — sequential row number in a window.",
};

export function hoverFor(word) {
  const upper = word.toUpperCase();
  const direct = HOVER_TEXT[upper];
  if (direct) return direct;
  const item = VOCABULARY.find((v) => v.label.toUpperCase() === upper);
  return item ? `${item.label} — ${item.detail}` : null;
}
