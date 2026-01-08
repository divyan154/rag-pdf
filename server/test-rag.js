import { OllamaEmbeddings } from "@langchain/ollama";
import { QdrantVectorStore } from "@langchain/qdrant";

// --------------------
// 1. Test Questions
// --------------------

const testCases = [
  {
    question: "What is a query string?",
    expectedContains: "query string",
  },
  {
    question: "How do you install Node.js?",
    expectedContains: "install",
  },
  {
    question: "What is Express?",
    expectedContains: "express",
  },
  {
    question: "What is MongoDB?",
    expectedContains: "mongodb",
  },
  {
    question: "What is JWT used for?",
    expectedContains: "token",
  },
  {
    question: "What is Socket.io?",
    expectedContains: "socket",
  },
];

// --------------------
// 2. Setup Retriever
// --------------------

const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434",
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: "http://localhost:6333",
  collectionName: "langchainjs-testing",
});

const retriever = vectorStore.asRetriever({ k: 5 });

// --------------------
// 3. Run Evaluation
// --------------------

let hits = 0;

for (const test of testCases) {
  console.log("\n==============================");
  console.log("Question:", test.question);

  const results = await retriever.invoke(test.question);

  const texts = results.map((r) => r.pageContent.toLowerCase());

  console.log("Top 5 Retrieved Chunks:\n");

  texts.forEach((t, i) => {
    console.log(`--- Result ${i + 1} ---`);
    console.log(t.slice(0, 300), "\n");
  });

  const found = texts.some((t) =>
    t.includes(test.expectedContains.toLowerCase())
  );

  if (found) {
    console.log("✅ HIT: Expected content found");
    hits++;
  } else {
    console.log("❌ MISS: Expected content NOT found");
  }
}

// --------------------
// 4. Print Final Score
// --------------------

const recall = hits / testCases.length;

console.log("\n==============================");
console.log(`Recall@5 = ${hits} / ${testCases.length} = ${recall}`);
console.log("==============================\n");
