import { Spin } from 'antd'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/api/client'
import { clearTokens, getAccess, getRefresh, setAuthLostHandler, setTokens } from '@/api/http'
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

  const refreshMe = async () => {
    const me = await api.me()
    setUser(me)
  }

  useEffect(() => {
    setAuthLostHandler(() => {
      clearTokens()
      setUser(null)
      if (!location.pathname.startsWith('/login')) location.assign('/login')
    })
    if (!getAccess()) {
      setReady(true)
      return
    }
    api
      .me()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setReady(true))
  }, [])

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
    [user, ready],
  )

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
