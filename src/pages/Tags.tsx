import { App, Button, ColorPicker, Form, Input, Modal, Space, Table } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { PageData, TagItem } from '@/types'

export function TagsPage() {
  const { message, modal } = App.useApp()
  const [data, setData] = useState<PageData<TagItem>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<TagItem | null>(null)
  const [form] = Form.useForm()
  const load = async (next = page) => setData(await api.tags({ page: next, pageSize: 10 }))
  useEffect(() => { load().catch(() => undefined) }, [page])

  return (
    <div>
      <EndpointAlert groups={['标签']} />
      <Button type="primary" style={{ marginBottom: 12 }} onClick={() => { setCurrent(null); form.resetFields(); form.setFieldsValue({ color: '#1677ff' }); setOpen(true) }}>新建标签</Button>
      <Table
        rowKey="id"
        dataSource={data.list}
        pagination={{ current: page, total: data.total, onChange: setPage }}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '颜色', dataIndex: 'color', render: (color: string) => <span style={{ color }}>{color}</span> },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={async () => { const detail = await api.tag(row.id); setCurrent(detail); form.setFieldsValue(detail); setOpen(true) }}>编辑</Button>
                <Button type="link" danger onClick={() => modal.confirm({ title: '删除标签？', onOk: async () => { await api.deleteTag(row.id); load() } })}>删除</Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal title="标签" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          const color = typeof values.color === 'string' ? values.color : values.color.toHexString()
          if (current) await api.updateTag(current.id, { ...values, color })
          else await api.createTag({ ...values, color })
          message.success('已保存')
          setOpen(false)
          load()
        }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="color" label="颜色"><ColorPicker /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
