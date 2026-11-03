import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { takeAuthFault } from './auth.faults'
import { authRoutes } from './auth.routes'
import type { MockCtx, Route } from './context'
import { contentRoutes } from './content.routes'
import { dashboardRoutes } from './dashboard.routes'
import { catalogRoutes } from './catalog.routes'
import { MockError, accountDisabled, can, expired, redact, unauthorized, uuid } from './kit'
import { db, permissionsOf, writeAudit } from './store'
import { systemRoutes } from './system.routes'
import { tradeRoutes } from './trade.routes'

const routes: Route[] = [
  ...authRoutes,
  ...systemRoutes,
  ...catalogRoutes,
  ...tradeRoutes,
  ...contentRoutes,
  ...dashboardRoutes,
].sort((a, b) => specificity(b.pattern) - specificity(a.pattern) || b.pattern.length - a.pattern.length)

function specificity(pattern: string) {
  const segments = pattern.split('/').filter(Boolean)
  const params = segments.filter((item) => item.startsWith(':')).length
  return (segments.length - params) * 10 - params
}

function match(pattern: string, path: string) {
  const expected = pattern.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  if (expected.length !== actual.length) return null
  const params: Record<string, string> = {}
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index].startsWith(':')) params[expected[index].slice(1)] = decodeURIComponent(actual[index])
    else if (expected[index] !== actual[index]) return null
  }
  return params
}

function readPath(config: InternalAxiosRequestConfig) {
  const raw = config.url || ''
  if (raw.startsWith('http')) return new URL(raw).pathname
  return raw.split('?')[0]
}

function readQuery(config: InternalAxiosRequestConfig) {
  const query: Record<string, string> = {}
  const raw = config.url || ''
  const search = raw.startsWith('http') ? new URL(raw).search : raw.includes('?') ? `?${raw.split('?')[1]}` : ''
  new URLSearchParams(search).forEach((value, key) => {
    query[key] = value
  })
  Object.entries(config.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query[key] = String(value)
  })
  return query
}

function readHeaders(config: InternalAxiosRequestConfig) {
  const headers: Record<string, string> = {}
  const source = config.headers
  if (!source) return headers
  if (typeof (source as { toJSON?: () => Record<string, string> }).toJSON === 'function') {
    Object.entries((source as { toJSON: () => Record<string, unknown> }).toJSON()).forEach(([key, value]) => {
      if (value !== undefined && value !== null) headers[key.toLowerCase()] = String(value)
    })
  }
  return headers
}

async function readBody(config: InternalAxiosRequestConfig) {
  const data = config.data
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return data
    }
  }
  return data
}

function bearerUser(token: string) {
  const [kind, id, exp] = token.split('.')
  if (kind !== 'access' || !id || !exp) return null
  if (Number(exp) < Date.now() / 1000) return 'expired' as const
  return db.users.find((item) => item.id === Number(id) && !item.deletedAt) || null
}

function traceId() {
  return uuid().replace(/-/g, '').slice(0, 16)
}

export async function handleMock(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  await new Promise((resolve) => setTimeout(resolve, 80))
  const trace = traceId()
  const path = readPath(config)
  const fault = takeAuthFault(path)
  if (fault === 'network') throw new AxiosError('模拟网络不可用，请重试', 'ERR_NETWORK', config)
  const method = (config.method || 'get').toUpperCase()
  const ctx: MockCtx = {
    method,
    path,
    query: readQuery(config),
    body: await readBody(config),
    params: {},
    headers: readHeaders(config),
    user: null,
    operator: '-',
  }
  const route = routes.find((item) => item.method === method && match(item.pattern, path))
  try {
    if (fault === 'server') throw new MockError(500, 50000, '模拟服务暂不可用，请重试')
    if (!route) throw new MockError(404, 40400, `没有这个接口 ${method} ${path}`)
    ctx.params = match(route.pattern, path) || {}
    const token = (ctx.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (route.auth) {
      if (!token) throw unauthorized()
      const user = bearerUser(token)
      if (user === 'expired') throw expired()
      if (!user) throw unauthorized()
      if (user.status !== 1) throw accountDisabled()
      ctx.user = user
      ctx.operator = user.username
    }
    if (route.perm) {
      if (!ctx.user) throw unauthorized()
      if (!can(permissionsOf(ctx.user), route.perm)) throw new MockError(403, 40300, '没有权限')
    }
    const result = await route.handle(ctx)
    audit(ctx, 200)
    if (result && typeof result === 'object' && '__file' in result) {
      const file = result as unknown as { blob: Blob; headers: Record<string, string> }
      return { data: file.blob, status: 200, statusText: 'OK', headers: file.headers, config }
    }
    if (result && typeof result === 'object' && '__headers' in result) {
      const wrapped = result as { data: unknown; __headers: Record<string, string> }
      return {
        data: { code: 0, message: 'ok', data: wrapped.data, traceId: trace },
        status: 200,
        statusText: 'OK',
        headers: wrapped.__headers,
        config,
      }
    }
    return { data: { code: 0, message: 'ok', data: result ?? {}, traceId: trace }, status: 200, statusText: 'OK', headers: {}, config }
  } catch (error) {
    const mock = error instanceof MockError ? error : new MockError(500, 50000, error instanceof Error ? error.message : '服务器错误')
    audit(ctx, mock.status, mock.message)
    return {
      data: { code: mock.code, message: mock.message, data: null, traceId: trace },
      status: mock.status,
      statusText: mock.message,
      headers: {},
      config,
    }
  }
}

function audit(ctx: MockCtx, status: number, message?: string) {
  if (ctx.method === 'GET' || ctx.path.includes('/chunks/') || ctx.path.endsWith('/auth/captcha') || ctx.path.endsWith('/auth/refresh')) return
  writeAudit({
    operator: ctx.operator,
    action: ctx.method,
    resource: ctx.path.split('/')[3] || '',
    method: ctx.method,
    path: ctx.path,
    status,
    detail: message || redact(ctx.body),
  })
}
