# Documind AI

Chat with your own PDFs. Each user only searches their own documents.

## How it works

1. A signed-in user (Clerk) uploads a PDF. The server queues it with BullMQ.
2. The worker splits the PDF into chunks, embeds them with Ollama (`nomic-embed-text`), and stores them in Qdrant. Each chunk carries `userId`, `documentId` and `originalName` metadata.
3. A question is answered in three steps:
   - **Metadata filter:** results are restricted to the signed-in user's chunks, and optionally to one `documentId`.
   - **Hybrid search:** dense (semantic) and sparse (keyword) search are combined with reciprocal rank fusion.
   - **Generation:** Claude Haiku answers using only the retrieved chunks, or says "I don't know".

## Stack

Next.js + Clerk (client) · Express + BullMQ (server) · Qdrant · Valkey · Ollama (embeddings) · Anthropic API (answers)

## Setup

Requires Node 22 LTS, pnpm, Docker, a Clerk app, and an Anthropic API key.

```bash
docker compose up -d                                   # Valkey :6379, Ollama :11434, Qdrant :6333
docker exec -it <ollama-container> ollama pull nomic-embed-text
cd server && pnpm install
cd ../client && pnpm install
```

**`server/.env`**
```env
QDRANT_URL=http://localhost:6333
CLERK_SECRET_KEY=...
ANTHROPIC_API_KEY=...
QDRANT_COLLECTION=rag_hybrid_v1     # use this name; the default is the old dense-only collection
# GENERATION_MODEL=claude-haiku-5-5 # optional override
# RETRIEVAL_MODE=hybrid             # dense | sparse | hybrid
```

**`client/.env.local`**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

## Run

```bash
cd server && pnpm dev          # API on http://localhost:8000
cd server && pnpm dev-worker   # ingestion worker
cd client && pnpm dev          # UI on http://localhost:3000
```

Qdrant dashboard: http://localhost:6333/dashboard

## API

Both endpoints require a Clerk bearer token.

- `POST /upload/pdf` – multipart field `pdf`. Returns the `documentId`.
- `POST /chat` – body `{ "question": "...", "documentId": "..." }` (`documentId` optional). Returns `{ answer, sources }`.

## Evals

Run from `server/`. Questions and evidence live in `evals/datasets/`.

```bash
pnpm eval:ingest <pdf...>   # ingest the eval PDFs as the eval user
pnpm eval:map               # map evidence to chunks (re-run after any re-ingest)
pnpm eval:retrieval         # hit rate / MRR for dense, sparse and hybrid
pnpm eval:isolation         # checks users never see each other's chunks
pnpm test:eval              # unit tests
pnpm eval:generation        # Claude-judged answers; costs API credits
```

### Latest results (22 questions, k=3, 2 unanswerable)

| Retrieval | hit@1 | hit@3 | hit@5 | MRR |
|---|---|---|---|---|
| dense | 45% | 75% | 90% | 0.62 |
| sparse | 75% | 100% | 100% | 0.87 |
| hybrid (default) | 55% | 95% | 100% | 0.76 |

Hybrid clearly beats dense-only. Sparse scores highest here, but the questions reuse the PDFs' wording, so it favors keyword matching.

| Generation (Haiku 5.5, judged by Haiku 5.5, hybrid retrieval) | |
|---|---|
| Correct | 75% (3 partial, 2 incorrect) |
| Faithfulness | 99% |
| False refusals | 0% |
| Abstains on unanswerable | 100% |

Partial answers mostly omit one key fact from the reference. The generation eval was run on retrieved context only.

## Notes

- Uploaded PDFs are saved to `server/uploads/` (git-ignored).
- After switching `QDRANT_COLLECTION`, re-upload your documents. Chunks in the old collection have no owner and are not returned.
