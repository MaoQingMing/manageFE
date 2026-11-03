import type { DbUser } from './store'

export interface MockCtx {
  method: string
  path: string
  query: Record<string, string>
  body: unknown
  params: Record<string, string>
  headers: Record<string, string>
  user: DbUser | null
  operator: string
}

export interface Route {
  method: string
  pattern: string
  auth: boolean
  perm?: string
  handle: (ctx: MockCtx) => unknown | Promise<unknown>
}

export function fileResult(blob: Blob, filename: string, contentType: string) {
  return {
    __file: true as const,
    blob,
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  }
}

export function withHeaders(data: unknown, headers: Record<string, string>) {
  return { __headers: headers, data }
}

export function header(ctx: MockCtx, name: string) {
  return ctx.headers[name.toLowerCase()] || ''
}

export function bodyOf(ctx: MockCtx) {
  return (ctx.body || {}) as Record<string, unknown>
}
