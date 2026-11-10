import test from "node:test";
import assert from "node:assert/strict";
import { createMiniAssembledLoop } from "@ppeng/agent-loop";

test("local agent-loop package exports the mini loop", () => {
  assert.equal(typeof createMiniAssembledLoop, "function");
});
