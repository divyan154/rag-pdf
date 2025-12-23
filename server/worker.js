import { Worker } from "bullmq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { OllamaEmbeddings } from "@langchain/ollama";
import { QdrantVectorStore } from "@langchain/qdrant";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434",
});

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
    // console.log("Loaded documents:", docs[0].pageContent);

    //Chunking
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 0,
    });

    // 3️⃣ Chunk documents (CORRECT API)
    const chunks = await splitter.splitDocuments(docs);
    console.log(`Chunks created: ${chunks.length}`);

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: "http://localhost:6333",
        collectionName: "langchainjs-testing",
      }
    );

    const BATCH_SIZE = 50;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      await vectorStore.addDocuments(chunks.slice(i, i + BATCH_SIZE));
    }

    console.log("Ingestion complete, Added documents to Qdrant vector store");
  },

  { concurrency: 100, connection: { host: "localhost", port: 6379 } }
);
