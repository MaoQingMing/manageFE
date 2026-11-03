import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/auth'
import { EndpointAlert } from '@/components/EndpointAlert'
import { orderStatusMeta } from '@/constants'
import type { Customer, Order, PageData, Product } from '@/types'
import { can, downloadBlob, filenameFromDisposition, formatMoney, formatTime } from '@/utils'

export function OrdersPage() {
  const { message } = App.useApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', status: undefined as string | undefined })
  const [data, setData] = useState<PageData<Order>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [open, setOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [lastBody, setLastBody] = useState<object>()
  const [lastKey, setLastKey] = useState('')
  const [form] = Form.useForm()

  const load = async () => setData(await api.orders(query))
  useEffect(() => { load().catch(() => undefined) }, [query])

  return (
    <div>
      <EndpointAlert groups={['订单']} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search placeholder="单号 / 客户" allowClear onSearch={(keyword) => setQuery({ ...query, keyword, page: 1 })} />
        <Select allowClear placeholder="状态" style={{ width: 140 }} options={Object.entries(orderStatusMeta).map(([value, meta]) => ({ value, label: meta.text }))} onChange={(status) => setQuery({ ...query, status, page: 1 })} />
        {can(user?.permissions, 'trade:order:create') && (
          <Button type="primary" onClick={async () => {
            const [customerPage, productPage] = await Promise.all([api.customers({ page: 1, pageSize: 100 }), api.products({ page: 1, pageSize: 100, status: 'on' })])
            setCustomers(customerPage.list)
            setProducts(productPage.list)
            form.resetFields()
            form.setFieldsValue({ items: [{ qty: 1 }] })
            setOpen(true)
          }}>创建订单</Button>
        )}
        {lastKey && <Button onClick={async () => { const result = await api.createOrder(lastBody!, lastKey); message.info(result.replayed ? `幂等重放，仍是 ${result.order.orderNo}` : '创建了新订单') }}>同一幂等键再提交</Button>}
        <Button onClick={async () => { const file = await api.exportOrders(query); downloadBlob(file.blob, filenameFromDisposition(file.disposition, 'orders.csv')) }}>导出</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={data.list}
        pagination={{ current: data.page, total: data.total, pageSize: data.pageSize, onChange: (page, pageSize) => setQuery({ ...query, page, pageSize }) }}
        columns={[
          { title: '单号', dataIndex: 'orderNo' },
          { title: '客户', dataIndex: 'customerName' },
          { title: '金额', dataIndex: 'amount', render: formatMoney },
          { title: '件数', dataIndex: 'itemCount' },
          { title: '状态', dataIndex: 'status', render: (status: keyof typeof orderStatusMeta) => <Tag color={orderStatusMeta[status].color}>{orderStatusMeta[status].text}</Tag> },
          { title: '创建时间', dataIndex: 'createdAt', render: formatTime },
          { title: '操作', render: (_, row) => <Button type="link" onClick={() => navigate(`/trade/orders/${row.id}`)}>详情</Button> },
        ]}
      />
      <Modal title="创建订单" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} width={640}>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          const key = crypto.randomUUID()
          const result = await api.createOrder(values, key)
          setLastBody(values)
          setLastKey(key)
          message.success(`已创建 ${result.order.orderNo}`)
          setOpen(false)
          load()
        }}>
          <Form.Item name="customerId" label="客户" rules={[{ required: true }]}><Select options={customers.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="remark" label="备注"><Input /></Form.Item>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline">
                    <Form.Item name={[field.name, 'productId']} rules={[{ required: true }]}>
                      <Select style={{ width: 220 }} placeholder="商品" options={products.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'qty']} rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
                    <Button type="link" onClick={() => remove(field.name)}>删除</Button>
                  </Space>
                ))}
                <Button onClick={() => add({ qty: 1 })}>加一行</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  )
}
