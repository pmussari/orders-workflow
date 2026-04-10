# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript → dist/
npm start          # Run the compiled bot (node dist/index.js)
npm run dev        # Run directly with ts-node (no build step)
```

No test suite exists yet (`npm test` is a placeholder).

## Architecture

This is a Node.js Telegram bot that manages customer orders via conversational AI. It uses long-polling (not webhooks). All source files are TypeScript under `src/`, compiled to `dist/` by `tsc`.

**Source layout:**
```
src/
  types.ts               — Shared types, interfaces, and discriminated unions
  index.ts               — Bot entry point, message handlers, voice transcription pipeline
  db.ts                  — SQLite database layer (orders + order_items tables, CRUD operations)
  agents/
    ollama.ts            — HTTP client for Ollama LLM API
    intentAgent.ts       — Intent classification agent (LLM → IntentResult)
    sqlAgent.ts          — Action generation agent (intent → OrderAction)
dist/                    — Compiled output (gitignored)
```

**Message flow:**
1. Telegram message received (text or voice)
2. Voice messages: download → transcribe via `whisper` CLI → text
3. `detectIntent()` calls Ollama to classify the intent + extract entities
4. `generateAction()` calls Ollama to translate intent → `OrderAction` (discriminated union)
5. Action dispatched in a typed switch, database updated, response sent to user

**External dependencies (not in package.json, must be running separately):**
- Ollama (local LLM inference) — default `localhost:11434`, model `llama2:7b`
- `ffmpeg` — required by `nodejs-whisper` to handle `.oga` voice files from Telegram
- A downloaded Whisper model — run `npx nodejs-whisper download` to fetch it

**Database schema (SQLite, `orders.db`):**
- `orders`: id, identifier (ORDEN-001...), chat_id, status (active/cancelled/completed), created_at
- `order_items`: id, order_id (FK), name, quantity

All orders are scoped by `chat_id` (Telegram user ID) for multi-user isolation.

## Configuration

Copy `.env.example` to `.env` and set:
```
BOT_TOKEN=<required — get from @BotFather>
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_MODEL=llama2:7b
WHISPER_MODEL=small   # tiny | base | small | medium | large-v1 | large (default: small)
```

## Key Implementation Notes

- The bot is in Spanish — system prompt and all user-facing messages use Spanish
- LLM responses are extracted from raw text by `extractJson()` (handles extra text around the JSON block)
- The system prompt includes few-shot examples and injects the customer's current orders on every request
- `OrderAction` in `src/types.ts` is a discriminated union; the switch in `src/index.ts` has a `never` exhaustiveness check
- TypeScript strict mode is enabled (`tsconfig.json`) — no `any`, all errors are type errors
