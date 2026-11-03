import { App, Button, Col, Form, Input, InputNumber, List, Modal, Row, Space, Table } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { DictItem, DictType, PageData } from '@/types'

export function DictsPage() {
  const { message, modal } = App.useApp()
  const [types, setTypes] = useState<DictType[]>([])
  const [current, setCurrent] = useState<DictType>()
  const [items, setItems] = useState<PageData<DictItem>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [page, setPage] = useState(1)
  const [editingType, setEditingType] = useState<DictType | null>(null)
  const [typeOpen, setTypeOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DictItem | null>(null)
  const [typeForm] = Form.useForm()
  const [itemForm] = Form.useForm()

  const loadTypes = async () => {
    const result = await api.dictTypes()
    setTypes(result.list)
    if (!current && result.list[0]) setCurrent(result.list[0])
  }
  const loadItems = async (type = current, next = page) => {
    if (!type) return
    setItems(await api.dictItems({ typeId: type.id, page: next, pageSize: 10 }))
  }

  useEffect(() => { loadTypes().catch(() => undefined) }, [])
  useEffect(() => { loadItems().catch(() => undefined) }, [current, page])

  return (
    <div>
      <EndpointAlert groups={['字典']} />
      <Row gutter={16}>
        <Col span={8}>
          <Button type="primary" onClick={() => { setEditingType(null); typeForm.resetFields(); typeForm.setFieldsValue({ status: 1 }); setTypeOpen(true) }}>新建类型</Button>
          <List
            style={{ marginTop: 12 }}
            dataSource={types}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer', background: current?.id === item.id ? '#e6f4ff' : undefined, paddingInline: 8 }}
                onClick={async () => { setCurrent(await api.dictType(item.id)); setPage(1) }}
                actions={[
                  <a key="edit" onClick={async (event) => { event.stopPropagation(); const detail = await api.dictType(item.id); setEditingType(detail); typeForm.setFieldsValue(detail); setTypeOpen(true) }}>编辑</a>,
                  <a key="del" onClick={(event) => { event.stopPropagation(); modal.confirm({ title: '删除字典类型？', onOk: async () => { await api.deleteDictType(item.id); setCurrent(undefined); loadTypes() } }) }}>删除</a>,
                ]}
              >
                <List.Item.Meta title={item.name} description={item.code} />
              </List.Item>
            )}
          />
        </Col>
        <Col span={16}>
          <Space style={{ marginBottom: 12 }}>
            <b>{current?.name || '请选择类型'}</b>
            <span>{current?.remark}</span>
            <Button disabled={!current} onClick={() => { setEditingItem(null); itemForm.resetFields(); itemForm.setFieldsValue({ status: 1, sort: 0 }); setItemOpen(true) }}>新建字典项</Button>
          </Space>
          <Table
            rowKey="id"
            dataSource={items.list}
            pagination={{ current: page, total: items.total, onChange: setPage }}
            columns={[
              { title: '标签', dataIndex: 'label' },
              { title: '值', dataIndex: 'value' },
              { title: '排序', dataIndex: 'sort' },
              {
                title: '操作',
                render: (_, row) => (
                  <Space>
                    <Button type="link" onClick={() => { setEditingItem(row); itemForm.setFieldsValue(row); setItemOpen(true) }}>编辑</Button>
                    <Button type="link" danger onClick={() => modal.confirm({ title: '删除字典项？', onOk: async () => { await api.deleteDictItem(row.id); loadItems() } })}>删除</Button>
                  </Space>
                ),
              },
            ]}
          />
        </Col>
      </Row>
      <Modal title="字典类型" open={typeOpen} onCancel={() => setTypeOpen(false)} onOk={() => typeForm.submit()} destroyOnClose>
        <Form form={typeForm} layout="vertical" onFinish={async (values) => {
          if (editingType) await api.updateDictType(editingType.id, values)
          else await api.createDictType(values)
          message.success('已保存')
          setTypeOpen(false)
          loadTypes()
        }}>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input disabled={!!editingType} /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input /></Form.Item>
          <Form.Item name="status" label="状态"><InputNumber /></Form.Item>
        </Form>
      </Modal>
      <Modal title="字典项" open={itemOpen} onCancel={() => setItemOpen(false)} onOk={() => itemForm.submit()} destroyOnClose>
        <Form form={itemForm} layout="vertical" onFinish={async (values) => {
          if (editingItem) await api.updateDictItem(editingItem.id, values)
          else await api.createDictItem({ ...values, typeId: current?.id })
          message.success('已保存')
          setItemOpen(false)
          loadItems()
        }}>
          <Form.Item name="label" label="标签" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sort" label="排序"><InputNumber /></Form.Item>
          <Form.Item name="status" label="状态"><InputNumber /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
