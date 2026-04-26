// Client WebSocket amb reconnexió automàtica
// TODO: implementar reconnexió amb backoff i callbacks d'estat

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/status'

export function createWsClient(onMessage) {
  let ws = null
  let reconnectTimeout = null

  function connect() {
    ws = new WebSocket(WS_URL)

    ws.onmessage = (event) => onMessage(JSON.parse(event.data))

    ws.onclose = () => {
      reconnectTimeout = setTimeout(connect, 3000)
    }
  }

  function disconnect() {
    clearTimeout(reconnectTimeout)
    ws?.close()
  }

  connect()
  return { disconnect }
}
