import { io } from 'socket.io-client'

export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  timeout: 10000,
})

export function connectSocket() {
  if (!socket.connected && !socket.active) socket.connect()
  return socket
}

export function emitWhenConnected(event, payload, acknowledgement, timeoutMs = 10000) {
  let finished = false
  let timeout
  const finish = result => {
    if (finished) return
    finished = true
    if (timeout) window.clearTimeout(timeout)
    socket.off('connect', send)
    socket.off('connect_error', onError)
    if (typeof acknowledgement === 'function') acknowledgement(result)
  }
  const send = () => socket.emit(event, payload, result => finish(result))
  const onError = () => finish({ ok: false, error: 'Realtime server unavailable. Check the server URL and try again.' })
  if (socket.connected) {
    send()
    return
  }
  timeout = window.setTimeout(() => finish({ ok: false, error: 'Connection timed out. Please try again.' }), timeoutMs)
  socket.once('connect', send)
  socket.once('connect_error', onError)
  connectSocket()
}

export function syncClock(samples = 5) {
  return new Promise(resolve => {
    const results = []
    let completed = 0
    const run = () => {
      const t0 = performance.now()
      socket.emit('clock-sync', {}, response => {
        const t3 = performance.now()
        if (response && Number.isFinite(response.serverReceiveAt) && Number.isFinite(response.serverSendAt)) {
          const serverProcessing = response.serverSendAt - response.serverReceiveAt
          const rtt = Math.max(0, (t3 - t0) - serverProcessing)
          const offset = ((response.serverReceiveAt - t0) + (response.serverSendAt - t3)) / 2
          results.push({ offset, rtt, uncertainty: rtt / 2 })
        }
        completed += 1
        if (completed >= samples) {
          if (!results.length) return resolve(null)
          results.sort((a, b) => a.rtt - b.rtt)
          const best = results.slice(0, Math.max(1, Math.ceil(results.length / 2)))
          resolve({
            offset: best.reduce((sum, item) => sum + item.offset, 0) / best.length,
            rtt: best.reduce((sum, item) => sum + item.rtt, 0) / best.length,
            uncertainty: Math.max(...best.map(item => item.uncertainty)),
          })
        } else setTimeout(run, 80)
      })
    }
    run()
  })
}
