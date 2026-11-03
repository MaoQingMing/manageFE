import { App, Button, Form, Input, Modal, Select, Space, Switch, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useAuth } from '@/auth'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { DeptNode, PageData, RoleItem, UserItem } from '@/types'
import { can, formatTime } from '@/utils'

function flatDept(nodes: DeptNode[], prefix = ''): { label: string; value: number }[] {
  return nodes.flatMap((node) => [{ label: `${prefix}${node.name}`, value: node.id }, ...flatDept(node.children || [], `${prefix}— `)])
}

export function UsersPage() {
  const { message, modal } = App.useApp()
  const { user } = useAuth()
  const perms = user?.permissions || []
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', status: undefined as number | undefined, deptId: undefined as number | undefined, deleted: 0, sortField: '', sortOrder: '' as '' | 'ascend' | 'descend' })
  const [data, setData] = useState<PageData<UserItem>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [depts, setDepts] = useState<DeptNode[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<UserItem | null>(null)
  const [roleUser, setRoleUser] = useState<UserItem | null>(null)
  const [form] = Form.useForm()
  const [roleForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      setData(await api.users(query))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
  }, [query])

  useEffect(() => {
    api.roles({ page: 1, pageSize: 100 }).then((result) => setRoles(result.list)).catch(() => undefined)
    api.deptTree().then(setDepts).catch(() => undefined)
  }, [])

  const openEdit = async (id: number) => {
    const detail = await api.user(id)
    setCurrent(detail)
    form.setFieldsValue(detail)
    setOpen(true)
  }

  return (
    <div>
      <EndpointAlert groups={['用户']} />
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search placeholder="用户名 / 昵称 / 手机" allowClear onSearch={(keyword) => setQuery({ ...query, keyword, page: 1 })} />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 120 }}
          options={[{ value: 1, label: '启用' }, { value: 0, label: '禁用' }]}
          onChange={(status) => setQuery({ ...query, status, page: 1 })}
        />
        <Select
          allowClear
          placeholder="部门"
          style={{ width: 160 }}
          options={flatDept(depts)}
          onChange={(deptId) => setQuery({ ...query, deptId, page: 1 })}
        />
        <Select
          value={query.deleted}
          style={{ width: 120 }}
          options={[{ value: 0, label: '正常' }, { value: 1, label: '回收站' }]}
          onChange={(deleted) => setQuery({ ...query, deleted, page: 1 })}
        />
        {can(perms, 'system:user:create') && (
          <Button type="primary" onClick={() => { setCurrent(null); form.resetFields(); form.setFieldsValue({ status: 1 }); setOpen(true) }}>
            新建
          </Button>
        )}
        {can(perms, 'system:user:delete') && query.deleted === 0 && (
          <Button
            danger
            disabled={!selected.length}
            onClick={() => modal.confirm({
              title: `软删除 ${selected.length} 个用户？`,
              onOk: async () => {
                const result = await api.batchDeleteUsers(selected)
                message.success(`已删除 ${result.deleted} 个`)
                setSelected([])
                load()
              },
            })}
          >
            批量删除
          </Button>
        )}
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data.list}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as number[]) }}
        pagination={{ current: data.page, pageSize: data.pageSize, total: data.total }}
        onChange={(pagination, _, sorter) => {
          const sort = Array.isArray(sorter) ? sorter[0] : sorter
          setQuery({
            ...query,
            page: pagination.current || 1,
            pageSize: pagination.pageSize || 10,
            sortField: String(sort?.field || ''),
            sortOrder: sort?.order || '',
          })
        }}
        columns={[
          { title: '用户名', dataIndex: 'username', sorter: true },
          { title: '昵称', dataIndex: 'nickname' },
          { title: '部门', dataIndex: 'deptName' },
          { title: '角色', dataIndex: 'roleNames', render: (names: string[]) => names.map((name) => <Tag key={name}>{name}</Tag>) },
          {
            title: '状态',
            dataIndex: 'status',
            render: (status: number, row) => (
              <Switch
                checked={status === 1}
                disabled={!can(perms, 'system:user:update') || !!row.deletedAt}
                onChange={async (checked) => {
                  await api.userStatus(row.id, checked ? 1 : 0)
                  load()
                }}
              />
            ),
          },
          { title: '创建时间', dataIndex: 'createdAt', render: formatTime },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                {query.deleted === 1 ? (
                  <Button type="link" onClick={async () => { await api.restoreUser(row.id); message.success('已恢复'); load() }}>恢复</Button>
                ) : (
                  <>
                    <Button type="link" onClick={() => openEdit(row.id)}>详情</Button>
                    {can(perms, 'system:user:update') && (
                      <Button type="link" onClick={() => { setRoleUser(row); roleForm.setFieldsValue({ roleIds: row.roleIds }) }}>角色</Button>
                    )}
                    {can(perms, 'system:user:update') && (
                      <Button
                        type="link"
                        onClick={() => modal.confirm({
                          title: '重置密码为 123456？',
                          onOk: async () => {
                            const result = await api.resetPassword(row.id, '123456')
                            message.success(`临时密码 ${result.password}`)
                          },
                        })}
                      >
                        重置密码
                      </Button>
                    )}
                    {can(perms, 'system:user:delete') && row.id !== user?.id && (
                      <Button type="link" danger onClick={() => modal.confirm({ title: '软删除该用户？', onOk: async () => { await api.deleteUser(row.id); load() } })}>删除</Button>
                    )}
                  </>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={current ? '编辑用户' : '新建用户'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            if (current) await api.updateUser(current.id, values)
            else await api.createUser(values)
            message.success('已保存')
            setOpen(false)
            load()
          }}
        >
          {!current && (
            <>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
            </>
          )}
          <Form.Item name="nickname" label="昵称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="phone" label="手机"><Input /></Form.Item>
          <Form.Item name="deptId" label="部门" rules={[{ required: true }]}>
            <Select options={flatDept(depts)} />
          </Form.Item>
          {!current && (
            <Form.Item name="roleIds" label="角色" rules={[{ required: true }]}>
              <Select mode="multiple" options={roles.map((role) => ({ value: role.id, label: role.name }))} />
            </Form.Item>
          )}
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={[{ value: 1, label: '启用' }, { value: 0, label: '禁用' }]} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="分配角色"
        open={!!roleUser}
        onCancel={() => setRoleUser(null)}
        onOk={() => roleForm.submit()}
      >
        <Form
          form={roleForm}
          layout="vertical"
          onFinish={async (values) => {
            await api.userRoles(roleUser!.id, values.roleIds)
            message.success('角色已覆盖')
            setRoleUser(null)
            load()
          }}
        >
          <Form.Item name="roleIds" label="角色" rules={[{ required: true }]}>
            <Select mode="multiple" options={roles.map((role) => ({ value: role.id, label: role.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
