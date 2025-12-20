import { Worker } from "bullmq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

const worker = new Worker(
  "ProcessPdfQueue",
  async (job) => {
    console.log("Processing job:", job.data);
    const data = job.data;

    /*
Read Pdf From UPloads
Convert it into chunks
Generate embeddings for each chunk
Store embeddings in vector database
*/

    //load PDF
    // console.log("pdf path:", data);
    const loader = new PDFLoader(data.path);
    console.log("Loading PDF from path....");
    const docs = await loader.load();
    console.log("Loaded documents:", docs);
  },
  { concurrency: 100, connection: { host: "localhost", port: 6379 } }
);
