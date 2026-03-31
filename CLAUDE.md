# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install    # Install dependencies
npm start      # Run the bot (node index.js)
```

No test suite exists yet (`npm test` is a placeholder).

## Architecture

This is a Node.js Telegram bot that manages customer orders via conversational AI. It uses long-polling (not webhooks).

**Two source files:**
- `index.js` — Bot entry point, message handlers, Ollama LLM integration, voice transcription pipeline
- `db.js` — SQLite database layer (orders + order_items tables, CRUD operations)

**Message flow:**
1. Telegram message received (text or voice)
2. Voice messages: download → transcribe via `whisper` CLI → text
3. Text sent to Ollama (local LLM at `localhost:11434`) with system prompt + customer's existing orders as context
4. LLM returns JSON with an `action` field (`create_order`, `add_item`, `remove_item`, `modify_item`, `cancel_order`, `complete_order`, `list_orders`, `none`)
5. JSON parsed, database updated, response sent to user

**External dependencies (not in package.json, must be running separately):**
- Ollama (local LLM inference) — default `localhost:11434`, model `llama2:7b`
- OpenAI Whisper CLI — only needed for voice message handling

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
```

## Key Implementation Notes

- The bot is in Spanish — system prompt and all user-facing messages use Spanish
- `index.js` has a robust JSON extractor function to handle LLM outputs that include extra text around the JSON block
- The system prompt includes few-shot examples and injects the customer's current orders on every request
