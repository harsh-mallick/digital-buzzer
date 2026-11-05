import { io } from 'socket.io-client'

export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', { autoConnect: false, transports: ['websocket', 'polling'] })

export function connectSocket() {
  if (!socket.connected) socket.connect()
  return socket
}
