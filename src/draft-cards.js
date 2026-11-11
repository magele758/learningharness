import { createMiniAssembledLoop } from "@ppeng/agent-loop";
import { createDefaultMemoryStore } from "@ppeng/agent-loop/mini";
import { addCard } from "./store.js";

const DRAFT_ERROR = "draft cards must be a JSON array of {front, back}";

function textOf(message) {
  return (message.parts || [])
    .map((part) => (part.type === "text" ? part.text || "" : ""))
    .filter(Boolean)
    .join("\n");
}

export function parseDraftCards(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(DRAFT_ERROR);
  }
  if (!Array.isArray(parsed)) throw new Error(DRAFT_ERROR);
  return parsed.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(DRAFT_ERROR);
    if (typeof item.front !== "string" || typeof item.back !== "string") throw new Error(DRAFT_ERROR);
    const front = item.front.trim();
    const back = item.back.trim();
    if (!front || !back) throw new Error(DRAFT_ERROR);
    return { front, back };
  });
}

export function appendDraftCards(library, sourceId, text) {
  const drafts = parseDraftCards(text);
  return drafts.map((draft) => addCard(library, {
    sourceId,
    front: draft.front,
    back: draft.back
  }));
}

export async function draftCardsFromSource({ source, model }) {
  if (!source?.id || !source.text) throw new Error("source not found");
  const agent = {
    id: "learningharness-drafter",
    name: "Card Drafter",
    role: "assistant",
    instructions: "Reply with only a JSON array of objects with string fields front and back. No markdown.",
    systemPrompt: "Propose flashcards from the single source in the user message. Reply with only a JSON array of {front, back}."
  };
  const { store, surface } = createDefaultMemoryStore({ agent });
  const session = surface.createSession({
    title: source.title || source.id,
    mode: "chat",
    agentId: agent.id
  });
  surface.appendMessage(session.id, "user", [{
    type: "text",
    text: [`Source ${source.id}: ${source.title || ""}`, source.text, "Draft flashcards from this source only."].join("\n\n")
  }]);
  const loop = createMiniAssembledLoop({
    io: {
      model,
      agent,
      store,
      tools: [],
      permission: { mode: "bypass" }
    }
  });
  await loop.run(session.id);
  const answer = (store.foldMessages(session.id) || [])
    .filter((message) => message.role === "assistant")
    .map(textOf)
    .filter(Boolean)
    .at(-1) || "";
  return parseDraftCards(answer);
}
