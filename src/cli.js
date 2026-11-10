#!/usr/bin/env node
import { addCard, addSource, loadLibrary, saveLibrary } from "./store.js";
import { searchSources } from "./retrieve.js";
import { isDue, reviewCard } from "./sm2.js";
import { askWithSources, createGatewayModel } from "./tutor.js";

function flag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

const command = process.argv[2];
const home = process.env.LEARNINGHARNESS_HOME;

if (command === "add-source") {
  const library = await loadLibrary(home);
  const source = addSource(library, { title: flag("--title"), text: flag("--text") });
  await saveLibrary(library, home);
  console.log(source.id);
} else if (command === "add-card") {
  const library = await loadLibrary(home);
  const card = addCard(library, {
    sourceId: flag("--source"),
    front: flag("--front"),
    back: flag("--back")
  });
  await saveLibrary(library, home);
  console.log(card.id);
} else if (command === "retrieve") {
  const library = await loadLibrary(home);
  const hits = searchSources(library.sources, process.argv.slice(3).join(" "));
  for (const hit of hits) console.log(`${hit.score}\t${hit.source.id}\t${hit.source.title}`);
} else if (command === "due") {
  const library = await loadLibrary(home);
  const now = new Date();
  for (const card of library.cards.filter((card) => isDue(card, now))) {
    console.log(`${card.id}\t${card.front}`);
  }
} else if (command === "grade") {
  const library = await loadLibrary(home);
  const id = process.argv[3];
  const card = library.cards.find((item) => item.id === id);
  if (!card) throw new Error("card not found");
  const next = reviewCard(card, process.argv[4], new Date());
  Object.assign(card, next);
  await saveLibrary(library, home);
  console.log(`${card.id}\tdue=${card.due}\tease=${card.ease}\tinterval=${card.interval}`);
} else if (command === "ask") {
  const question = process.argv.slice(3).filter((arg) => !arg.startsWith("--")).join(" ");
  const library = await loadLibrary(home);
  if (process.argv.includes("--retrieve-only")) {
    const hits = searchSources(library.sources, question);
    for (const hit of hits) console.log(`${hit.source.id}\t${hit.source.title}`);
  } else {
    const apiKey = process.env.LEARNINGHARNESS_API_KEY;
    if (!apiKey) throw new Error("LEARNINGHARNESS_API_KEY is required for ask");
    const model = createGatewayModel({
      baseUrl: process.env.LEARNINGHARNESS_BASE_URL || "http://100.77.149.48:3425",
      apiKey,
      model: process.env.LEARNINGHARNESS_MODEL || "grok/grok-4.7"
    });
    const result = await askWithSources({ library, question, model });
    for (const hit of result.hits) console.log(`source\t${hit.source.id}\t${hit.source.title}`);
    console.log(result.answer);
  }
} else {
  console.log("commands: add-source, add-card, retrieve, due, grade, ask");
  process.exitCode = command ? 1 : 0;
}
