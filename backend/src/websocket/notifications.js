// Map userId -> Set<WebSocket>
const clients = new Map()
const HEARTBEAT_MS = 30_000

export function registerClient(userId, ws) {
  if (!clients.has(userId)) clients.set(userId, new Set())
  clients.get(userId).add(ws)
}

export function unregisterClient(userId, ws) {
  const set = clients.get(userId)
  if (!set) return
  set.delete(ws)
  if (set.size === 0) clients.delete(userId)
}

export function sendToUser(userId, payload) {
  const set = clients.get(userId)
  if (!set) return
  const data = JSON.stringify(payload)
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(data)
  }
}

export function broadcast(payload) {
  const data = JSON.stringify(payload)
  for (const [, set] of clients) {
    for (const ws of set) {
      if (ws.readyState === 1) ws.send(data)
    }
  }
}

export function registerWebsocketRoutes(fastify) {
  fastify.get('/ws', { websocket: true }, (socket, request) => {
    const userId = request.currentUser?.id
    if (!userId) {
      socket.close(4001, 'Non authentifié')
      return
    }

    registerClient(userId, socket)

    // Ping régulier : les proxys (Traefik, Cloudflare…) coupent les connexions muettes,
    // et une connexion morte (mobile en veille) est détectée puis libérée
    let alive = true
    socket.on('pong', () => { alive = true })
    const heartbeat = setInterval(() => {
      if (!alive) return socket.terminate()
      alive = false
      socket.ping()
    }, HEARTBEAT_MS)

    socket.on('close', () => {
      clearInterval(heartbeat)
      unregisterClient(userId, socket)
    })

    socket.send(JSON.stringify({ type: 'connected', message: 'WebSocket connecté' }))
  })
}
