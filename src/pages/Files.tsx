import { App, Button, Progress, Select, Space, Table, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { EndpointAlert } from '@/components/EndpointAlert'
import type { FileItem, PageData } from '@/types'
import { downloadBlob, filenameFromDisposition, formatTime } from '@/utils'

export function FilesPage() {
  const { message } = App.useApp()
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', bizType: undefined as string | undefined })
  const [data, setData] = useState<PageData<FileItem>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [percent, setPercent] = useState(0)
  const [uploadId, setUploadId] = useState('')
  const load = async () => setData(await api.files(query))
  useEffect(() => { load().catch(() => undefined) }, [query])

  const chunkUpload = async (file: File) => {
    const chunkSize = 256 * 1024
    const session = await api.initUpload({ filename: file.name, size: file.size, chunkSize, mime: file.type || 'application/octet-stream', bizType: 'chunk' })
    setUploadId(session.uploadId)
    for (let index = 0; index < session.totalChunks; index += 1) {
      const blob = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize))
      await api.putChunk(session.uploadId, index, await blob.arrayBuffer())
      setPercent(Math.round(((index + 1) / session.totalChunks) * 100))
    }
    await api.completeUpload(session.uploadId)
    setUploadId('')
    message.success('分片合并完成')
    load()
  }

  return (
    <div>
      <EndpointAlert groups={['文件']} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="业务类型" style={{ width: 140 }} options={[{ value: 'common', label: 'common' }, { value: 'product', label: 'product' }, { value: 'notice', label: 'notice' }, { value: 'chunk', label: 'chunk' }]} onChange={(bizType) => setQuery({ ...query, bizType, page: 1 })} />
        <Upload showUploadList={false} customRequest={async ({ file, onSuccess }) => { await api.uploadFile(file as File, 'common'); onSuccess?.({}); load() }}>
          <Button type="primary">普通上传</Button>
        </Upload>
        <Upload showUploadList={false} customRequest={async ({ file, onSuccess }) => { await chunkUpload(file as File); onSuccess?.({}) }}>
          <Button>分片上传</Button>
        </Upload>
        <Button disabled={!uploadId} onClick={async () => { await api.abortUpload(uploadId); setUploadId(''); setPercent(0); message.info('已取消上传任务') }}>取消当前分片</Button>
      </Space>
      {percent > 0 && <Progress percent={percent} style={{ maxWidth: 360, marginBottom: 12 }} />}
      <Table
        rowKey="id"
        dataSource={data.list}
        pagination={{ current: data.page, total: data.total, onChange: (page, pageSize) => setQuery({ ...query, page, pageSize }) }}
        columns={[
          { title: '文件名', dataIndex: 'name' },
          { title: '大小', dataIndex: 'size' },
          { title: '类型', dataIndex: 'bizType' },
          { title: '时间', dataIndex: 'createdAt', render: formatTime },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={async () => { await api.file(row.id); message.info(`${row.name} · ${row.mime || '未知类型'}`) }}>详情</Button>
                <Button type="link" onClick={async () => { const file = await api.downloadFile(row.id); downloadBlob(file.blob, filenameFromDisposition(file.disposition, row.name)) }}>下载</Button>
                <Button type="link" danger onClick={async () => { await api.deleteFile(row.id); load() }}>删除</Button>
              </Space>
            ),
          },
        ]}
      />
    </div>
  )
}
