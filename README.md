# RAG PDF Chat Application

A full-stack Retrieval-Augmented Generation (RAG) application that enables intelligent conversations with PDF documents using vector similarity search and large language models.

## Features

- **PDF Upload & Processing**: Upload PDF documents with automatic background processing
- **Intelligent Document Chunking**: Recursive character-based text splitting for optimal retrieval
- **Vector Embeddings**: Store and search document embeddings using Qdrant vector database
- **Semantic Search**: Retrieve relevant document chunks based on semantic similarity
- **Real-time Chat Interface**: Interactive chat UI to query your uploaded documents
- **Asynchronous Processing**: BullMQ job queue for scalable PDF processing
- **User Authentication**: Secure authentication powered by Clerk
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **Clerk** - Authentication and user management
- **Lucide React** - Icon library

### Backend
- **Express.js** - Web server framework
- **Node.js** - Runtime environment
- **Multer** - File upload handling
- **BullMQ** - Job queue for background processing

### RAG & AI Stack
- **LangChain** - RAG framework and orchestration
  - Core, OpenAI, Ollama, Community packages
  - Text splitters for document chunking
  - Qdrant integration for vector storage
- **Qdrant** - Vector similarity search database
- **Ollama** - Local LLM support

### Infrastructure
- **Valkey** (Redis-compatible) - Message broker
- **Docker Compose** - Service orchestration
- **pnpm** - Fast, disk space efficient package manager

## Architecture

```
┌─────────────────┐
│   Next.js UI    │
│  (Port 3000)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Express Server │
│  (Port 5000)    │
└────┬────────────┘
     │
     ├──► PDF Upload ──► BullMQ Queue
     │                      │
     │                      ▼
     │               ┌──────────────┐
     │               │ Worker Process│
     │               │  1. Load PDF │
     │               │  2. Chunk    │
     │               │  3. Embed    │
     │               │  4. Store    │
     │               └──────┬───────┘
     │                      │
     └──► Chat Query        ▼
              │      ┌─────────────┐
              └─────►│   Qdrant    │
                     │ Vector Store│
                     └─────────────┘
```

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v10.26.0 or higher)
- Docker and Docker Compose
- Clerk account (for authentication)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd rag-pdf
```

### 2. Install dependencies

```bash
# Install client dependencies
cd client
pnpm install

# Install server dependencies
cd ../server
pnpm install
```

### 3. Set up environment variables

**Client (.env.local)**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

**Server (.env)**
```env
QDRANT_URL=http://localhost:6333
```

### 4. Start Docker services

From the root directory:

```bash
docker-compose up -d
```

This will start:
- Valkey (Redis) on port 6379
- Ollama on port 11434
- Qdrant on port 6333

### 5. Pull Ollama model

```bash
docker exec -it <ollama-container-id> ollama pull llama2
```

## Running the Application

### Development Mode

**Terminal 1 - Start the server:**
```bash
cd server
pnpm dev
```

**Terminal 2 - Start the worker:**
```bash
cd server
pnpm dev-worker
```

**Terminal 3 - Start the client:**
```bash
cd client
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Qdrant UI: http://localhost:6333/dashboard

## Usage

1. **Sign In**: Authenticate using Clerk
2. **Upload PDF**: Click the upload button and select a PDF document
3. **Wait for Processing**: The PDF will be processed in the background
4. **Chat**: Ask questions about your document in the chat interface
5. **View Sources**: See relevant document chunks with page numbers and metadata

## Project Structure

```
rag-pdf/
├── client/                 # Next.js frontend
│   ├── app/               # App router pages
│   │   ├── page.tsx       # Main chat interface
│   │   ├── layout.tsx     # Root layout with auth
│   │   └── globals.css    # Global styles
│   ├── components/        # React components
│   │   └── FileUpload.tsx # PDF upload component
│   └── package.json
├── server/                # Express backend
│   ├── index.js          # API server
│   ├── worker.js         # BullMQ worker
│   ├── uploads/          # PDF storage
│   └── package.json
├── docker-compose.yml    # Infrastructure setup
└── README.md
```

## API Endpoints

### POST /upload/pdf
Upload a PDF document for processing.

**Request:**
- Content-Type: multipart/form-data
- Body: PDF file

**Response:**
```json
{
  "success": true,
  "fileName": "document.pdf"
}
```

### POST /chat
Query the uploaded documents.

**Request:**
```json
{
  "query": "What is the main topic?"
}
```

**Response:**
```json
{
  "response": "...",
  "sources": [
    {
      "content": "...",
      "metadata": {
        "page": 1,
        "pdf": {...}
      }
    }
  ]
}
```

## Configuration

### Document Chunking
- **Chunk Size**: 100 characters
- **Chunk Overlap**: 0
- **Batch Size**: 50 documents

### Vector Search
- **Collection**: langchainjs-testing
- **Top K Results**: 2
- **Embedding Model**: Ollama (configurable)

### Job Queue
- **Concurrency**: 100 workers
- **Batch Processing**: 50 documents per batch

## Development

### Running Tests
```bash
# Client
cd client
pnpm test

# Server
cd server
pnpm test
```

### Building for Production

```bash
# Client
cd client
pnpm build
pnpm start

# Server
cd server
node index.js
```

## Troubleshooting

### Docker services not starting
```bash
docker-compose down
docker-compose up -d
```

### Connection issues with Qdrant
Ensure Qdrant is running and accessible at http://localhost:6333

### File upload fails
Check that the `server/uploads` directory exists and has proper permissions

### Worker not processing jobs
Ensure Valkey (Redis) is running and accessible on port 6379

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgments

- Built with [LangChain](https://langchain.com/)
- Vector search powered by [Qdrant](https://qdrant.tech/)
- Authentication by [Clerk](https://clerk.com/)
- UI framework by [Next.js](https://nextjs.org/)

---

**Note**: This application is currently in development. Some features may be incomplete or subject to change.
