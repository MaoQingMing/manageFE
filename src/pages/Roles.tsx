import { App, Button, Form, Input, Modal, Space, Table, Tree } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useAuth } from '@/auth'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { MenuNode, PageData, RoleItem } from '@/types'
import { can } from '@/utils'

function treeData(nodes: MenuNode[]): { key: number; title: string; children?: ReturnType<typeof treeData> }[] {
  return nodes.map((node) => ({
    key: node.id,
    title: `${node.name}${node.permission ? ` · ${node.permission}` : ''}`,
    children: node.children?.length ? treeData(node.children) : undefined,
  }))
}

function codesOf(nodes: MenuNode[], checked: number[]) {
  const codes: string[] = []
  const walk = (list: MenuNode[]) => {
    list.forEach((node) => {
      if (checked.includes(node.id) && node.permission) codes.push(node.permission)
      if (node.children) walk(node.children)
    })
  }
  walk(nodes)
  return [...new Set(codes)]
}

function idsOf(nodes: MenuNode[], permissions: string[]) {
  const ids: number[] = []
  const walk = (list: MenuNode[]) => {
    list.forEach((node) => {
      if (node.permission && (permissions.includes('*') || permissions.includes(node.permission))) ids.push(node.id)
      if (node.children) walk(node.children)
    })
  }
  walk(nodes)
  return ids
}

export function RolesPage() {
  const { message, modal } = App.useApp()
  const { user } = useAuth()
  const perms = user?.permissions || []
  const [data, setData] = useState<PageData<RoleItem>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<RoleItem | null>(null)
  const [menus, setMenus] = useState<MenuNode[]>([])
  const [checked, setChecked] = useState<number[]>([])
  const [permRole, setPermRole] = useState<RoleItem | null>(null)
  const [form] = Form.useForm()

  const load = async (next = page) => setData(await api.roles({ page: next, pageSize: 10 }))
  useEffect(() => { load().catch(() => undefined) }, [page])

  return (
    <div>
      <EndpointAlert groups={['角色', '菜单']} />
      {can(perms, 'system:role:create') && <Button type="primary" style={{ marginBottom: 12 }} onClick={() => { setCurrent(null); form.resetFields(); form.setFieldsValue({ status: 1 }); setOpen(true) }}>新建角色</Button>}
      <Table
        rowKey="id"
        dataSource={data.list}
        pagination={{ current: page, total: data.total, onChange: setPage }}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '编码', dataIndex: 'code' },
          { title: '备注', dataIndex: 'remark' },
          { title: '权限数', render: (_, row) => (row.permissions.includes('*') ? '全部' : row.permissions.length) },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={async () => { const detail = await api.role(row.id); setCurrent(detail); form.setFieldsValue(detail); setOpen(true) }}>编辑</Button>
                {can(perms, 'system:role:update') && (
                  <Button type="link" onClick={async () => {
                    const [detail, tree] = await Promise.all([api.role(row.id), api.menuTree()])
                    setMenus(tree)
                    setChecked(idsOf(tree, detail.permissions))
                    setPermRole(detail)
                  }}>权限</Button>
                )}
                {can(perms, 'system:role:delete') && row.code !== 'admin' && (
                  <Button type="link" danger onClick={() => modal.confirm({ title: '删除角色？', onOk: async () => { await api.deleteRole(row.id); load() } })}>删除</Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal title={current ? '编辑角色' : '新建角色'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          if (current) await api.updateRole(current.id, values)
          else await api.createRole(values)
          message.success('已保存')
          setOpen(false)
          load()
        }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          {!current && <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>}
          <Form.Item name="remark" label="备注"><Input.TextArea /></Form.Item>
          <Form.Item name="status" label="状态" hidden><Input /></Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`权限 · ${permRole?.name || ''}`}
        open={!!permRole}
        onCancel={() => setPermRole(null)}
        okButtonProps={{ disabled: !!permRole?.permissions.includes('*') }}
        onOk={async () => {
          if (!permRole) return
          await api.rolePermissions(permRole.id, codesOf(menus, checked))
          message.success('权限已覆盖')
          setPermRole(null)
          load()
        }}
      >
        {permRole?.permissions.includes('*') ? '超级管理员持有 * ，这里不能改。' : (
          <Tree
            checkable
            checkStrictly
            defaultExpandAll
            treeData={treeData(menus)}
            checkedKeys={{ checked, halfChecked: [] }}
            onCheck={(keys) => setChecked((Array.isArray(keys) ? keys : keys.checked) as number[])}
          />
        )}
      </Modal>
    </div>
  )
}
