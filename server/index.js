import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import multer from "multer";
import cors from "cors";
import { Queue } from "bullmq";
import { verifyToken } from "@clerk/backend";
import { retrieve, DEFAULT_K } from "./retrieval.js";
import { buildContext, generateAnswer } from "./generation.js";
import { connection } from "./config/redis.js";
import "./worker.js"; // runs the ingestion worker in this process

const app = express();

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    if (!payload.sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.userId = payload.sub;
    next();
  } catch (err) {
    console.error("Auth failed:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

app.use(express.json());

const queue = new Queue("ProcessPdfQueue", { connection });
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? true }));
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
  res.send("Hello from Rag serverr");
});

app.post("/upload/pdf", requireAuth, upload.single("pdf"), async (req, res) => {
  const documentId = randomUUID();

  await queue.add("pdf-process", {
    name: req.file.originalname,
    path: req.file.path,
    destination: req.file.destination,
    userId: req.userId,
    documentId,
  });

  res.send({ message: "File uploaded successfully", documentId, file: req.file });
});

app.post("/chat", requireAuth, async (req, res) => {
  try {
    console.log("Received /chat request with body:", req.body);
    const userQuery = req.body.question;
    const retrieved = await retrieve(userQuery, DEFAULT_K, {
      userId: req.userId,
      documentId: req.body.documentId,
    });
    const result = retrieved.map((r) => r.doc);

    console.log("Retrieved results:", result);

    console.log("📚 CONTEXT SENT TO LLM:\n", buildContext(result));

    const answer = await generateAnswer(userQuery, result);
    console.log(answer);
    res.status(200).json({
      answer,
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
