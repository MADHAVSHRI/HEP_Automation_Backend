"use strict";

/**
 * sqlExistsToIn — rewrite correlated EXISTS predicates into hashable IN lists.
 *
 *   EXISTS (SELECT 1 FROM t a [JOIN …] WHERE a."fk" = pr.id AND <conds>)
 *     →
 *   pr.id IN (SELECT a."fk" FROM t a [JOIN …] WHERE a."fk" IS NOT NULL AND <conds>)
 *
 * Why: the approver pass-request queries build their role rules from dozens of
 * correlated EXISTS clauses. Postgres evaluates each of those once per outer
 * row (an index probe per row per clause), which on a 20k-row table means
 * hundreds of thousands of probes per query. The rewritten form is an
 * uncorrelated subquery that Postgres executes once and hashes; the per-row
 * work becomes a hash lookup.
 *
 * Equivalence: `a."fk" = pr.id` is only true for non-NULL fk values, so the
 * explicit `IS NOT NULL` makes the IN list NULL-free and the two forms return
 * exactly the same TRUE/FALSE for every row (no three-valued-logic surprises,
 * even under NOT (…)). pr.id / v.id are primary keys and never NULL.
 *
 * A clause is left untouched when it is `NOT EXISTS`, when it has no single
 * clean `<alias>."<col>" = <outer>.id` predicate, or when the remaining
 * conditions reference any alias that is not declared in the subquery's own
 * FROM clause (i.e. it is still correlated with something).
 *
 * The transformation is purely textual and idempotent; apply it to the final
 * SQL string right before pool.query().
 */

const OUTER_ALIASES = ["pr", "v"];

/** Index of the ')' matching the '(' at `open`, honouring single-quoted strings. */
function matchParen(sql, open) {
  let depth = 0;
  let inStr = false;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) {
      if (ch === "'") {
        if (sql[i + 1] === "'") i++; // escaped quote
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") inStr = true;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split on top-level (depth 0, outside strings) occurrences of a keyword. */
function splitTopLevel(text, keyword) {
  const parts = [];
  let depth = 0;
  let inStr = false;
  let last = 0;
  const kw = keyword.toUpperCase();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "'") {
        if (text[i + 1] === "'") i++;
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") inStr = true;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && /\s/.test(ch)) {
      const slice = text.substr(i + 1, kw.length).toUpperCase();
      if (slice === kw && /\s/.test(text[i + 1 + kw.length] || "")) {
        parts.push(text.slice(last, i));
        last = i + 1 + kw.length;
        i = last - 1;
      }
    }
  }
  parts.push(text.slice(last));
  return parts;
}

/** Aliases declared in a FROM clause: `FROM t a`, `JOIN t b ON …`, `JOIN LATERAL (…) c ON true`. */
function fromAliases(fromClause, includeNested = false) {
  const aliases = new Set();
  // strip parenthesised sub-selects so their internals do not leak aliases
  // (unless the caller explicitly wants every declaration in the text)
  let flat = "";
  let depth = 0;
  for (const ch of fromClause) {
    if (ch === "(") depth++;
    if (depth === 0 || includeNested) flat += ch;
    if (ch === ")") depth--;
  }
  const re = /(?:^|\bFROM\s+|\bJOIN\s+(?:LATERAL\s+)?)("?[\w.]+"?|)\s*("?\w+"?)?/gi;
  let m;
  while ((m = re.exec(flat)) !== null) {
    const tbl = m[1] ? m[1].replace(/"/g, "") : "";
    const alias = m[2] ? m[2].replace(/"/g, "") : "";
    if (!tbl && !alias) continue;
    if (alias && !/^(ON|WHERE|LEFT|INNER|JOIN|LATERAL|AS)$/i.test(alias)) aliases.add(alias);
    if (tbl && !/^(LATERAL)$/i.test(tbl)) aliases.add(tbl.split(".").pop());
  }
  // "JOIN LATERAL (subquery) alias ON" — alias follows the closing paren
  const lat = /\)\s*("?\w+"?)\s+ON\b/gi;
  while ((m = lat.exec(fromClause)) !== null) aliases.add(m[1].replace(/"/g, ""));
  return aliases;
}

function referencedAliases(text) {
  const refs = new Set();
  const re = /\b([A-Za-z_]\w*)\s*\.\s*(?:"[^"]+"|[A-Za-z_]\w*)/g;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1]);
  return refs;
}

function tryRewrite(body, outerAliases) {
  const head = body.match(/^\s*SELECT\s+1\s+FROM\s+/i);
  if (!head) return null;
  const rest = body.slice(head[0].length);
  const whereParts = splitTopLevel(rest, "WHERE");
  if (whereParts.length !== 2) return null;
  const fromClause = whereParts[0].trim();
  const conds = splitTopLevel(whereParts[1], "AND").map((c) => c.trim()).filter(Boolean);

  let corr = null;
  const others = [];
  for (const c of conds) {
    let m = c.match(/^(\w+)\."(\w+)"\s*=\s*(\w+)\.id$/);
    if (m && outerAliases.includes(m[3]) && !corr) {
      corr = { alias: m[1], col: m[2], outer: m[3] };
      continue;
    }
    m = c.match(/^(\w+)\.id\s*=\s*(\w+)\."(\w+)"$/);
    if (m && outerAliases.includes(m[1]) && !corr) {
      corr = { alias: m[2], col: m[3], outer: m[1] };
      continue;
    }
    others.push(c);
  }
  if (!corr) return null;

  const declared = fromAliases(fromClause);
  if (!declared.has(corr.alias)) return null;
  // Aliases declared anywhere inside the body (including nested sub-selects)
  // are local to it; anything referenced but not declared is an outer
  // correlation and disqualifies the rewrite. If a nested sub-select re-uses
  // an outer alias name (shadowing), bail out rather than guess.
  const declaredAnywhere = fromAliases(body.replace(/\(/g, " ( ").replace(/\)/g, " ) "), true);
  for (const oa of outerAliases) {
    if (declaredAnywhere.has(oa)) return null;
  }
  const used = new Set([...referencedAliases(fromClause), ...referencedAliases(others.join(" AND "))]);
  for (const a of used) {
    if (!declared.has(a) && !declaredAnywhere.has(a)) return null; // still correlated → leave as is
  }

  const where = [`${corr.alias}."${corr.col}" IS NOT NULL`, ...others].join("\n            AND ");
  return `${corr.outer}.id IN (
          SELECT ${corr.alias}."${corr.col}"
          FROM ${fromClause}
          WHERE ${where}
        )`;
}

/**
 * @param {string} sql
 * @param {string[]} [outerAliases=["pr","v"]] aliases of the outer table(s) whose `id` the EXISTS correlates on
 * @returns {string}
 */
function existsToIn(sql, outerAliases = OUTER_ALIASES) {
  const re = /\bEXISTS\s*\(/gi;
  const positions = [];
  let m;
  while ((m = re.exec(sql)) !== null) positions.push(m.index);
  // right-to-left so earlier offsets stay valid after each replacement
  for (let k = positions.length - 1; k >= 0; k--) {
    const start = positions[k];
    if (/\bNOT\s*$/i.test(sql.slice(Math.max(0, start - 8), start))) continue; // NOT EXISTS
    const open = sql.indexOf("(", start);
    const close = matchParen(sql, open);
    if (close < 0) continue;
    const body = sql.slice(open + 1, close);
    const rewritten = tryRewrite(body, outerAliases);
    if (!rewritten) continue;
    sql = sql.slice(0, start) + rewritten + sql.slice(close + 1);
  }
  return sql;
}

module.exports = { existsToIn };
