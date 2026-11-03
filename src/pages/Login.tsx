import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/auth'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [captcha, setCaptcha] = useState({ captchaId: '', image: '' })
  const [loading, setLoading] = useState(false)

  const loadCaptcha = () => {
    api.captcha().then(setCaptcha).catch(() => undefined)
  }

  useEffect(loadCaptcha, [])

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
            layout="vertical"
            onFinish={async (values) => {
              setLoading(true)
              try {
                await login({ ...values, captchaId: captcha.captchaId })
                navigate('/dashboard')
              } catch {
                loadCaptcha()
              } finally {
                setLoading(false)
              }
            }}
          >
            <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
              <Input prefix={<UserOutlined />} placeholder="admin" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="admin123" />
            </Form.Item>
            <Form.Item name="captchaCode" label="验证码" rules={[{ required: true, len: 4 }]}>
              <Input
                placeholder="右侧四位数字"
                addonAfter={
                  <img src={captcha.image} alt="验证码" style={{ height: 32, cursor: 'pointer' }} onClick={loadCaptcha} />
                }
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              进入系统
            </Button>
          </Form>
        </Card>
      </section>
    </div>
  )
}
