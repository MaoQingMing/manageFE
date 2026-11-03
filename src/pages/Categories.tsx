import { App, Button, Form, Input, InputNumber, Modal, Space, Table, TreeSelect } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { CategoryNode } from '@/types'

export function CategoriesPage() {
  const { message, modal } = App.useApp()
  const [tree, setTree] = useState<CategoryNode[]>([])
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState<CategoryNode | null>(null)
  const [current, setCurrent] = useState<CategoryNode | null>(null)
  const [form] = Form.useForm()
  const [moveForm] = Form.useForm()
  const load = async () => setTree(await api.categoryTree())
  useEffect(() => { load().catch(() => undefined) }, [])

  return (
    <div>
      <EndpointAlert groups={['商品分类']} />
      <Button type="primary" style={{ marginBottom: 12 }} onClick={() => { setCurrent(null); form.resetFields(); form.setFieldsValue({ parentId: 0, sort: 0, status: 1 }); setOpen(true) }}>新建分类</Button>
      <Table
        rowKey="id"
        pagination={false}
        dataSource={tree}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '排序', dataIndex: 'sort' },
          { title: '状态', dataIndex: 'status', render: (value: number) => (value === 1 ? '启用' : '停用') },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={async () => { const detail = await api.category(row.id); setCurrent(detail); form.setFieldsValue(detail); setOpen(true) }}>编辑</Button>
                <Button type="link" onClick={() => { setMoving(row); moveForm.setFieldsValue({ parentId: row.parentId, sort: row.sort }) }}>移动</Button>
                <Button type="link" danger onClick={() => modal.confirm({ title: '删除分类？', onOk: async () => { await api.deleteCategory(row.id); load() } })}>删除</Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={current ? '编辑分类' : '新建分类'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          if (current) await api.updateCategory(current.id, values)
          else await api.createCategory(values)
          message.success('已保存')
          setOpen(false)
          load()
        }}>
          {!current && <Form.Item name="parentId" label="父分类 ID"><InputNumber style={{ width: '100%' }} /></Form.Item>}
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sort" label="排序"><InputNumber /></Form.Item>
          <Form.Item name="status" label="状态"><InputNumber /></Form.Item>
        </Form>
      </Modal>
      <Modal title="移动分类" open={!!moving} onCancel={() => setMoving(null)} onOk={() => moveForm.submit()}>
        <Form form={moveForm} layout="vertical" onFinish={async (values) => {
          if (!moving) return
          await api.moveCategory(moving.id, values)
          message.success('已移动')
          setMoving(null)
          load()
        }}>
          <Form.Item name="parentId" label="新的父节点">
            <TreeSelect allowClear treeData={[{ id: 0, name: '根', children: tree }]} fieldNames={{ label: 'name', value: 'id', children: 'children' }} />
          </Form.Item>
          <Form.Item name="sort" label="排序"><InputNumber /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
