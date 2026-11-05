import { io } from 'socket.io-client'

export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', { autoConnect: false, transports: ['websocket', 'polling'] })

export function connectSocket() {
  if (!socket.connected && !socket.active) socket.connect()
  return socket
}

export function emitWhenConnected(event, payload, acknowledgement) {
  const send = () => socket.emit(event, payload, acknowledgement)
  if (socket.connected) send()
  else {
    let finished = false
    const finish = result => { if (finished) return; finished = true; window.clearTimeout(timeout); socket.off('connect', send); socket.off('connect_error', onError); acknowledgement(result) }
    const onError = () => finish({ ok: false, error: 'Realtime server unavailable. Start the BUZZR server and try again.' })
    const sendOnce = () => { if (finished) return; socket.emit(event, payload, result => finish(result)) }
    const timeout = window.setTimeout(() => finish({ ok: false, error: 'Connection timed out. Check the realtime server URL.' }), 7000)
    socket.once('connect', sendOnce)
    socket.once('connect_error', onError)
  }
}
