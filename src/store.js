import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export function libraryPath(home = process.env.LEARNINGHARNESS_HOME || "data") {
  return path.join(home, "library.json");
}

export async function loadLibrary(home) {
  const file = libraryPath(home);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { sources: [], cards: [] };
    throw error;
  }
}

export async function saveLibrary(library, home) {
  const file = libraryPath(home);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(library, null, 2));
  return file;
}

export function addSource(library, { title, text }) {
  if (!title || !text) throw new Error("title and text are required");
  const source = { id: randomUUID(), title, text, createdAt: new Date().toISOString() };
  library.sources.push(source);
  return source;
}

export function addCard(library, { sourceId, front, back }) {
  if (!front || !back) throw new Error("front and back are required");
  if (sourceId && !library.sources.some((source) => source.id === sourceId)) {
    throw new Error("source not found");
  }
  const card = {
    id: randomUUID(),
    sourceId: sourceId || null,
    front,
    back,
    ease: 2.5,
    interval: 0,
    reps: 0,
    due: null,
    createdAt: new Date().toISOString()
  };
  library.cards.push(card);
  return card;
}
