import { App, Button, Drawer, Form, Input, Modal, Select, Space, Switch, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import { levelMeta } from '@/constants'
import type { Address, Customer, PageData } from '@/types'

export function CustomersPage() {
  const { message, modal } = App.useApp()
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', level: undefined as string | undefined })
  const [data, setData] = useState<PageData<Customer>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [current, setCurrent] = useState<Customer | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [open, setOpen] = useState(false)
  const [addrOpen, setAddrOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)
  const [form] = Form.useForm()
  const [addrForm] = Form.useForm()

  const load = async () => setData(await api.customers(query))
  const loadAddresses = async (id: number) => setAddresses(await api.addresses(id))
  useEffect(() => { load().catch(() => undefined) }, [query])

  const openCustomer = async (id?: number) => {
    if (!id) {
      setCurrent(null)
      form.resetFields()
      form.setFieldsValue({ level: 'normal', status: 1 })
      setOpen(true)
      return
    }
    const detail = await api.customer(id)
    setCurrent(detail)
    form.setFieldsValue(detail)
    await loadAddresses(id)
    setOpen(true)
  }

  return (
    <div>
      <EndpointAlert groups={['客户']} />
      <Space style={{ marginBottom: 12 }}>
        <Input.Search placeholder="姓名 / 手机" allowClear onSearch={(keyword) => setQuery({ ...query, keyword, page: 1 })} />
        <Select allowClear placeholder="等级" style={{ width: 120 }} options={Object.entries(levelMeta).map(([value, label]) => ({ value, label }))} onChange={(level) => setQuery({ ...query, level, page: 1 })} />
        <Button type="primary" onClick={() => openCustomer()}>新建客户</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={data.list}
        pagination={{ current: data.page, total: data.total, onChange: (page, pageSize) => setQuery({ ...query, page, pageSize }) }}
        columns={[
          { title: '姓名', dataIndex: 'name' },
          { title: '手机', dataIndex: 'phone' },
          { title: '等级', dataIndex: 'level', render: (level: string) => <Tag>{levelMeta[level] || level}</Tag> },
          { title: '状态', dataIndex: 'status', render: (status: number) => (status === 1 ? '正常' : '停用') },
          { title: '操作', render: (_, row) => <Button type="link" onClick={() => openCustomer(row.id)}>详情</Button> },
        ]}
      />
      <Drawer title={current ? current.name : '新建客户'} open={open} width={560} onClose={() => setOpen(false)} extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          if (current) {
            const saved = await api.updateCustomer(current.id, values)
            setCurrent(saved)
          } else {
            const created = await api.createCustomer(values)
            setCurrent(created)
            await loadAddresses(created.id)
          }
          message.success('已保存')
          load()
        }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="level" label="等级" rules={[{ required: true }]}><Select options={Object.entries(levelMeta).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={[{ value: 1, label: '正常' }, { value: 0, label: '停用' }]} /></Form.Item>
        </Form>
        {current && (
          <>
            <Space style={{ margin: '12px 0' }}>
              <b>地址</b>
              <Button onClick={() => { setEditing(null); addrForm.resetFields(); setAddrOpen(true) }}>新增地址</Button>
              <Button danger onClick={() => modal.confirm({ title: '删除客户及其地址？', onOk: async () => { await api.deleteCustomer(current.id); setOpen(false); load() } })}>删除客户</Button>
            </Space>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={addresses}
              columns={[
                { title: '收货人', dataIndex: 'receiver' },
                { title: '地区', dataIndex: 'region' },
                { title: '详细地址', dataIndex: 'detail' },
                { title: '默认', dataIndex: 'isDefault', render: (value: boolean, row) => <Switch checked={value} onChange={async () => { await api.defaultAddress(current.id, row.id); loadAddresses(current.id) }} /> },
                {
                  title: '操作',
                  render: (_, row) => (
                    <Space>
                      <Button type="link" onClick={() => { setEditing(row); addrForm.setFieldsValue(row); setAddrOpen(true) }}>编辑</Button>
                      <Button type="link" danger onClick={async () => { await api.deleteAddress(current.id, row.id); loadAddresses(current.id) }}>删除</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      <Modal title="地址" open={addrOpen} onCancel={() => setAddrOpen(false)} onOk={() => addrForm.submit()}>
        <Form form={addrForm} layout="vertical" onFinish={async (values) => {
          if (!current) return
          if (editing) await api.updateAddress(current.id, editing.id, values)
          else await api.createAddress(current.id, values)
          setAddrOpen(false)
          loadAddresses(current.id)
        }}>
          <Form.Item name="receiver" label="收货人" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="region" label="地区" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="detail" label="详细地址" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="isDefault" label="默认" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
