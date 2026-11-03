import { bodyOf, fileResult, type Route } from './context'
import { conflict, includes, invalid, notFound, nowIso, num, pageOf, text, uuid } from './kit'
import { db, nextId, type DbComment, type DbFile } from './store'

function mustNotice(id: number) {
  const item = db.notices.find((notice) => notice.id === id)
  if (!item) throw notFound('公告不存在')
  return item
}

function mustComment(id: number) {
  const item = db.comments.find((comment) => comment.id === id)
  if (!item) throw notFound('评论不存在')
  return item
}

function mustFile(id: number) {
  const item = db.files.find((file) => file.id === id)
  if (!item) throw notFound('文件不存在')
  return item
}

function maxBytes() {
  return Number(db.settings.find((item) => item.key === 'upload.maxSizeMB')?.value || 20) * 1024 * 1024
}

function commentTree(noticeId: number) {
  const list = db.comments.filter((item) => item.noticeId === noticeId)
  return list
    .filter((item) => item.parentId === 0)
    .map((item) => ({
      ...item,
      replies: list.filter((reply) => reply.parentId === item.id),
    }))
}

function presentFile(file: DbFile) {
  const { textContent, ...rest } = file
  void textContent
  return rest
}

export const contentRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/api/v1/notices',
    auth: true,
    perm: 'content:notice:list',
    handle: (ctx) => {
      let list = [...db.notices]
      if (ctx.query.keyword) list = list.filter((item) => includes(`${item.title}${item.content}`, ctx.query.keyword))
      if (ctx.query.status) list = list.filter((item) => item.status === ctx.query.status)
      list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
      return pageOf(list, ctx.query)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/notices/:id',
    auth: true,
    perm: 'content:notice:list',
    handle: (ctx) => mustNotice(num(ctx.params.id, 'id')),
  },
  {
    method: 'POST',
    pattern: '/api/v1/notices',
    auth: true,
    perm: 'content:notice:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const item = { id: nextId('notice'), title: text(body.title, '标题', 80), content: text(body.content, '正文', 2000), status: 'draft' as const, pinned: Boolean(body.pinned), createdAt: nowIso(), publishedAt: '' }
      db.notices.unshift(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/notices/:id',
    auth: true,
    perm: 'content:notice:update',
    handle: (ctx) => {
      const item = mustNotice(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      item.title = text(body.title, '标题', 80)
      item.content = text(body.content, '正文', 2000)
      item.pinned = Boolean(body.pinned)
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/notices/:id',
    auth: true,
    perm: 'content:notice:update',
    handle: (ctx) => {
      const item = mustNotice(num(ctx.params.id, 'id'))
      db.notices = db.notices.filter((notice) => notice.id !== item.id)
      db.comments = db.comments.filter((comment) => comment.noticeId !== item.id)
      return { id: item.id }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/notices/:id/publish',
    auth: true,
    perm: 'content:notice:update',
    handle: (ctx) => {
      const item = mustNotice(num(ctx.params.id, 'id'))
      item.status = 'published'
      item.publishedAt = nowIso()
      return item
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/notices/:id/unpublish',
    auth: true,
    perm: 'content:notice:update',
    handle: (ctx) => {
      const item = mustNotice(num(ctx.params.id, 'id'))
      item.status = 'draft'
      return item
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/notices/:id/comments',
    auth: true,
    perm: 'content:notice:list',
    handle: (ctx) => commentTree(mustNotice(num(ctx.params.id, 'id')).id),
  },
  {
    method: 'POST',
    pattern: '/api/v1/notices/:id/comments',
    auth: true,
    perm: 'content:comment:update',
    handle: (ctx) => {
      const notice = mustNotice(num(ctx.params.id, 'id'))
      const item: DbComment = { id: nextId('comment'), noticeId: notice.id, parentId: 0, user: ctx.user!.nickname, content: text(bodyOf(ctx).content, '评论', 500), status: 'visible', createdAt: nowIso() }
      db.comments.push(item)
      return item
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/comments/:id/replies',
    auth: true,
    perm: 'content:comment:update',
    handle: (ctx) => {
      const parent = mustComment(num(ctx.params.id, 'id'))
      if (parent.parentId !== 0) throw invalid('只支持两级评论')
      const item: DbComment = { id: nextId('comment'), noticeId: parent.noticeId, parentId: parent.id, user: ctx.user!.nickname, content: text(bodyOf(ctx).content, '回复', 500), status: 'visible', createdAt: nowIso() }
      db.comments.push(item)
      return item
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/comments/:id/status',
    auth: true,
    perm: 'content:comment:update',
    handle: (ctx) => {
      const item = mustComment(num(ctx.params.id, 'id'))
      const status = bodyOf(ctx).status
      if (status !== 'visible' && status !== 'hidden') throw invalid('评论状态非法')
      item.status = status
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/comments/:id',
    auth: true,
    perm: 'content:comment:update',
    handle: (ctx) => {
      const item = mustComment(num(ctx.params.id, 'id'))
      db.comments = db.comments.filter((comment) => comment.id !== item.id && comment.parentId !== item.id)
      return { id: item.id }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/files/upload',
    auth: true,
    perm: 'content:file:create',
    handle: async (ctx) => {
      if (!(ctx.body instanceof FormData)) throw invalid('请使用 multipart/form-data')
      const file = ctx.body.get('file')
      if (!(file instanceof File)) throw invalid('缺少文件')
      if (file.size > maxBytes()) throw invalid('文件超过大小限制')
      const bizType = String(ctx.body.get('bizType') || 'common')
      const url = file.type.startsWith('image/') ? await dataUrl(file) : ''
      const item: DbFile = { id: nextId('file'), name: file.name, size: file.size, mime: file.type || 'application/octet-stream', bizType, url, textContent: url || `已接收 ${file.name}`, createdAt: nowIso() }
      db.files.unshift(item)
      return presentFile(item)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/files',
    auth: true,
    perm: 'content:file:list',
    handle: (ctx) => {
      let list = [...db.files]
      if (ctx.query.keyword) list = list.filter((item) => includes(item.name, ctx.query.keyword))
      if (ctx.query.bizType) list = list.filter((item) => item.bizType === ctx.query.bizType)
      const page = pageOf(list, ctx.query)
      return { ...page, list: page.list.map(presentFile) }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/files/:id',
    auth: true,
    perm: 'content:file:list',
    handle: (ctx) => presentFile(mustFile(num(ctx.params.id, 'id'))),
  },
  {
    method: 'GET',
    pattern: '/api/v1/files/:id/download',
    auth: true,
    perm: 'content:file:list',
    handle: (ctx) => {
      const file = mustFile(num(ctx.params.id, 'id'))
      return fileResult(new Blob([file.textContent]), file.name, file.mime || 'application/octet-stream')
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/files/:id',
    auth: true,
    perm: 'content:file:create',
    handle: (ctx) => {
      const file = mustFile(num(ctx.params.id, 'id'))
      db.files = db.files.filter((item) => item.id !== file.id)
      return { id: file.id }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/files/uploads',
    auth: true,
    perm: 'content:file:create',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const filename = text(body.filename, '文件名', 120)
      const size = Number(body.size)
      const chunkSize = Number(body.chunkSize)
      if (!Number.isInteger(size) || size <= 0) throw invalid('size 非法')
      if (size > maxBytes()) throw invalid('文件超过大小限制')
      if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 5 * 1024 * 1024) throw invalid('chunkSize 需在 1 字节到 5MB 之间')
      const task = {
        uploadId: uuid(),
        userId: ctx.user!.id,
        filename,
        size,
        mime: String(body.mime || 'application/octet-stream'),
        chunkSize,
        totalChunks: Math.ceil(size / chunkSize),
        bizType: String(body.bizType || 'common'),
        received: [] as number[],
        createdAt: Date.now(),
      }
      db.uploads.push(task)
      return { uploadId: task.uploadId, chunkSize: task.chunkSize, totalChunks: task.totalChunks, filename: task.filename }
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/files/uploads/:uploadId/chunks/:index',
    auth: true,
    perm: 'content:file:create',
    handle: (ctx) => {
      const task = mustUpload(ctx.params.uploadId, ctx.user!.id)
      const index = Number(ctx.params.index)
      if (!Number.isInteger(index) || index < 0 || index >= task.totalChunks) throw invalid('分片序号非法')
      const length = byteLength(ctx.body)
      if (length <= 0) throw invalid('分片为空')
      const expected = index === task.totalChunks - 1 ? task.size - task.chunkSize * index : task.chunkSize
      if (length !== expected) throw invalid(`分片大小应为 ${expected} 字节`)
      if (!task.received.includes(index)) task.received.push(index)
      return { uploadId: task.uploadId, index, received: task.received.length }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/files/uploads/:uploadId/complete',
    auth: true,
    perm: 'content:file:create',
    handle: (ctx) => {
      const task = mustUpload(ctx.params.uploadId, ctx.user!.id)
      if (task.received.length !== task.totalChunks) throw conflict('分片未齐')
      const item: DbFile = {
        id: nextId('file'),
        name: task.filename,
        size: task.size,
        mime: task.mime,
        bizType: task.bizType,
        url: '',
        textContent: `分片合并完成：${task.filename}，共 ${task.totalChunks} 片`,
        createdAt: nowIso(),
      }
      db.files.unshift(item)
      db.uploads = db.uploads.filter((upload) => upload.uploadId !== task.uploadId)
      return presentFile(item)
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/files/uploads/:uploadId',
    auth: true,
    perm: 'content:file:create',
    handle: (ctx) => {
      const task = mustUpload(ctx.params.uploadId, ctx.user!.id)
      db.uploads = db.uploads.filter((upload) => upload.uploadId !== task.uploadId)
      return { uploadId: task.uploadId }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/notifications',
    auth: true,
    handle: (ctx) => {
      let list = [...db.notifications]
      if (ctx.query.read === '1') list = list.filter((item) => item.read)
      if (ctx.query.read === '0') list = list.filter((item) => !item.read)
      return pageOf(list, ctx.query)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/notifications/unread-count',
    auth: true,
    handle: () => ({ count: db.notifications.filter((item) => !item.read).length }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/notifications/:id/read',
    auth: true,
    handle: (ctx) => {
      const item = db.notifications.find((notice) => notice.id === num(ctx.params.id, 'id'))
      if (!item) throw notFound('通知不存在')
      item.read = true
      return { id: item.id, read: true, unread: db.notifications.filter((notice) => !notice.read).length }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/notifications/read-all',
    auth: true,
    handle: () => {
      db.notifications.forEach((item) => {
        item.read = true
      })
      return { unread: 0 }
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/notifications/:id',
    auth: true,
    handle: (ctx) => {
      const id = num(ctx.params.id, 'id')
      if (!db.notifications.some((item) => item.id === id)) throw notFound('通知不存在')
      db.notifications = db.notifications.filter((item) => item.id !== id)
      return { id }
    },
  },
]

function mustUpload(uploadId: string, userId: number) {
  const task = db.uploads.find((item) => item.uploadId === uploadId && item.userId === userId)
  if (!task) throw notFound('上传任务不存在')
  return task
}

function byteLength(body: unknown) {
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (body instanceof Blob) return body.size
  if (typeof body === 'string') return new TextEncoder().encode(body).length
  return 0
}

function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
