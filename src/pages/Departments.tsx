import { App, Button, Col, Form, Input, InputNumber, Modal, Row, Table, Tree } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { DeptNode, UserItem } from '@/types'

export function DepartmentsPage() {
  const { message, modal } = App.useApp()
  const [tree, setTree] = useState<DeptNode[]>([])
  const [current, setCurrent] = useState<number>()
  const [members, setMembers] = useState<UserItem[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DeptNode | null>(null)
  const [form] = Form.useForm()

  const load = async () => setTree(await api.deptTree())
  useEffect(() => { load().catch(() => undefined) }, [])

  const select = async (id: number) => {
    setCurrent(id)
    setMembers(await api.deptMembers(id))
  }

  return (
    <div>
      <EndpointAlert groups={['部门']} />
      <Row gutter={16}>
        <Col span={10}>
          <Button style={{ marginBottom: 12 }} type="primary" onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ parentId: current || 0, status: 1, sort: 0 }); setOpen(true) }}>新建部门</Button>
          <Tree
            defaultExpandAll
            treeData={toDeptTree(tree)}
            onSelect={(keys) => keys[0] && select(Number(keys[0]))}
          />
        </Col>
        <Col span={14}>
          <SpaceBar current={current} tree={tree} onEdit={async () => {
            if (!current) return
            const detail = await api.dept(current)
            setEditing(detail)
            form.setFieldsValue(detail)
            setOpen(true)
          }} onDelete={() => {
            if (!current) return
            modal.confirm({ title: '删除部门？', onOk: async () => { await api.deleteDept(current); setCurrent(undefined); setMembers([]); load() } })
          }} />
          <Table rowKey="id" dataSource={members} pagination={false} columns={[{ title: '用户名', dataIndex: 'username' }, { title: '昵称', dataIndex: 'nickname' }, { title: '手机', dataIndex: 'phone' }]} />
        </Col>
      </Row>
      <Modal title={editing ? '编辑部门' : '新建部门'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          if (editing) await api.updateDept(editing.id, values)
          else await api.createDept(values)
          message.success('已保存')
          setOpen(false)
          load()
          if (current) select(current)
        }}>
          <Form.Item name="parentId" label="父部门 ID"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="leader" label="负责人"><Input /></Form.Item>
          <Form.Item name="sort" label="排序"><InputNumber /></Form.Item>
          <Form.Item name="status" label="状态"><InputNumber /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function SpaceBar({ current, tree, onEdit, onDelete }: { current?: number; tree: DeptNode[]; onEdit: () => void; onDelete: () => void }) {
  const name = findName(tree, current)
  return (
    <div style={{ marginBottom: 12 }}>
      直属成员{name ? ` · ${name}` : ''}
      <Button type="link" disabled={!current} onClick={onEdit}>编辑</Button>
      <Button type="link" danger disabled={!current} onClick={onDelete}>删除</Button>
    </div>
  )
}

function toDeptTree(nodes: DeptNode[]): { key: number; title: string; children?: ReturnType<typeof toDeptTree> }[] {
  return nodes.map((node) => ({
    key: node.id,
    title: node.name,
    children: node.children?.length ? toDeptTree(node.children) : undefined,
  }))
}

function findName(nodes: DeptNode[], id?: number): string {
  if (!id) return ''
  for (const node of nodes) {
    if (node.id === id) return node.name
    const child = findName(node.children || [], id)
    if (child) return child
  }
  return ''
}
