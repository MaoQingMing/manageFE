import { getAccess, useMock } from '@/api/http'
import { pushNotification, unreadCount } from '@/mock/store'

export function connectNotifications(onMessage: (message: { type: string }) => void) {
  if (useMock) {
    const timer = window.setInterval(() => {
      pushNotification({
        title: '模拟推送',
        content: '这条通知来自 Mock WebSocket，真实环境应走 /ws/notifications。',
        type: 'system',
      })
      onMessage({ type: 'notification' })
      void unreadCount()
    }, 45000)
    return () => window.clearInterval(timer)
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const base = import.meta.env.VITE_API_BASE
  const host = base ? new URL(base).host : location.host
  const socket = new WebSocket(`${protocol}://${host}/ws/notifications?token=${encodeURIComponent(getAccess())}`)
  socket.onmessage = () => onMessage({ type: 'notification' })
  const ping = window.setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }))
  }, 30000)
  return () => {
    window.clearInterval(ping)
    socket.close()
  }
}
