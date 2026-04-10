# Telegram Orders Bot

A Node.js Telegram bot that manages customer orders via conversational AI (Ollama LLM). Written in TypeScript.

## Features

- Conversational order management in Spanish (create, modify, cancel, query orders)
- Text and voice message support (voice transcribed via Whisper)
- Local LLM inference via Ollama — no external AI API needed
- SQLite database, scoped per Telegram user

## Setup

### 1. Create a bot

Open Telegram and message [@BotFather](https://t.me/BotFather):

```
/newbot
```

Follow the prompts. BotFather will give you an API token.

### 2. Install system dependencies

**ffmpeg** (required for voice message support):

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg
```

**Ollama** (required for AI responses) — download from [ollama.com](https://ollama.com/download), then pull the model:

```bash
ollama pull llama2:7b
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```
BOT_TOKEN=123456789:ABCDefgh...
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_MODEL=llama2:7b
WHISPER_MODEL=small
```

Available Whisper models (larger = more accurate, slower): `tiny` · `base` · `small` · `medium` · `large`

### 4. Install npm dependencies

```bash
npm install
```

### 5. Download the Whisper model

```bash
npx nodejs-whisper download
```

Select the model that matches your `WHISPER_MODEL` value (e.g. `small`). Models are stored locally and only need to be downloaded once.

### 6. Build and run

```bash
npm run build   # Compile TypeScript → dist/
npm start       # Run the compiled bot
```

For development (no build step needed):

```bash
npm run dev
```

## Project Structure

```
src/
  types.ts           # Shared types and discriminated unions
  index.ts           # Bot entry point, message handlers
  db.ts              # SQLite database layer
  agents/
    ollama.ts        # Ollama HTTP client
    intentAgent.ts   # Intent classification (LLM)
    sqlAgent.ts      # Action generation (LLM)
dist/                # Compiled output (gitignored)
tsconfig.json
.env.example
```

## Dependencies

- [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) — Telegram Bot API wrapper
- [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) — SQLite database
- [`nodejs-whisper`](https://github.com/ChetanXpro/nodejs-whisper) — Voice transcription via Whisper (whisper.cpp bindings)
- [`dotenv`](https://github.com/motdotla/dotenv) — Environment variable loader
- [`typescript`](https://www.typescriptlang.org/) + [`ts-node`](https://typestrong.org/ts-node/) — TypeScript tooling
