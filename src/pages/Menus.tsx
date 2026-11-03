import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Table, TreeSelect } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { MenuNode } from '@/types'

function siblings(nodes: MenuNode[], parentId: number): MenuNode[] {
  if (parentId === 0) return nodes
  for (const node of nodes) {
    if (node.id === parentId) return node.children || []
    const found = node.children ? siblings(node.children, parentId) : []
    if (found.length) return found
  }
  return []
}

export function MenusPage() {
  const { message, modal } = App.useApp()
  const [tree, setTree] = useState<MenuNode[]>([])
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<MenuNode | null>(null)
  const [form] = Form.useForm()

  const load = async () => setTree(await api.menuTree())
  useEffect(() => { load().catch(() => undefined) }, [])

  const move = async (row: MenuNode, direction: number) => {
    const list = [...siblings(tree, row.parentId)]
    const index = list.findIndex((item) => item.id === row.id)
    const target = index + direction
    if (target < 0 || target >= list.length) return
    const [item] = list.splice(index, 1)
    list.splice(target, 0, item)
    await api.sortMenus(list.map((entry, sort) => ({ id: entry.id, sort })))
    message.success('排序已更新')
    load()
  }

  return (
    <div>
      <EndpointAlert groups={['菜单']} />
      <Button type="primary" style={{ marginBottom: 12 }} onClick={() => { setCurrent(null); form.resetFields(); form.setFieldsValue({ type: 'menu', parentId: 0, sort: 0, visible: true }); setOpen(true) }}>新建节点</Button>
      <Table
        rowKey="id"
        pagination={false}
        dataSource={tree}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '类型', dataIndex: 'type' },
          { title: '路径', dataIndex: 'path' },
          { title: '权限码', dataIndex: 'permission' },
          { title: '排序', dataIndex: 'sort' },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => move(row, -1)}>上移</Button>
                <Button type="link" onClick={() => move(row, 1)}>下移</Button>
                <Button type="link" onClick={async () => { const detail = await api.menu(row.id); setCurrent(detail); form.setFieldsValue(detail); setOpen(true) }}>编辑</Button>
                <Button type="link" danger onClick={() => modal.confirm({ title: '删除该节点？', onOk: async () => { await api.deleteMenu(row.id); load() } })}>删除</Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={current ? '编辑菜单' : '新建菜单'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          if (current) await api.updateMenu(current.id, values)
          else await api.createMenu(values)
          message.success('已保存')
          setOpen(false)
          load()
        }}>
          <Form.Item name="parentId" label="父节点">
            <TreeSelect treeData={[{ id: 0, name: '根', children: tree }]} fieldNames={{ label: 'name', value: 'id', children: 'children' }} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'dir', label: '目录' }, { value: 'menu', label: '菜单' }, { value: 'button', label: '按钮' }]} />
          </Form.Item>
          <Form.Item name="path" label="路径"><Input /></Form.Item>
          <Form.Item name="icon" label="图标名"><Input /></Form.Item>
          <Form.Item name="permission" label="权限码"><Input /></Form.Item>
          <Form.Item name="sort" label="排序"><InputNumber /></Form.Item>
          <Form.Item name="visible" label="可见" hidden><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
