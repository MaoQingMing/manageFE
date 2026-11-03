import { Card, Col, List, Row, Segmented, Statistic } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { Overview, Rankings, TodoItem, TrendPoint } from '@/types'
import { formatMoney } from '@/utils'

export function DashboardPage() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<Overview>()
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [rankings, setRankings] = useState<Rankings>()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [health, setHealth] = useState('')
  const [range, setRange] = useState('7d')

  useEffect(() => {
    api.overview().then(setOverview).catch(() => undefined)
    api.rankings().then(setRankings).catch(() => undefined)
    api.todos().then(setTodos).catch(() => undefined)
    api.health().then((result) => setHealth(`${result.status} ${result.time}`)).catch(() => setHealth('不可用'))
  }, [])
  useEffect(() => { api.trends(range).then(setTrends).catch(() => undefined) }, [range])

  const max = Math.max(...trends.map((item) => item.orderCount), 1)

  return (
    <div>
      <EndpointAlert groups={['数据看板', '健康检查']} />
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="用户" value={overview?.userCount || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="商品" value={overview?.productCount || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="订单" value={overview?.orderCount || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="今日成交" value={formatMoney(overview?.todayAmount)} /></Card></Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={14}>
          <Card title="订单趋势" extra={<Segmented value={range} options={[{ label: '7 天', value: '7d' }, { label: '30 天', value: '30d' }]} onChange={(value) => setRange(String(value))} />}>
            {trends.map((item) => (
              <div className="trend-row" key={item.date}>
                <span>{item.date.slice(5)}</span>
                <div className="trend-bar"><span style={{ width: `${(item.orderCount / max) * 100}%` }} /></div>
                <span>{item.orderCount} 单 / {formatMoney(item.amount)}</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={10}>
          <Card title="待办">
            <List dataSource={todos} renderItem={(item) => <List.Item style={{ cursor: 'pointer' }} onClick={() => navigate(item.path)}>{item.title}<b>{item.count}</b></List.Item>} />
          </Card>
          <Card title="商品排行" style={{ marginTop: 16 }}>
            <List dataSource={rankings?.products || []} renderItem={(item) => <List.Item>{item.name}<span>{item.qty} 件</span></List.Item>} />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 16 }} size="small">健康检查：{health || '检查中'}</Card>
    </div>
  )
}
