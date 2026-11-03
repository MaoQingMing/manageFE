import { message } from 'antd'
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { loginPath } from '@/authNavigation'
import { handleMock } from '@/mock/server'

const ACCESS = 'managefe_access'
const REFRESH = 'managefe_refresh'

export const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

export function getAccess() {
  return localStorage.getItem(ACCESS) || ''
}

export function getRefresh() {
  return localStorage.getItem(REFRESH) || ''
}

let authLost = false

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS, accessToken)
  localStorage.setItem(REFRESH, refreshToken)
  authLost = false
}

export function clearTokens() {
  localStorage.removeItem(ACCESS)
  localStorage.removeItem(REFRESH)
}

export function expireAccessLocally() {
  if (!useMock) throw new Error('真实 BE 请使用短有效期 Access Token，不能修改 JWT 来模拟过期')
  const [kind, id] = getAccess().split('.')
  if (kind !== 'access' || !id) throw new Error('请先登录 Mock 账号')
  localStorage.setItem(ACCESS, `${kind}.${id}.1`)
}

export interface ApiLog {
  id: number
  time: string
  method: string
  url: string
  status: number
  code?: number
  ms: number
}

const logs: ApiLog[] = []
const listeners = new Set<() => void>()
let logSeq = 1

export function getLogs() {
  return logs
}

export function subscribeLogs(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function pushLog(entry: Omit<ApiLog, 'id' | 'time'>) {
  logs.unshift({ ...entry, id: logSeq, time: new Date().toLocaleTimeString() })
  logSeq += 1
  logs.splice(40)
  listeners.forEach((listener) => listener())
}

const defaultAuthLostHandler = () => location.assign(loginPath())
let onAuthLost = defaultAuthLostHandler

export function setAuthLostHandler(handler: (() => void) | null) {
  onAuthLost = handler || defaultAuthLostHandler
}

function loseAuth() {
  if (authLost) return
  authLost = true
  clearTokens()
  onAuthLost()
}

export function isAuthFailure(error: unknown) {
  const failure = error as { code?: number; status?: number }
  return failure?.code === 40100 || failure?.code === 40101 || failure?.code === 40301 || failure?.status === 401
}

function isPublicAuthRequest(url = '') {
  return /\/auth\/(captcha|login|refresh|logout)(?:[?#]|$)/.test(url)
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
  timeout: 20000,
})

if (useMock) {
  http.defaults.adapter = (config) => handleMock(config)
}

http.interceptors.request.use((config) => {
  config.__startedAt = Date.now()
  const token = getAccess()
  config.__accessToken = token
  if (token && !isPublicAuthRequest(config.url)) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing: Promise<string> | null = null

export async function refreshAccess() {
  if (!refreshing) {
    const refreshToken = getRefresh()
    if (!refreshToken) {
      loseAuth()
      throw Object.assign(new Error('登录已失效，请重新登录'), { code: 40100 })
    }
    refreshing = http
      .post('/api/v1/auth/refresh', { refreshToken }, { skipErrorToast: true })
      .then((res) => {
        if (getRefresh() !== refreshToken) throw new Error('会话已变更，忽略旧会话的续期结果')
        const data = res.data.data as { accessToken: string; refreshToken: string }
        setTokens(data.accessToken, data.refreshToken)
        return data.accessToken
      })
      .catch((error: unknown) => {
        if (getRefresh() === refreshToken && isAuthFailure(error)) loseAuth()
        throw error
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

interface ResponseBody {
  code?: number
  message?: string
  data?: unknown
  traceId?: string
}

async function bodyOfResponse(response: AxiosResponse): Promise<ResponseBody | null> {
  let body: unknown = response.data
  if (body instanceof Blob) {
    if (!body.type.includes('json')) return null
    try {
      body = JSON.parse(await body.text())
    } catch {
      return null
    }
  }
  return body && typeof body === 'object' && 'code' in body ? body as ResponseBody : null
}

function logResponse(response: AxiosResponse, code?: number) {
  const config = response.config
  pushLog({
    method: (config.method || 'get').toUpperCase(),
    url: config.url || '',
    status: response.status,
    code,
    ms: Date.now() - (config.__startedAt || Date.now()),
  })
}

async function handleResponse(response: AxiosResponse) {
  const body = await bodyOfResponse(response)
  logResponse(response, body?.code)
  if (response.status < 400 && (!body || body.code === 0)) return response

  const config = response.config
  const failure = Object.assign(new Error(body?.message || `请求失败（HTTP ${response.status}）`), {
    code: body?.code,
    status: response.status,
    traceId: body?.traceId,
    config,
    response,
  })
  const protectedRequest = !isPublicAuthRequest(config.url)
  if (protectedRequest && body?.code === 40101 && !config.__retry && getRefresh()) {
    let token: string
    try {
      // 延迟到达的旧 Token 请求复用已经完成的续期结果。
      token = getAccess() && getAccess() !== config.__accessToken ? getAccess() : await refreshAccess()
    } catch (error) {
      if (!config.skipErrorToast) message.error(error instanceof Error ? error.message : '续期失败，请重试')
      throw error
    }
    config.__retry = true
    config.headers.Authorization = `Bearer ${token}`
    return http.request(config)
  }
  if (protectedRequest && isAuthFailure(failure)) loseAuth()
  if (!config.skipErrorToast) message.error(failure.message)
  throw failure
}

http.interceptors.response.use(handleResponse, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response) return handleResponse(error.response)
  if (axios.isCancel(error)) return Promise.reject(error)
  const config = axios.isAxiosError(error) ? error.config : undefined
  pushLog({
    method: (config?.method || 'get').toUpperCase(),
    url: config?.url || '',
    status: 0,
    ms: Date.now() - (config?.__startedAt || Date.now()),
  })
  if (!config?.skipErrorToast) message.error(error instanceof Error ? error.message : '网络错误')
  return Promise.reject(error)
})

export async function unwrap<T>(config: InternalAxiosRequestConfig | Promise<{ data: { data: T } }>): Promise<T> {
  const response = await (config instanceof Promise ? config : http.request(config))
  return response.data.data
}
