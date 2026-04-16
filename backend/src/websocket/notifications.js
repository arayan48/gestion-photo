// Map userId -> Set<WebSocket>
const clients = new Map()

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
    const userId = request.user?.id
    if (!userId) {
      socket.close(4001, 'Non authentifié')
      return
    }

    registerClient(userId, socket)

    socket.on('close', () => {
      unregisterClient(userId, socket)
    })

    socket.send(JSON.stringify({ type: 'connected', message: 'WebSocket connecté' }))
  })
}
