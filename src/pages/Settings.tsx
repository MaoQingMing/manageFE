import { App, Button, Drawer, Form, Input, Space, Table } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { SettingItem } from '@/types'
import { formatTime } from '@/utils'

export function SettingsPage() {
  const { message } = App.useApp()
  const [items, setItems] = useState<SettingItem[]>([])
  const [current, setCurrent] = useState<SettingItem | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    const result = await api.settings()
    setItems(result.items)
    form.setFieldsValue({ items: result.items })
  }
  useEffect(() => { load().catch(() => undefined) }, [])

  return (
    <div>
      <EndpointAlert groups={['系统配置']} />
      <Form form={form} onFinish={async (values) => { await api.saveSettings(values.items); message.success('已保存'); load() }}>
        <Table
          rowKey="key"
          pagination={false}
          dataSource={items}
          columns={[
            { title: 'Key', dataIndex: 'key' },
            {
              title: 'Value',
              render: (_, __, index) => (
                <>
                  <Form.Item name={['items', index, 'key']} hidden><Input /></Form.Item>
                  <Form.Item name={['items', index, 'value']} style={{ margin: 0 }}><Input /></Form.Item>
                </>
              ),
            },
            { title: '说明', dataIndex: 'remark' },
            { title: '更新时间', dataIndex: 'updatedAt', render: formatTime },
            { title: '操作', render: (_, row) => <Button type="link" onClick={async () => setCurrent(await api.setting(row.key))}>按键查询</Button> },
          ]}
        />
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" htmlType="submit">批量保存</Button>
        </Space>
      </Form>
      <Drawer title={current?.key} open={!!current} onClose={() => setCurrent(null)}>
        <p>{current?.value}</p>
        <p>{current?.remark}</p>
      </Drawer>
    </div>
  )
}
