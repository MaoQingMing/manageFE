import { App, Button, Form, Input, Modal, Select, Space, Switch, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/auth'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { Notice, PageData } from '@/types'
import { can, formatTime } from '@/utils'

export function NoticesPage() {
  const { message, modal } = App.useApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', status: undefined as string | undefined })
  const [data, setData] = useState<PageData<Notice>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<Notice | null>(null)
  const [form] = Form.useForm()
  const load = async () => setData(await api.notices(query))
  useEffect(() => { load().catch(() => undefined) }, [query])

  return (
    <div>
      <EndpointAlert groups={['公告']} />
      <Space style={{ marginBottom: 12 }}>
        <Input.Search allowClear placeholder="标题 / 正文" onSearch={(keyword) => setQuery({ ...query, keyword, page: 1 })} />
        <Select allowClear placeholder="状态" style={{ width: 120 }} options={[{ value: 'draft', label: '草稿' }, { value: 'published', label: '已发布' }]} onChange={(status) => setQuery({ ...query, status, page: 1 })} />
        {can(user?.permissions, 'content:notice:update') && <Button type="primary" onClick={() => { setCurrent(null); form.resetFields(); setOpen(true) }}>新建草稿</Button>}
      </Space>
      <Table
        rowKey="id"
        dataSource={data.list}
        pagination={{ current: data.page, total: data.total, onChange: (page, pageSize) => setQuery({ ...query, page, pageSize }) }}
        columns={[
          { title: '标题', dataIndex: 'title', render: (title: string, row) => <>{row.pinned && <Tag>置顶</Tag>}{title}</> },
          { title: '状态', dataIndex: 'status', render: (status: string) => status === 'published' ? '已发布' : '草稿' },
          { title: '时间', dataIndex: 'createdAt', render: formatTime },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => navigate(`/content/notices/${row.id}`)}>评论</Button>
                {can(user?.permissions, 'content:notice:update') && <Button type="link" onClick={async () => { const detail = await api.notice(row.id); setCurrent(detail); form.setFieldsValue(detail); setOpen(true) }}>编辑</Button>}
                {can(user?.permissions, 'content:notice:update') && row.status === 'draft' && <Button type="link" onClick={async () => { await api.publishNotice(row.id); message.success('已发布'); load() }}>发布</Button>}
                {can(user?.permissions, 'content:notice:update') && row.status === 'published' && <Button type="link" onClick={async () => { await api.unpublishNotice(row.id); load() }}>撤回</Button>}
                {can(user?.permissions, 'content:notice:update') && <Button type="link" danger onClick={() => modal.confirm({ title: '删除公告和评论？', onOk: async () => { await api.deleteNotice(row.id); load() } })}>删除</Button>}
              </Space>
            ),
          },
        ]}
      />
      <Modal title="公告" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          if (current) await api.updateNotice(current.id, values)
          else await api.createNotice(values)
          message.success('已保存')
          setOpen(false)
          load()
        }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="content" label="正文" rules={[{ required: true }]}><Input.TextArea rows={5} /></Form.Item>
          <Form.Item name="pinned" label="置顶" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
