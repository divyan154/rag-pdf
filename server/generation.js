import Anthropic from "@anthropic-ai/sdk";

export const GENERATION_MODEL = process.env.GENERATION_MODEL ?? "claude-haiku-5-5";

export function buildContext(docs) {
  return docs.map((doc) => doc.pageContent).join("\n\n---\n\n");
}

export function buildPrompt(contextText, question) {
  return `
Answer the question using ONLY the context below.
If the answer is not present in the context, reply exactly: I don't know.

Context:
${contextText}

Question:
${question}

Answer:
`;
}

export const isAbstention = (answer) => /^\s*i don['’]?t know\b/i.test(answer);

let client;

export async function generateAnswer(question, docs) {
  client ??= new Anthropic();
  const response = await client.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 2048,
    output_config: { effort: "medium" },
    messages: [
      { role: "user", content: buildPrompt(buildContext(docs), question) },
    ],
  });
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
