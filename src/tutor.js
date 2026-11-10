import { createMiniAssembledLoop } from "@ppeng/agent-loop";
import { searchSources } from "./retrieve.js";

function textOf(message) {
  return (message.parts || [])
    .map((part) => (part.type === "text" ? part.text || "" : ""))
    .filter(Boolean)
    .join("\n");
}

export function createGatewayModel({ baseUrl, apiKey, model }) {
  const root = baseUrl.replace(/\/$/, "");
  return {
    async runTurn(input) {
      const messages = [
        { role: "system", content: input.systemPrompt || "" },
        ...input.messages.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: textOf(message)
        }))
      ];
      const response = await fetch(`${root}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`model HTTP ${response.status}`);
      }
      const text = body.choices?.[0]?.message?.content || "";
      return {
        assistantParts: [{ type: "text", text }],
        stopReason: "end_turn",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 1 }
      };
    }
  };
}

export async function askWithSources({ library, question, model }) {
  const hits = searchSources(library.sources, question);
  const evidence = hits
    .map((hit) => `[${hit.source.id}] ${hit.source.title}\n${hit.source.text}`)
    .join("\n\n");
  const loop = createMiniAssembledLoop({
    io: {
      model,
      agent: {
        id: "learningharness-tutor",
        name: "Learning Tutor",
        systemPrompt: [
          "Answer only from the sources below. Cite source ids. If the sources do not contain the answer, say so.",
          evidence || "(no matching sources)"
        ].join("\n\n")
      },
      tools: [
        {
          name: "search_sources",
          description: "Search the local learning sources.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"]
          },
          approvalMode: "never",
          sideEffectLevel: "none",
          access: "read",
          async execute(_context, args) {
            const found = searchSources(library.sources, args.query || "");
            return {
              ok: true,
              content: found.map((hit) => `${hit.source.title}: ${hit.source.text}`).join("\n")
            };
          }
        }
      ],
      permission: { mode: "bypass" }
    }
  });
  const result = await loop.run({ input: question });
  const answer = (result.messages || [])
    .filter((message) => message.role === "assistant")
    .map(textOf)
    .filter(Boolean)
    .at(-1) || "";
  return { hits, answer };
}
