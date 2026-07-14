import assert from "node:assert/strict";
import test from "node:test";
import { assertSqlParameterCount } from "./db.js";

test("SQL validation accepts a query with no parameters", () => {
  assert.doesNotThrow(() => assertSqlParameterCount("SELECT NOW()", []));
});

test("SQL validation accepts one and several parameters", () => {
  assert.doesNotThrow(() => assertSqlParameterCount("SELECT $1", ["2026-07-01"]));
  assert.doesNotThrow(() => assertSqlParameterCount("SELECT $1, $2, $3", [1, 2, 3]));
});

test("SQL validation reports the placeholder mismatch with context", () => {
  assert.throws(
    () => assertSqlParameterCount("SELECT $1, $2 FROM recurring_rules WHERE id = $2", [1, 2, 3]),
    /SQL parameter mismatch: expected 2, received 3.*recurring_rules/
  );
});
