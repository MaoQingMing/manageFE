import { App, Button, Select, Space, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { NotificationItem, PageData } from '@/types'
import { formatTime } from '@/utils'

export function NotificationsPage() {
  const { message } = App.useApp()
  const [query, setQuery] = useState({ page: 1, pageSize: 10, read: undefined as string | undefined })
  const [data, setData] = useState<PageData<NotificationItem>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const load = async () => setData(await api.notifications(query))
  useEffect(() => { load().catch(() => undefined) }, [query])

  return (
    <div>
      <EndpointAlert groups={['通知']} />
      <Space style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="已读状态" style={{ width: 140 }} options={[{ value: '0', label: '未读' }, { value: '1', label: '已读' }]} onChange={(read) => setQuery({ ...query, read, page: 1 })} />
        <Button onClick={async () => { await api.readAllNotifications(); message.success('已全部已读'); load() }}>全部已读</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={data.list}
        pagination={{ current: data.page, total: data.total, onChange: (page, pageSize) => setQuery({ ...query, page, pageSize }) }}
        columns={[
          { title: '标题', dataIndex: 'title' },
          { title: '内容', dataIndex: 'content' },
          { title: '类型', dataIndex: 'type' },
          { title: '状态', dataIndex: 'read', render: (read: boolean) => <Tag color={read ? 'default' : 'blue'}>{read ? '已读' : '未读'}</Tag> },
          { title: '时间', dataIndex: 'createdAt', render: formatTime },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                {!row.read && <Button type="link" onClick={async () => { await api.readNotification(row.id); load() }}>标为已读</Button>}
                <Button type="link" danger onClick={async () => { await api.deleteNotification(row.id); load() }}>删除</Button>
              </Space>
            ),
          },
        ]}
      />
    </div>
  )
}
