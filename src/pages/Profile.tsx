import { App, Button, Card, Form, Input, Space, Upload } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { expireAccessLocally } from '@/api/http'
import { useAuth } from '@/auth'
import { EndpointAlert } from '@/components/EndpointAlert'

export function ProfilePage() {
  const { message } = App.useApp()
  const { user, refreshMe, logout } = useAuth()
  const navigate = useNavigate()
  const [avatar, setAvatar] = useState(user?.avatar || '')

  return (
    <div>
      <EndpointAlert groups={['认证', '文件']} />
      <Card title="个人资料">
        <Form
          layout="vertical"
          initialValues={user || undefined}
          onFinish={async (values) => {
            await api.updateProfile({ ...values, avatar })
            await refreshMe()
            message.success('资料已更新')
          }}
        >
          <Form.Item name="nickname" label="昵称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="phone" label="手机"><Input /></Form.Item>
          <Upload showUploadList={false} customRequest={async ({ file, onSuccess }) => {
            const uploaded = await api.uploadFile(file as File, 'avatar')
            setAvatar(uploaded.url || avatar)
            onSuccess?.({})
            message.success(uploaded.url ? '头像已上传，保存资料后生效' : '文件已上传，但这不是图片')
          }}>
            <Button>上传头像</Button>
          </Upload>
          <Button type="primary" htmlType="submit" style={{ marginTop: 16 }}>保存资料</Button>
        </Form>
      </Card>
      <Card title="修改密码" style={{ marginTop: 16 }}>
        <Form layout="vertical" onFinish={async (values) => {
          await api.updatePassword(values)
          message.success('密码已修改，请重新登录')
          await logout()
          navigate('/login')
        }}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          <Button htmlType="submit">修改密码</Button>
        </Form>
      </Card>
      <Card title="令牌" style={{ marginTop: 16 }}>
        <Space>
          <Button onClick={async () => { expireAccessLocally(); await refreshMe(); message.success('Access Token 已过期，并完成了 refresh') }}>模拟 Access Token 过期</Button>
        </Space>
      </Card>
    </div>
  )
}
