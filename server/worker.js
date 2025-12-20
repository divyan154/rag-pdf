import { Worker } from "bullmq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { OllamaEmbeddings } from "@langchain/ollama";
import { QdrantVectorStore } from "@langchain/qdrant";

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
    // console.log("Loading PDF from path....");
    const docs = await loader.load();
    // console.log("Loaded documents:", docs);

    //Generate Embeddings
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
    await vectorStore.addDocuments(docs);
    console.log("Added documents to Qdrant vector store");
  },

  { concurrency: 100, connection: { host: "localhost", port: 6379 } }
);
