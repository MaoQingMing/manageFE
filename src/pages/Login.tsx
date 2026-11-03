import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Collapse, Form, Input, Space, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { useMock } from '@/api/http'
import { useAuth } from '@/auth'
import { postLoginPath } from '@/authNavigation'
import { failNextAuthRequest } from '@/mock/auth.faults'
import { consumeMockCaptcha, expireMockCaptcha } from '@/mock/auth.practice'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form] = Form.useForm()
  const [captcha, setCaptcha] = useState({ captchaId: '', image: '' })
  const [loading, setLoading] = useState(false)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaError, setCaptchaError] = useState('')
  const [practiceHint, setPracticeHint] = useState('')
  const captchaRequest = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  const loadCaptcha = useCallback(async () => {
    captchaRequest.current?.abort()
    const controller = new AbortController()
    captchaRequest.current = controller
    const id = ++requestId.current
    setCaptchaLoading(true)
    setCaptchaError('')
    setPracticeHint('')
    setCaptcha({ captchaId: '', image: '' })
    form.resetFields(['captchaCode'])
    try {
      const next = await api.captcha(controller.signal)
      if (id === requestId.current) setCaptcha(next)
    } catch (error) {
      if (!controller.signal.aborted && id === requestId.current) {
        setCaptchaError(error instanceof Error ? error.message : '验证码获取失败，请重试')
      }
    } finally {
      if (id === requestId.current) setCaptchaLoading(false)
    }
  }, [form])

  useEffect(() => {
    void loadCaptcha()
    return () => { requestId.current += 1; captchaRequest.current?.abort() }
  }, [loadCaptcha])

  return (
    <div className="login-shell">
      <section className="login-brand">
        <div>
          <Typography.Text style={{ color: '#93c5fd' }}>GO API PRACTICE</Typography.Text>
          <h1>运营中台</h1>
          <p>这个前端故意铺开了分页、树、状态机、乐观锁、幂等、导入导出、分片上传和 WebSocket。先用 Mock 把交互走通，再关掉 Mock 去写 Go。</p>
        </div>
        <div>
          <div>admin / admin123</div>
          <div>operator / operator123</div>
          <div>service / service123</div>
          <div style={{ marginTop: 12, color: '#94a3b8' }}>停用账号 frozen / frozen123 会返回 40301</div>
        </div>
      </section>
      <section className="login-panel">
        <Card className="login-card" title="登录">
          <Form
            form={form}
            layout="vertical"
            onFinish={async (values) => {
              if (loading || captchaLoading || !captcha.captchaId) return
              setLoading(true)
              try {
                await login({ ...values, captchaId: captcha.captchaId })
                navigate(postLoginPath(params.get('redirect')), { replace: true })
              } catch {
                await loadCaptcha()
              } finally {
                setLoading(false)
              }
            }}
          >
            <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
              <Input prefix={<UserOutlined />} placeholder="admin" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="admin123" autoComplete="current-password" />
            </Form.Item>
            <Form.Item name="captchaCode" label="验证码" rules={[{ required: true }, { pattern: /^\d{4}$/, message: '请输入四位数字验证码' }]}>
              <Input
                placeholder="右侧四位数字"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                disabled={captchaLoading || loading || !captcha.captchaId}
                addonAfter={
                  <Button type="text" aria-label="刷新验证码" loading={captchaLoading} disabled={loading} onClick={() => void loadCaptcha()} style={{ height: 36, padding: 0 }}>
                    {captcha.image ? <img src={captcha.image} alt="验证码" style={{ height: 32 }} /> : '刷新验证码'}
                  </Button>
                }
              />
            </Form.Item>
            {captchaError && <Alert type="error" showIcon message={captchaError} style={{ marginBottom: 16 }} />}
            <Button type="primary" htmlType="submit" block loading={loading} disabled={captchaLoading || !captcha.captchaId}>
              进入系统
            </Button>
            {useMock && <Collapse size="small" style={{ marginTop: 16 }} items={[{
              key: 'practice',
              label: 'Mock 验证码练习',
              children: <Space direction="vertical">
                <Typography.Text type="secondary">错误账号、密码或验证码直接在上方表单输入；每次提交后验证码都会作废。</Typography.Text>
                <Space wrap>
                  <Button size="small" disabled={!captcha.captchaId || loading || captchaLoading} onClick={() => { expireMockCaptcha(captcha.captchaId); setPracticeHint('当前验证码已过期，按图片填写后提交应返回 40001') }}>使验证码过期</Button>
                  <Button size="small" disabled={!captcha.captchaId || loading || captchaLoading} onClick={() => { consumeMockCaptcha(captcha.captchaId); setPracticeHint('当前验证码已被使用，再次提交应返回 40001') }}>使验证码已使用</Button>
                  <Button size="small" disabled={loading || captchaLoading} onClick={() => { failNextAuthRequest('captcha', 'server'); void loadCaptcha() }}>模拟验证码加载失败</Button>
                </Space>
                {practiceHint && <Alert type="info" message={practiceHint} />}
              </Space>,
            }]} />}
          </Form>
        </Card>
      </section>
    </div>
  )
}
