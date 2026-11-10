import test from "node:test";
import assert from "node:assert/strict";
import { searchSources } from "../src/retrieve.js";

test("search ranks the source that contains more query terms", () => {
  const hits = searchSources([
    { id: "a", title: "SM-2", text: "ease interval repetitions" },
    { id: "b", title: "other", text: "unrelated note" }
  ], "ease interval");
  assert.equal(hits[0].source.id, "a");
  assert.equal(hits[0].score, 2);
});
