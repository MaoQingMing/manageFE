import { Alert, Button, Card, Space } from 'antd'
import { useState } from 'react'
import { api } from '@/api/client'
import { expireAccessLocally, getAccess, getLogs, getRefresh, http, refreshAccess, useMock } from '@/api/http'
import { useAuth } from '@/auth'
import { failNextAuthRequest } from '@/mock/auth.faults'
import { expireMockRefresh } from '@/mock/auth.practice'

export function AuthPractice() {
  const { refreshMe } = useAuth()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [failed, setFailed] = useState(false)

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setResult('')
    setFailed(false)
    try {
      setResult(await action())
    } catch (error) {
      setFailed(true)
      setResult(error instanceof Error ? error.message : '练习失败')
    } finally {
      setBusy(false)
    }
  }

  const transientFailure = async (target: 'me' | 'refresh', fault: 'network' | 'server') => {
    const refreshToken = getRefresh()
    failNextAuthRequest(target, fault)
    if (target === 'refresh') expireAccessLocally()
    try {
      await api.me(true)
    } catch (error) {
      const failure = error as { code?: number | string }
      if (failure.code !== (fault === 'server' ? 50000 : 'ERR_NETWORK')) throw error
      if (getRefresh() !== refreshToken || !getAccess()) throw new Error('异常请求不应清除登录态')
      await refreshMe()
      return '首次请求失败但登录凭证保留；重试已成功，无需重新登录'
    }
    throw new Error('未触发预期的临时故障')
  }

  return <Card title="认证练习" style={{ marginTop: 16 }}>
    <Alert type="info" showIcon message={useMock
      ? '仅修改当前页面的 Mock 内存，不新增 BE 接口。刷新页面会重置 Mock 数据；多个标签页不共享 Mock 会话。Refresh 过期练习会退出登录。'
      : '真实 BE 模式不修改 JWT。请配置短有效期 Access Token，验证过期续期；并发、轮换复用和故障练习步骤见 README。'} style={{ marginBottom: 16 }} />
    {useMock && <Space wrap>
      <Button disabled={busy} onClick={() => void run(async () => { expireAccessLocally(); await refreshMe(); return 'Access Token 过期后已自动续期并重放请求' })}>模拟 Access Token 过期</Button>
      <Button disabled={busy} onClick={() => void run(async () => {
        const firstId = (getLogs()[0]?.id || 0) + 1
        expireAccessLocally()
        await Promise.all([refreshMe(), refreshMe(), refreshMe()])
        const count = getLogs().filter((item) => item.id >= firstId && item.url === '/api/v1/auth/refresh').length
        if (count !== 1) throw new Error(`预期只续期 1 次，实际为 ${count} 次`)
        return '3 个请求同时过期，只续期 1 次，全部重放成功'
      })}>并发请求续期</Button>
      <Button disabled={busy} onClick={() => void run(async () => {
        const oldRefresh = getRefresh()
        await refreshAccess()
        try {
          await http.post('/api/v1/auth/refresh', { refreshToken: oldRefresh }, { skipErrorToast: true })
        } catch (error) {
          if ((error as { code?: number }).code !== 40100) throw error
          await refreshMe()
          return '旧 Refresh Token 复用返回 40100，新会话仍然可用'
        }
        throw new Error('旧 Refresh Token 不应再次续期成功')
      })}>验证轮换与旧令牌复用</Button>
      <Button danger disabled={busy} onClick={() => void run(async () => {
        expireMockRefresh(getRefresh())
        expireAccessLocally()
        await refreshMe()
        throw new Error('Refresh Token 过期后不应续期成功')
      })}>模拟 Refresh Token 过期（退出）</Button>
      <Button disabled={busy} onClick={() => void run(() => transientFailure('me', 'server'))}>模拟请求 HTTP 500</Button>
      <Button disabled={busy} onClick={() => void run(() => transientFailure('me', 'network'))}>模拟请求断网</Button>
      <Button disabled={busy} onClick={() => void run(() => transientFailure('refresh', 'server'))}>模拟续期 HTTP 500</Button>
      <Button disabled={busy} onClick={() => void run(() => transientFailure('refresh', 'network'))}>模拟续期断网</Button>
    </Space>}
    {result && <Alert type={failed ? 'error' : 'success'} showIcon message={result} style={{ marginTop: 16 }} />}
  </Card>
}
