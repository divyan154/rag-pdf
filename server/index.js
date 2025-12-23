import express from "express";

import multer from "multer";
import cors from "cors";
import { Queue } from "bullmq";
import { OllamaEmbeddings } from "@langchain/ollama";
import { QdrantVectorStore } from "@langchain/qdrant";

const app = express();
const queue = new Queue("ProcessPdfQueue", {
  connection: { host: "localhost", port: 6379 },
});
app.use(cors());
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });
app.get("/", (req, res) => {
  res.send("Hello from Rag server");
});

app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  await queue.add("pdf-process", {
    name: req.file.originalname,
    path: req.file.path,
    destination: req.file.destination,
  });

  res.send({ message: "File uploaded successfully", file: req.file });
});

app.post("/chat", async (req, res) => {
  try {
    const userQuery = "What is Chunking Strategy?";

    const embeddings = new OllamaEmbeddings({
      model: "nomic-embed-text",
      baseUrl: "http://localhost:11434",
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: "http://localhost:6333",
        collectionName: "langchainjs-testing",
      }
    );

    const retriever = vectorStore.asRetriever({ k: 2 });
    const result = await retriever.invoke(userQuery);

    console.log("Retrieved results:", result);

    res.status(200).json({
      answer: "This is a placeholder answer",
      sources: result,
    });
  } catch (err) {
    console.error("❌ /chat error:", err);
    res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
