import { message } from 'antd'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
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

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS, accessToken)
  localStorage.setItem(REFRESH, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS)
  localStorage.removeItem(REFRESH)
}

export function expireAccessLocally() {
  const token = getAccess()
  const [kind, id] = token.split('.')
  if (kind && id) localStorage.setItem(ACCESS, `${kind}.${id}.1`)
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

let onAuthLost = () => {
  clearTokens()
  if (!location.pathname.startsWith('/login')) location.assign('/login')
}

export function setAuthLostHandler(handler: () => void) {
  onAuthLost = handler
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
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing: Promise<string> | null = null

async function refreshAccess() {
  if (!refreshing) {
    refreshing = http
      .post('/api/v1/auth/refresh', { refreshToken: getRefresh() }, { skipErrorToast: true })
      .then((res) => {
        const data = res.data.data as { accessToken: string; refreshToken: string }
        setTokens(data.accessToken, data.refreshToken)
        return data.accessToken
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

http.interceptors.response.use(
  async (response) => {
    const config = response.config
    const started = config.__startedAt || Date.now()
    if (config.responseType === 'blob' && response.data instanceof Blob) {
      pushLog({ method: (config.method || 'get').toUpperCase(), url: config.url || '', status: response.status, ms: Date.now() - started })
      return response
    }
    const body = response.data as { code?: number; message?: string; data?: unknown }
    if (!body || typeof body !== 'object' || !('code' in body)) return response
    if (body.code === 0) {
      pushLog({ method: (config.method || 'get').toUpperCase(), url: config.url || '', status: response.status, code: 0, ms: Date.now() - started })
      return response
    }
    const url = config.url || ''
    const canRefresh = (body.code === 40100 || body.code === 40101) && !config.__retry && !url.includes('/auth/login') && !url.includes('/auth/refresh') && getRefresh()
    if (canRefresh) {
      try {
        const token = await refreshAccess()
        config.__retry = true
        config.headers.Authorization = `Bearer ${token}`
        return http.request(config)
      } catch {
        onAuthLost()
      }
    }
    pushLog({ method: (config.method || 'get').toUpperCase(), url, status: response.status, code: body.code, ms: Date.now() - started })
    if (!config.skipErrorToast) message.error(body.message || '请求失败')
    return Promise.reject(Object.assign(new Error(body.message || '请求失败'), { code: body.code, config }))
  },
  (error: AxiosError) => {
    if (!error.config?.skipErrorToast) message.error(error.message || '网络错误')
    return Promise.reject(error)
  },
)

export async function unwrap<T>(config: InternalAxiosRequestConfig | Promise<{ data: { data: T } }>): Promise<T> {
  const response = await (config instanceof Promise ? config : http.request(config))
  return response.data.data
}
