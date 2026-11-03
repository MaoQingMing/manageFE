import { BugOutlined } from '@ant-design/icons'
import { Button, Drawer, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { getLogs, subscribeLogs, type ApiLog } from '@/api/http'

export function RequestDrawer() {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<ApiLog[]>(getLogs())

  useEffect(() => subscribeLogs(() => setLogs([...getLogs()])), [])

  return (
    <>
      <Button
        shape="circle"
        type="primary"
        icon={<BugOutlined />}
        style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 20 }}
        onClick={() => setOpen(true)}
      />
      <Drawer title="最近请求" open={open} onClose={() => setOpen(false)} width={640}>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={logs}
          columns={[
            { title: '时间', dataIndex: 'time', width: 90 },
            {
              title: '请求',
              render: (_, row) => (
                <span>
                  <Tag>{row.method}</Tag>
                  {row.url}
                </span>
              ),
            },
            { title: '状态', dataIndex: 'status', width: 70 },
            { title: 'code', dataIndex: 'code', width: 70 },
            { title: 'ms', dataIndex: 'ms', width: 60 },
          ]}
        />
      </Drawer>
    </>
  )
}
