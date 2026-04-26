import { useEffect, useRef, useState } from 'react'
import { getToken } from '../api/auth'

const BASE_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/status'

function buildWsUrl() {
  const token = getToken()
  return token ? `${BASE_WS_URL}?token=${token}` : null
}

export function useWebSocket() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('connecting')
  const wsRef = useRef(null)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    function connect() {
      if (!mountedRef.current) return
      const url = buildWsUrl()
      if (!url) {
        setStatus('disconnected')
        return
      }
      setStatus('connecting')
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (mountedRef.current) setStatus('connected')
      }

      ws.onmessage = (e) => {
        if (!mountedRef.current) return
        try { setData(JSON.parse(e.data)) } catch {}
      }

      ws.onclose = (e) => {
        if (mountedRef.current) {
          setStatus('disconnected')
          // Si el servidor tanca per token invàlid (1008), no reintentar
          if (e.code !== 1008) {
            timerRef.current = setTimeout(connect, 4000)
          }
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [])

  return { data, status }
}
