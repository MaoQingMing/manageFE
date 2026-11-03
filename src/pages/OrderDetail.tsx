import { App, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Timeline } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/auth'
import { EndpointAlert } from '@/components/EndpointAlert'
import { orderStatusMeta } from '@/constants'
import type { Order, Product, TimelineItem } from '@/types'
import { can, formatMoney, formatTime } from '@/utils'

export function OrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { user } = useAuth()
  const [order, setOrder] = useState<Order>()
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shipOpen, setShipOpen] = useState(false)
  const [reasonOpen, setReasonOpen] = useState<'cancel' | 'refund' | 'reject' | ''>('')
  const [form] = Form.useForm()
  const [reasonForm] = Form.useForm()
  const [itemForm] = Form.useForm()

  const load = async () => {
    const [detail, logs] = await Promise.all([api.order(orderId), api.timeline(orderId)])
    setOrder(detail)
    setTimeline(logs)
  }
  useEffect(() => { load().catch(() => undefined) }, [orderId])

  if (!order) return null
  const pendingRefund = order.refunds?.find((item) => item.status === 'pending')

  return (
    <div>
      <EndpointAlert groups={['订单']} />
      <Button style={{ marginBottom: 12 }} onClick={() => navigate('/trade/orders')}>返回列表</Button>
      <Card>
        <Descriptions title={order.orderNo} extra={<Tag color={orderStatusMeta[order.status].color}>{orderStatusMeta[order.status].text}</Tag>}>
          <Descriptions.Item label="客户">{order.customer?.name} {order.customer?.phone}</Descriptions.Item>
          <Descriptions.Item label="金额">{formatMoney(order.amount)}</Descriptions.Item>
          <Descriptions.Item label="物流">{order.carrier || '-'} {order.trackingNo}</Descriptions.Item>
          <Descriptions.Item label="备注">{order.remark || '-'}</Descriptions.Item>
        </Descriptions>
        <Space wrap>
          {order.status === 'pending' && can(user?.permissions, 'trade:order:transition') && <Button type="primary" onClick={async () => { setOrder(await api.payOrder(order.id)); message.success('已支付'); load() }}>支付</Button>}
          {order.status === 'paid' && can(user?.permissions, 'trade:order:transition') && <Button onClick={() => setShipOpen(true)}>发货</Button>}
          {order.status === 'shipped' && can(user?.permissions, 'trade:order:transition') && <Button onClick={async () => { setOrder(await api.completeOrder(order.id)); load() }}>完成</Button>}
          {order.status === 'pending' && can(user?.permissions, 'trade:order:transition') && <Button danger onClick={() => setReasonOpen('cancel')}>取消</Button>}
          {(order.status === 'paid' || order.status === 'shipped') && can(user?.permissions, 'trade:order:refund') && <Button onClick={() => setReasonOpen('refund')}>申请退款</Button>}
          {pendingRefund && can(user?.permissions, 'trade:order:refund') && <Button type="primary" onClick={async () => { setOrder(await api.approveRefund(order.id, pendingRefund.id)); load() }}>同意退款</Button>}
          {pendingRefund && can(user?.permissions, 'trade:order:refund') && <Button onClick={() => setReasonOpen('reject')}>拒绝退款</Button>}
        </Space>
      </Card>
      <Card title="明细" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={order.items || []}
          columns={[
            { title: '商品', dataIndex: 'name' },
            { title: '单价', dataIndex: 'price', render: formatMoney },
            {
              title: '数量',
              dataIndex: 'qty',
              render: (qty: number, row) => order.status === 'pending' && can(user?.permissions, 'trade:order:create') ? (
                <InputNumber min={1} value={qty} onChange={async (value) => { if (value) { setOrder(await api.patchOrderItem(order.id, row.id, value)); load() } }} />
              ) : qty,
            },
            { title: '操作', render: (_, row) => order.status === 'pending' && <Button type="link" onClick={async () => { setOrder(await api.deleteOrderItem(order.id, row.id)); load() }}>删除</Button> },
          ]}
        />
        {order.status === 'pending' && can(user?.permissions, 'trade:order:create') && (
          <Form form={itemForm} layout="inline" style={{ marginTop: 12 }} onFinish={async (values) => {
            setOrder(await api.addOrderItem(order.id, values))
            itemForm.resetFields()
            load()
          }}>
            <Form.Item name="productId" rules={[{ required: true }]}>
              <Select
                style={{ width: 220 }}
                placeholder="选择在售商品"
                options={products.map((item) => ({ value: item.id, label: item.name }))}
                onOpenChange={async (visible: boolean) => { if (visible && !products.length) setProducts((await api.products({ page: 1, pageSize: 100, status: 'on' })).list) }}
              />
            </Form.Item>
            <Form.Item name="qty" initialValue={1}><InputNumber min={1} /></Form.Item>
            <Button htmlType="submit">添加明细</Button>
          </Form>
        )}
      </Card>
      <Card title="轨迹" style={{ marginTop: 16 }}>
        <Timeline items={timeline.map((item) => ({ children: `${formatTime(item.createdAt)} ${item.operator} ${item.action} ${item.remark}` }))} />
      </Card>
      <Modal title="发货" open={shipOpen} onCancel={() => setShipOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={async (values) => { setOrder(await api.shipOrder(order.id, values)); setShipOpen(false); load() }}>
          <Form.Item name="carrier" label="物流公司" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="trackingNo" label="运单号" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
      <Modal title="填写原因" open={!!reasonOpen} onCancel={() => setReasonOpen('')} onOk={() => reasonForm.submit()}>
        <Form form={reasonForm} layout="vertical" onFinish={async (values) => {
          if (reasonOpen === 'cancel') setOrder(await api.cancelOrder(order.id, values.reason))
          if (reasonOpen === 'refund') await api.refundOrder(order.id, { reason: values.reason, amount: order.payAmount })
          if (reasonOpen === 'reject' && pendingRefund) setOrder(await api.rejectRefund(order.id, pendingRefund.id, values.reason))
          setReasonOpen('')
          load()
        }}>
          <Form.Item name="reason" label="原因" rules={[{ required: true }]}><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
