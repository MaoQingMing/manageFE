import dayjs from 'dayjs'

export function formatTime(value?: string) {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

export function formatMoney(cents?: number) {
  const value = cents ?? 0
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return `${sign}¥${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function yuanToFen(yuan: number) {
  return Math.round(yuan * 100)
}

export function fenToYuan(fen: number) {
  return fen / 100
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function filenameFromDisposition(header: unknown, fallback: string) {
  const value = String(header || '')
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)
  if (encoded?.[1]) return decodeURIComponent(encoded[1])
  const plain = /filename="?([^"]+)"?/i.exec(value)
  return plain?.[1] || fallback
}

export function can(permissions: string[] | undefined, code: string) {
  if (!permissions) return false
  return permissions.includes('*') || permissions.includes(code)
}
