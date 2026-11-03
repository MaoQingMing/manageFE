import { Button, Result, Space, Spin } from 'antd'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, restoreAuthUser } from '@/api/client'
import { clearTokens, getRefresh, isAuthFailure, setAuthLostHandler, setTokens } from '@/api/http'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  ready: boolean
  login: (payload: { username: string; password: string; captchaId: string; captchaCode: string }) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [initialError, setInitialError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const refreshMe = useCallback(async () => {
    const me = await api.me()
    setUser(me)
  }, [])

  useEffect(() => {
    setAuthLostHandler(() => {
      setUser(null)
      setInitialError('')
      setReady(true)
    })
    return () => setAuthLostHandler(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setInitialError('')
    const restore = async () => {
      try {
        const me = await restoreAuthUser()
        if (!cancelled) {
          setUser(me)
          setReady(true)
        }
      } catch (error) {
        if (cancelled) return
        if (isAuthFailure(error)) {
          clearTokens()
          setUser(null)
          setReady(true)
        } else {
          setInitialError(error instanceof Error ? error.message : '会话加载失败')
        }
      }
    }
    void restore()
    return () => { cancelled = true }
  }, [attempt])

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      refreshMe,
      login: async (payload) => {
        const result = await api.login(payload)
        setTokens(result.accessToken, result.refreshToken)
        setUser(result.user)
      },
      logout: async () => {
        const refreshToken = getRefresh()
        try {
          if (refreshToken) await api.logout(refreshToken)
        } finally {
          clearTokens()
          setUser(null)
        }
      },
    }),
    [user, ready, refreshMe],
  )

  if (initialError) {
    return <Result status="warning" title="暂时无法恢复会话，登录凭证已保留" subTitle={initialError} extra={
      <Space>
        <Button type="primary" onClick={() => setAttempt((value) => value + 1)}>重试</Button>
        <Button onClick={() => { clearTokens(); setUser(null); setInitialError(''); setReady(true) }}>清除会话并重新登录</Button>
      </Space>
    } />
  }

  if (!ready) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <Spin />
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider 缺失')
  return value
}
