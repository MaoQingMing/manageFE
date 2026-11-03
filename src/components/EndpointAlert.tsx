import { Alert, Tag } from 'antd'
import { endpoints } from '@/api/endpoints'

const colors: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'gold',
  PATCH: 'orange',
  DELETE: 'red',
  WS: 'purple',
}

export function EndpointAlert({ groups }: { groups: string[] }) {
  const list = endpoints.filter((item) => groups.includes(item.group))
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      message={`${groups.join(' / ')} · 本页会打到 ${list.length} 个接口`}
      description={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {list.map((item) => (
            <Tag key={item.id} color={colors[item.method]}>
              {item.method} {item.path}
            </Tag>
          ))}
        </div>
      }
    />
  )
}
