import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendDraftCards, draftCardsFromSource, parseDraftCards } from "../src/draft-cards.js";

const fixture = `[
  {"front": "What does SM-2 store?", "back": "ease, interval, repetitions"},
  {"front": "What grade range does SM-2 use?", "back": "0 to 5"}
]`;

test("parseDraftCards reads a JSON array of front and back from fixture text", () => {
  assert.deepEqual(parseDraftCards(fixture), [
    { front: "What does SM-2 store?", back: "ease, interval, repetitions" },
    { front: "What grade range does SM-2 use?", back: "0 to 5" }
  ]);
});

test("parseDraftCards rejects fixture text that is not an array of cards", () => {
  const bad = [
    "not json",
    '{"front":"What?","back":"Answer"}',
    '[{"front":"What?"}]',
    '[{"front":"","back":"Answer"}]',
    '[{"front":"   ","back":"Answer"}]',
    '[{"front":1,"back":"Answer"}]',
    '[{"front":"What?","back":"Answer"},{"back":"only"}]',
    "```json\n" + fixture + "\n```"
  ];
  for (const text of bad) {
    assert.throws(() => parseDraftCards(text), /draft cards/);
  }
});

test("parseDraftCards keeps an empty array and drops extra fields", () => {
  assert.deepEqual(parseDraftCards("[]"), []);
  assert.deepEqual(parseDraftCards('[{"front":"What?","back":"Answer","note":"ignore"}]'), [
    { front: "What?", back: "Answer" }
  ]);
});

test("invalid draft text adds no cards", () => {
  const library = { sources: [{ id: "s1", title: "SM-2", text: "ease" }], cards: [] };
  assert.throws(() => appendDraftCards(library, "s1", "not json"), /draft cards/);
  assert.deepEqual(library.cards, []);
});

test("valid draft text adds cards for that source", () => {
  const library = { sources: [{ id: "s1", title: "SM-2", text: "ease" }], cards: [] };
  const added = appendDraftCards(library, "s1", fixture);
  assert.equal(added.length, 2);
  assert.equal(library.cards.length, 2);
  assert.equal(library.cards[0].sourceId, "s1");
  assert.equal(library.cards[0].front, "What does SM-2 store?");
  assert.equal(library.cards[0].back, "ease, interval, repetitions");
  assert.equal(library.cards[0].ease, 2.5);
  assert.equal(library.cards[0].interval, 0);
  assert.equal(library.cards[0].reps, 0);
});

test("draftCardsFromSource proposes cards from that one source through the agent loop", async () => {
  let seen = "";
  const model = {
    async runTurn(input) {
      seen = (input.messages || [])
        .map((message) => (message.parts || []).map((part) => part.text || "").join("\n"))
        .join("\n");
      return {
        assistantParts: [{ type: "text", text: fixture }],
        stopReason: "end_turn",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 1 }
      };
    }
  };
  const cards = await draftCardsFromSource({
    source: { id: "s1", title: "SM-2", text: "ease interval repetitions" },
    model
  });
  assert.match(seen, /ease interval repetitions/);
  assert.doesNotMatch(seen, /unrelated note/);
  assert.deepEqual(cards, [
    { front: "What does SM-2 store?", back: "ease, interval, repetitions" },
    { front: "What grade range does SM-2 use?", back: "0 to 5" }
  ]);
});

test("draftCardsFromSource rejects model text that is not card JSON", async () => {
  const model = {
    async runTurn() {
      return {
        assistantParts: [{ type: "text", text: "I cannot draft cards." }],
        stopReason: "end_turn",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 1 }
      };
    }
  };
  await assert.rejects(
    () => draftCardsFromSource({
      source: { id: "s1", title: "SM-2", text: "ease interval repetitions" },
      model
    }),
    /draft cards/
  );
});

const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      env: { ...process.env, ...env }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function writeLibrary(library) {
  const home = await mkdtemp(path.join(tmpdir(), "learningharness-"));
  const file = path.join(home, "library.json");
  const original = JSON.stringify(library, null, 2);
  await writeFile(file, original);
  return { home, file, original };
}

test("draft-cards writes nothing when the source is missing", async () => {
  const { home, file, original } = await writeLibrary({
    sources: [{ id: "s1", title: "SM-2", text: "ease interval repetitions" }],
    cards: []
  });
  const result = await runCli(["draft-cards", "--source", "missing"], {
    LEARNINGHARNESS_HOME: home,
    LEARNINGHARNESS_API_KEY: "test-key",
    LEARNINGHARNESS_BASE_URL: "http://127.0.0.1:1"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source not found/);
  assert.equal(await readFile(file, "utf8"), original);
});

test("draft-cards saves parsed cards and leaves the file untouched when the model reply is not JSON", async () => {
  const library = {
    sources: [
      { id: "s1", title: "SM-2", text: "ease interval repetitions" },
      { id: "s2", title: "other", text: "unrelated note" }
    ],
    cards: []
  };
  const bodies = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      bodies.push(body);
      const content = bodies.length === 1 ? fixture : "not json";
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const good = await writeLibrary(library);
    const saved = await runCli(["draft-cards", "--source", "s1"], {
      LEARNINGHARNESS_HOME: good.home,
      LEARNINGHARNESS_API_KEY: "test-key",
      LEARNINGHARNESS_BASE_URL: `http://127.0.0.1:${port}`
    });
    assert.equal(saved.status, 0);
    assert.match(bodies[0], /ease interval repetitions/);
    assert.doesNotMatch(bodies[0], /unrelated note/);
    const stored = JSON.parse(await readFile(good.file, "utf8"));
    assert.equal(stored.cards.length, 2);
    assert.equal(stored.cards[0].sourceId, "s1");
    assert.equal(stored.cards[0].front, "What does SM-2 store?");
    assert.equal(stored.cards[1].back, "0 to 5");
    assert.equal(saved.stdout.trim().split("\n").length, 2);

    const bad = await writeLibrary(library);
    const rejected = await runCli(["draft-cards", "--source", "s1"], {
      LEARNINGHARNESS_HOME: bad.home,
      LEARNINGHARNESS_API_KEY: "test-key",
      LEARNINGHARNESS_BASE_URL: `http://127.0.0.1:${port}`
    });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /draft cards/);
    assert.equal(await readFile(bad.file, "utf8"), bad.original);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
