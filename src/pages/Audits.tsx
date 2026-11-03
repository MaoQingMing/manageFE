import { Button, Descriptions, Drawer, Input, Space, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { AuditLog } from '@/types'
import { formatTime } from '@/utils'

export function AuditsPage() {
  const [list, setList] = useState<AuditLog[]>([])
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [current, setCurrent] = useState<AuditLog | null>(null)

  const load = async (reset: boolean, nextKeyword = keyword) => {
    const result = await api.audits({ keyword: nextKeyword, limit: 10, cursor: reset ? undefined : cursor })
    setList(reset ? result.list : [...list, ...result.list])
    setCursor(result.nextCursor)
    setHasMore(result.hasMore)
  }

  useEffect(() => { load(true).catch(() => undefined) }, [])

  return (
    <div>
      <EndpointAlert groups={['审计日志']} />
      <Space style={{ marginBottom: 12 }}>
        <Input.Search placeholder="路径 / 详情" allowClear onSearch={(value) => { setKeyword(value); load(true, value) }} />
      </Space>
      <Table
        rowKey="id"
        dataSource={list}
        pagination={false}
        columns={[
          { title: '时间', dataIndex: 'createdAt', render: formatTime },
          { title: '操作人', dataIndex: 'operator' },
          { title: '方法', dataIndex: 'method', render: (value: string) => <Tag>{value}</Tag> },
          { title: '路径', dataIndex: 'path' },
          { title: '状态', dataIndex: 'status' },
          { title: '操作', render: (_, row) => <Button type="link" onClick={async () => setCurrent(await api.audit(row.id))}>详情</Button> },
        ]}
      />
      {hasMore && <Button style={{ marginTop: 12 }} onClick={() => load(false)}>加载更多</Button>}
      <Drawer title="日志详情" open={!!current} onClose={() => setCurrent(null)} width={480}>
        {current && (
          <Descriptions column={1}>
            <Descriptions.Item label="操作人">{current.operator}</Descriptions.Item>
            <Descriptions.Item label="资源">{current.resource}</Descriptions.Item>
            <Descriptions.Item label="IP">{current.ip}</Descriptions.Item>
            <Descriptions.Item label="详情">{current.detail || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}
