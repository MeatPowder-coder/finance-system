import assert from "node:assert/strict";
import test from "node:test";
import { buildCommitmentsQuery } from "./index.js";

test("commitments query skips SQL when there are zero accessible commitments", () => {
  assert.equal(buildCommitmentsQuery("2026-07-01", "2026-07-31", [], false), null);
});

test("commitments query binds one accessible commitment as the third parameter", () => {
  const result = buildCommitmentsQuery("2026-07-01", "2026-07-31", [7], false);
  assert.deepEqual(result?.values, ["2026-07-01", "2026-07-31", [7]]);
  assert.match(result?.text || "", /ANY\(\$3::bigint\[\]\)/);
});

test("commitments query binds many accessible commitments and active filter", () => {
  const result = buildCommitmentsQuery("2026-07-01", "2026-07-31", [7, "8", 9], true);
  assert.deepEqual(result?.values, ["2026-07-01", "2026-07-31", [7, 8, 9]]);
  assert.match(result?.text || "", /r\.is_active = TRUE/);
});
