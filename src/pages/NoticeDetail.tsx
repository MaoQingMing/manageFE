import { App, Button, Card, Input, List, Space, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/auth'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { CommentNode, Notice } from '@/types'
import { can, formatTime } from '@/utils'

export function NoticeDetailPage() {
  const { id } = useParams()
  const noticeId = Number(id)
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { user } = useAuth()
  const [notice, setNotice] = useState<Notice>()
  const [comments, setComments] = useState<CommentNode[]>([])
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<number>()
  const [reply, setReply] = useState('')
  const writable = can(user?.permissions, 'content:comment:update')

  const load = async () => {
    const [detail, list] = await Promise.all([api.notice(noticeId), api.comments(noticeId)])
    setNotice(detail)
    setComments(list)
  }
  useEffect(() => { load().catch(() => undefined) }, [noticeId])

  return (
    <div>
      <EndpointAlert groups={['公告', '评论']} />
      <Button onClick={() => navigate('/content/notices')}>返回</Button>
      <Card title={notice?.title} style={{ marginTop: 12 }}>
        <Tag>{notice?.status === 'published' ? '已发布' : '草稿'}</Tag>
        <p>{notice?.content}</p>
      </Card>
      <Card title="评论" style={{ marginTop: 16 }}>
        {writable && (
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input value={content} onChange={(event) => setContent(event.target.value)} placeholder="写一条顶层评论" />
            <Button type="primary" onClick={async () => { await api.createComment(noticeId, content); setContent(''); message.success('已发表'); load() }}>发表</Button>
          </Space.Compact>
        )}
        <List
          dataSource={comments}
          renderItem={(item) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <Space>
                  <b>{item.user}</b>
                  <span>{formatTime(item.createdAt)}</span>
                  {item.status === 'hidden' && <Tag>已隐藏</Tag>}
                  {writable && <Button type="link" onClick={async () => { await api.commentStatus(item.id, item.status === 'hidden' ? 'visible' : 'hidden'); load() }}>{item.status === 'hidden' ? '显示' : '隐藏'}</Button>}
                  {writable && <Button type="link" onClick={() => setReplyTo(item.id)}>回复</Button>}
                  {writable && <Button type="link" danger onClick={async () => { await api.deleteComment(item.id); load() }}>删除</Button>}
                </Space>
                <div>{item.content}</div>
                {replyTo === item.id && (
                  <Space.Compact style={{ marginTop: 8 }}>
                    <Input value={reply} onChange={(event) => setReply(event.target.value)} />
                    <Button onClick={async () => { await api.replyComment(item.id, reply); setReply(''); setReplyTo(undefined); load() }}>发送</Button>
                  </Space.Compact>
                )}
                {item.replies?.map((child) => (
                  <div key={child.id} style={{ marginLeft: 24, marginTop: 8 }}>
                    <b>{child.user}</b> {child.content}
                    {writable && <Button type="link" danger onClick={async () => { await api.deleteComment(child.id); load() }}>删除</Button>}
                  </div>
                ))}
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
