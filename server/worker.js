import "dotenv/config";
import { Worker } from "bullmq";

import { ingestPdf } from "./ingest.js";

const worker = new Worker(
  "ProcessPdfQueue",
  async (job) => {
    try {
      console.log("Processing job:", job.data);
      const { path, name, userId, documentId } = job.data;

      const result = await ingestPdf({ path, originalName: name, userId, documentId });
      console.log(
        `Ingestion complete: ${result.chunks} chunks for document ${result.documentId}`,
      );
    } catch (e) {
      console.error("Handler error:", e);
      throw e;
    }
  },
  { concurrency: 100, connection: { host: "localhost", port: 6379 } },
);

worker.on("failed", (job, err) => {
  console.error("Job failed:", job?.id, err);
});
worker.on("error", (err) => {
  console.error("Worker error:", err);
});
