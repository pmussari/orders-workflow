require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const https = require('https')
const fs = require('fs')
const { exec } = require('child_process')
const path = require('path')
const os = require('os')
const db = require('./db')
const { detectIntent } = require('./agents/intentAgent')
const { generateAction } = require('./agents/sqlAgent')

const token = process.env.BOT_TOKEN
if (!token) {
  console.error('BOT_TOKEN is not set. Copy .env.example to .env and add your token.')
  process.exit(1)
}

const ollamaConfig = {
  host: process.env.OLLAMA_HOST || 'localhost',
  port: parseInt(process.env.OLLAMA_PORT || '11434'),
  model: process.env.OLLAMA_MODEL || 'llama2:7b',
}

db.initDb()

function buildOrdersContext(chatId) {
  const orders = db.getOrdersByChat(chatId)
  if (orders.length === 0) return 'No orders found for this customer.'
  return orders.map(o => {
    const itemList = o.items.length > 0
      ? o.items.map(i => `  - ${i.name} (qty: ${i.quantity})`).join('\n')
      : '  (no items)'
    return `${o.identifier} [${o.status}]\n${itemList}`
  }).join('\n\n')
}

function formatQueryRows(rows, headerMessage) {
  if (rows.length === 0) return 'No se encontraron resultados.'

  const byOrder = {}
  for (const row of rows) {
    if (row.identifier) {
      if (!byOrder[row.identifier]) byOrder[row.identifier] = { status: row.status, items: [] }
      if (row.name) byOrder[row.identifier].items.push({ name: row.name, quantity: row.quantity })
    }
  }

  if (Object.keys(byOrder).length > 0) {
    const lines = Object.entries(byOrder).map(([id, o]) => {
      const itemList = o.items.length > 0
        ? o.items.map(i => `  • ${i.name} x${i.quantity}`).join('\n')
        : '  (sin ítems)'
      return `*${id}* [${o.status}]\n${itemList}`
    })
    return `${headerMessage}\n\n${lines.join('\n\n')}`
  }

  // Fallback: generic key-value for arbitrary queries
  const lines = rows.map(row =>
    Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ')
  )
  return `${headerMessage}\n\n${lines.join('\n')}`
}

async function handleUserMessage(chatId, userText) {
  const { intent, entities } = await detectIntent(userText, ollamaConfig)
  console.log(`[intent] ${intent}`, entities)

  const parsed = await generateAction(
    intent, entities, userText, chatId, ollamaConfig,
    () => buildOrdersContext(chatId)
  )

  const { action, params, message } = parsed

  try {
    switch (action) {
      case 'create_order': {
        const { identifier } = db.createOrder(chatId, params.items || [])
        console.log(`[db] created ${identifier}`)
        break
      }
      case 'query': {
        const sql = params?.sql
        if (!sql) return 'No se proporcionó una consulta SQL.'
        console.log(`[db] query for ${chatId}: ${sql}`)
        const rows = db.executeQuery(sql, chatId)
        return formatQueryRows(rows, message)
      }
      case 'cancel_order':
        db.cancelOrder(params.identifier, chatId)
        console.log(`[db] cancelled ${params.identifier}`)
        break
      case 'complete_order':
        db.completeOrder(params.identifier, chatId)
        console.log(`[db] completed ${params.identifier}`)
        break
      case 'add_item':
        db.addItem(params.identifier, params.name, params.quantity, chatId)
        console.log(`[db] added item to ${params.identifier}`)
        break
      case 'remove_item':
        db.removeItem(params.identifier, params.name, chatId)
        console.log(`[db] removed item from ${params.identifier}`)
        break
      case 'modify_item':
        db.modifyItem(params.identifier, params.name, params.quantity, chatId)
        console.log(`[db] modified item in ${params.identifier}`)
        break
    }
  } catch (err) {
    console.error(`[db error] ${err.message}`)
    return 'No pude completar esa acción, por favor intenta de nuevo.'
  }

  return message || 'Listo, acción completada.'
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

function transcribeWithWhisper(filePath) {
  return new Promise((resolve, reject) => {
    const outDir = path.dirname(filePath)
    const cmd = `whisper "${filePath}" --model tiny --output_dir "${outDir}" --output_format txt`
    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
      const txtFile = filePath.replace(/\.[^.]+$/, '.txt')
      try {
        const transcript = fs.readFileSync(txtFile, 'utf8').trim()
        fs.unlink(txtFile, () => {})
        resolve(transcript)
      } catch {
        reject(new Error('Whisper ran but output file not found'))
      }
    })
  })
}

const bot = new TelegramBot(token, { polling: true })
console.log('Bot started. Polling for messages...')

bot.onText(/\/orders/, (msg) => {
  const chatId = msg.chat.id
  const orders = db.getOrdersByChat(chatId)
  if (orders.length === 0) return bot.sendMessage(chatId, 'No tienes pedidos aún.')
  const lines = orders.map(o => {
    const itemList = o.items.length > 0
      ? o.items.map(i => `  • ${i.name} x${i.quantity}`).join('\n')
      : '  (sin ítems)'
    return `*${o.identifier}* [${o.status}]\n${itemList}`
  }).join('\n\n')
  bot.sendMessage(chatId, lines, { parse_mode: 'Markdown' })
})

bot.on('message', async (msg) => {
  if (!msg.text) return
  const chatId = msg.chat.id
  console.log(`[text] from ${chatId}: ${msg.text}`)
  const thinking = await bot.sendMessage(chatId, 'Thinking...')
  try {
    const reply = await handleUserMessage(chatId, msg.text)
    await bot.editMessageText(reply, { chat_id: chatId, message_id: thinking.message_id })
  } catch (err) {
    console.error('Error:', err.message)
    await bot.editMessageText('Could not get a response from the AI.', { chat_id: chatId, message_id: thinking.message_id })
  }
})

bot.on('voice', async (msg) => {
  const chatId = msg.chat.id
  const fileId = msg.voice.file_id
  console.log(`[voice] from ${chatId}, file_id: ${fileId}`)
  const status = await bot.sendMessage(chatId, 'Transcribing voice...')
  const tmpFile = path.join(os.tmpdir(), `tg_voice_${fileId}.oga`)
  try {
    const url = await bot.getFileLink(fileId)
    await downloadFile(url, tmpFile)
    const transcript = await transcribeWithWhisper(tmpFile)
    console.log(`[voice] transcript: ${transcript}`)
    await bot.editMessageText('Getting AI response...', { chat_id: chatId, message_id: status.message_id })
    const reply = await handleUserMessage(chatId, transcript)
    await bot.editMessageText(`*Transcript:* ${transcript}\n\n*Response:* ${reply}`, {
      chat_id: chatId, message_id: status.message_id, parse_mode: 'Markdown',
    })
  } catch (err) {
    console.error('Voice pipeline error:', err.message)
    const errMsg = err.message.includes('whisper') || err.message.includes('Whisper')
      ? 'Could not transcribe voice message.'
      : 'Could not get a response from the AI.'
    await bot.editMessageText(errMsg, { chat_id: chatId, message_id: status.message_id })
  } finally {
    fs.unlink(tmpFile, () => {})
  }
})

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message)
})
