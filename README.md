# Telegram Bot

A simple Node.js Telegram bot that polls for messages and handles text and voice input.

## Features

- Polls Telegram for new messages using long polling
- Echoes back text messages
- Replies with a download link for voice messages

## Setup

### 1. Create a bot

Open Telegram and message [@BotFather](https://t.me/BotFather):

```
/newbot
```

Follow the prompts to name your bot. BotFather will give you an API token.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your token:

```
BOT_TOKEN=123456789:ABCDefgh...
```

### 3. Install dependencies

```bash
npm install
```

### 4. Run

```bash
npm start
```

The bot will start polling and log incoming messages to stdout.

## Usage

| Input | Bot Response |
|-------|-------------|
| Text message | `You said: <your text>` |
| Voice message | `Voice received! Download: <url>` |

## Project Structure

```
telegram/
├── index.js        # Bot entry point
├── package.json
├── .env            # Your bot token (not committed)
└── .env.example    # Token template
```

## Dependencies

- [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) — Telegram Bot API wrapper
- [`dotenv`](https://github.com/motdotla/dotenv) — Environment variable loader
