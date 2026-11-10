import test from "node:test";
import assert from "node:assert/strict";
import { isDue, reviewCard } from "../src/sm2.js";

test("a good grade schedules the next day", () => {
  const card = reviewCard({ id: "c1" }, 4, new Date("2026-11-10T00:00:00Z"));
  assert.equal(card.reps, 1);
  assert.equal(card.interval, 1);
  assert.equal(isDue(card, new Date("2026-11-10T12:00:00Z")), false);
  assert.equal(isDue(card, new Date("2026-11-11T00:00:00Z")), true);
});

test("a failed grade resets repetitions", () => {
  const again = reviewCard({ id: "c1", reps: 3, interval: 10, ease: 2.5 }, 1);
  assert.equal(again.reps, 0);
  assert.equal(again.interval, 1);
});
