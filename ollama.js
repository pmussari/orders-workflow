const http = require('http')

function callOllama(messages, { host, port, model }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, stream: false, messages })
    const req = http.request(
      {
        host, port, path: '/api/chat', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed.message?.content || '(no response)')
          } catch {
            reject(new Error('Failed to parse Ollama response'))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

module.exports = { callOllama }
