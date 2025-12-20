import { Worker } from "bullmq";
const worker = new Worker(
  "ProcessPdfQueue",
  async (job) => {
    console.log("Processing job:", job.data);
  },
  { concurrency: 100, connection: { host: "localhost", port: 6379 } }
);
