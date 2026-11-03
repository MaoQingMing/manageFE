import { Button, Card, Input, Select, Space, Statistic, Table, Tag } from 'antd'
import { useMemo, useState } from 'react'
import { api } from '@/api/client'
import { endpointGroups, endpointTotal, endpoints, type HttpMethod } from '@/api/endpoints'
import { EndpointAlert } from '@/components/EndpointAlert'

const colors: Record<HttpMethod, string> = { GET: 'blue', POST: 'green', PUT: 'gold', PATCH: 'orange', DELETE: 'red', WS: 'purple' }

export function LabPage() {
  const [keyword, setKeyword] = useState('')
  const [group, setGroup] = useState<string>()
  const [health, setHealth] = useState('')
  const list = useMemo(
    () => endpoints.filter((item) => (!group || item.group === group) && (!keyword || `${item.path}${item.summary}${item.practice}`.includes(keyword))),
    [keyword, group],
  )

  return (
    <div>
      <EndpointAlert groups={['实时通道']} />
      <Card style={{ marginBottom: 16 }}>
        <Space size={32}>
          <Statistic title="接口总数" value={endpointTotal} />
          <Statistic title="HTTP" value={endpoints.filter((item) => item.method !== 'WS').length} />
          <Statistic title="WebSocket" value={1} />
          <Button onClick={async () => setHealth(JSON.stringify(await api.health()))}>调用健康检查</Button>
          <span>{health}</span>
        </Space>
      </Card>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search allowClear placeholder="路径 / 说明 / 练习点" onSearch={setKeyword} />
        <Select allowClear placeholder="分组" style={{ width: 160 }} options={endpointGroups.map((item) => ({ value: item, label: item }))} onChange={setGroup} />
      </Space>
      <Table
        rowKey="id"
        dataSource={list}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: '分组', dataIndex: 'group', width: 110 },
          { title: '方法', dataIndex: 'method', width: 90, render: (method: HttpMethod) => <Tag color={colors[method]}>{method}</Tag> },
          { title: '路径', dataIndex: 'path' },
          { title: '说明', dataIndex: 'summary' },
          { title: '练习点', dataIndex: 'practice' },
          { title: '鉴权', dataIndex: 'auth', width: 70, render: (auth: boolean) => (auth ? '是' : '否') },
        ]}
      />
    </div>
  )
}
