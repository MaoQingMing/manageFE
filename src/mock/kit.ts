export class MockError extends Error {
  status: number
  code: number

  constructor(status: number, code: number, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const invalid = (message: string) => new MockError(400, 40001, message)
export const unauthorized = (message = '未登录') => new MockError(401, 40100, message)
export const expired = () => new MockError(401, 40101, '登录已过期')
export const denied = (message = '没有权限') => new MockError(403, 40300, message)
export const accountDisabled = () => new MockError(403, 40301, '账号已禁用')
export const notFound = (message = '资源不存在') => new MockError(404, 40400, message)
export const versionConflict = () => new MockError(409, 40900, '数据已被他人修改，请刷新后重试')
export const illegalState = (message = '当前状态不允许该操作') => new MockError(409, 40901, message)
export const conflict = (message: string) => new MockError(409, 40902, message)

export function nowIso() {
  return new Date().toISOString()
}

export function uuid() {
  const cryptoObj = globalThis.crypto
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID()
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

export function daysAgo(days: number, hours = 0) {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString()
}

export function num(value: string | undefined, name: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw invalid(`${name} 非法`)
  return parsed
}

export function optionalNum(value: string | undefined) {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) throw invalid('数字参数非法')
  return parsed
}

export function text(value: unknown, name: string, max = 200) {
  const str = String(value ?? '').trim()
  if (!str) throw invalid(`${name}不能为空`)
  if (str.length > max) throw invalid(`${name}最长 ${max} 个字符`)
  return str
}

export function pageOf<T>(list: T[], query: Record<string, string>) {
  const page = Math.max(1, Number(query.page) || 1)
  let pageSize = Number(query.pageSize) || 10
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 10
  if (pageSize > 100) pageSize = 100
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length, page, pageSize }
}

export function sortBy<T>(list: T[], field?: string, order?: string) {
  if (!field) return list
  const dir = order === 'descend' ? -1 : 1
  return [...list].sort((a, b) => {
    const left = (a as Record<string, unknown>)[field]
    const right = (b as Record<string, unknown>)[field]
    if (left === right) return 0
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * dir
    return String(left ?? '').localeCompare(String(right ?? '')) * dir
  })
}

export function includes(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase())
}

export function toTree<T extends { id: number; parentId: number; sort?: number }>(list: T[]) {
  type Node = T & { children?: Node[] }
  const nodes: Node[] = list.map((item) => ({ ...item }))
  const map = new Map(nodes.map((item) => [item.id, item]))
  const roots: Node[] = []
  nodes.forEach((node) => {
    const parent = node.parentId ? map.get(node.parentId) : undefined
    if (parent) {
      parent.children = parent.children || []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortRec = (arr: Node[]) => {
    arr.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
    arr.forEach((item) => item.children && sortRec(item.children))
  }
  sortRec(roots)
  return roots
}

export function isDescendant(list: { id: number; parentId: number }[], id: number, parentId: number) {
  const map = new Map(list.map((item) => [item.id, item.parentId]))
  let current = parentId
  const guard = new Set<number>()
  while (current) {
    if (current === id) return true
    if (guard.has(current)) return false
    guard.add(current)
    current = map.get(current) || 0
  }
  return false
}

export function csv(rows: string[][]) {
  const body = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  return new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' })
}

export function encodeCursor(createdAt: string, id: number) {
  return btoa(JSON.stringify({ createdAt, id }))
}

export function decodeCursor(cursor: string) {
  try {
    const parsed = JSON.parse(atob(cursor)) as { createdAt?: string; id?: number }
    if (!parsed.createdAt || typeof parsed.id !== 'number') throw new Error('bad')
    return { createdAt: parsed.createdAt, id: parsed.id }
  } catch {
    throw invalid('cursor 非法')
  }
}

export function can(permissions: string[], code?: string) {
  if (!code) return true
  return permissions.includes('*') || permissions.includes(code)
}

export function redact(body: unknown) {
  if (!body || typeof body !== 'object' || body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
    return ''
  }
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) }
  ;['password', 'oldPassword', 'newPassword', 'captchaCode', 'refreshToken'].forEach((key) => {
    if (key in clone) clone[key] = '***'
  })
  const textValue = JSON.stringify(clone)
  return textValue.length > 800 ? `${textValue.slice(0, 800)}…` : textValue
}

export function svgData(label: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="54%" fill="white" font-size="18" font-family="sans-serif" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function captchaImage(code: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#eef2f6"/><path d="M4 28 C 30 8, 70 36, 116 12" stroke="#94a3b8" fill="none"/><text x="14" y="27" font-size="22" font-family="monospace" letter-spacing="5" fill="#0f172a">${code}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
