import type {
  Address,
  AuditLog,
  AuthUser,
  CategoryNode,
  CommentNode,
  DeptNode,
  CursorData,
  Customer,
  DictItem,
  DictType,
  FileItem,
  ImportResult,
  LoginResult,
  MenuNode,
  Notice,
  NotificationItem,
  Order,
  Overview,
  PageData,
  Product,
  ProductImage,
  Rankings,
  RefundItem,
  RoleItem,
  SettingItem,
  TagItem,
  TimelineItem,
  TodoItem,
  TrendPoint,
  UploadSession,
  UserItem,
} from '@/types'
import { http } from './http'

async function data<T>(promise: Promise<{ data: { data: T } }>) {
  const response = await promise
  return response.data.data
}

function blobOf(url: string, params?: object) {
  return http.get(url, { params, responseType: 'blob' }).then((response) => ({
    blob: response.data as Blob,
    disposition: response.headers['content-disposition'],
  }))
}

export const api = {
  health: () => data<{ status: string; time: string }>(http.get('/api/v1/health')),
  captcha: () => data<{ captchaId: string; image: string }>(http.get('/api/v1/auth/captcha')),
  login: (body: { username: string; password: string; captchaId: string; captchaCode: string }) =>
    data<LoginResult>(http.post('/api/v1/auth/login', body)),
  logout: (refreshToken: string) => data(http.post('/api/v1/auth/logout', { refreshToken })),
  me: () => data<AuthUser>(http.get('/api/v1/auth/me')),
  updateProfile: (body: { nickname: string; email: string; phone: string; avatar: string }) => data<AuthUser>(http.put('/api/v1/auth/profile', body)),
  updatePassword: (body: { oldPassword: string; newPassword: string }) => data(http.put('/api/v1/auth/password', body)),

  users: (params: object) => data<PageData<UserItem>>(http.get('/api/v1/users', { params })),
  user: (id: number) => data<UserItem>(http.get(`/api/v1/users/${id}`)),
  createUser: (body: object) => data<UserItem>(http.post('/api/v1/users', body)),
  updateUser: (id: number, body: object) => data<UserItem>(http.put(`/api/v1/users/${id}`, body)),
  userStatus: (id: number, status: number) => data<UserItem>(http.patch(`/api/v1/users/${id}/status`, { status })),
  deleteUser: (id: number) => data(http.delete(`/api/v1/users/${id}`)),
  restoreUser: (id: number) => data<UserItem>(http.post(`/api/v1/users/${id}/restore`)),
  batchDeleteUsers: (ids: number[]) => data<{ deleted: number }>(http.post('/api/v1/users/batch-delete', { ids })),
  resetPassword: (id: number, password: string) => data<{ password: string }>(http.post(`/api/v1/users/${id}/reset-password`, { password })),
  userRoles: (id: number, roleIds: number[]) => data<UserItem>(http.put(`/api/v1/users/${id}/roles`, { roleIds })),

  roles: (params: object) => data<PageData<RoleItem>>(http.get('/api/v1/roles', { params })),
  role: (id: number) => data<RoleItem>(http.get(`/api/v1/roles/${id}`)),
  createRole: (body: object) => data<RoleItem>(http.post('/api/v1/roles', body)),
  updateRole: (id: number, body: object) => data<RoleItem>(http.put(`/api/v1/roles/${id}`, body)),
  deleteRole: (id: number) => data(http.delete(`/api/v1/roles/${id}`)),
  rolePermissions: (id: number, permissions: string[]) => data<RoleItem>(http.put(`/api/v1/roles/${id}/permissions`, { permissions })),

  menuTree: () => data<MenuNode[]>(http.get('/api/v1/menus/tree')),
  menu: (id: number) => data<MenuNode>(http.get(`/api/v1/menus/${id}`)),
  createMenu: (body: object) => data<MenuNode>(http.post('/api/v1/menus', body)),
  updateMenu: (id: number, body: object) => data<MenuNode>(http.put(`/api/v1/menus/${id}`, body)),
  deleteMenu: (id: number) => data(http.delete(`/api/v1/menus/${id}`)),
  sortMenus: (items: { id: number; sort: number }[]) => data(http.put('/api/v1/menus/sort', { items })),

  deptTree: () => data<DeptNode[]>(http.get('/api/v1/departments/tree')),
  dept: (id: number) => data<DeptNode>(http.get(`/api/v1/departments/${id}`)),
  createDept: (body: object) => data(http.post('/api/v1/departments', body)),
  updateDept: (id: number, body: object) => data(http.put(`/api/v1/departments/${id}`, body)),
  deleteDept: (id: number) => data(http.delete(`/api/v1/departments/${id}`)),
  deptMembers: (id: number) => data<UserItem[]>(http.get(`/api/v1/departments/${id}/members`)),

  dictTypes: (params?: object) => data<{ list: DictType[] }>(http.get('/api/v1/dict/types', { params })),
  dictType: (id: number) => data<DictType>(http.get(`/api/v1/dict/types/${id}`)),
  createDictType: (body: object) => data<DictType>(http.post('/api/v1/dict/types', body)),
  updateDictType: (id: number, body: object) => data<DictType>(http.put(`/api/v1/dict/types/${id}`, body)),
  deleteDictType: (id: number) => data(http.delete(`/api/v1/dict/types/${id}`)),
  dictItems: (params: object) => data<PageData<DictItem>>(http.get('/api/v1/dict/items', { params })),
  createDictItem: (body: object) => data<DictItem>(http.post('/api/v1/dict/items', body)),
  updateDictItem: (id: number, body: object) => data<DictItem>(http.put(`/api/v1/dict/items/${id}`, body)),
  deleteDictItem: (id: number) => data(http.delete(`/api/v1/dict/items/${id}`)),

  audits: (params: object) => data<CursorData<AuditLog>>(http.get('/api/v1/audit-logs', { params })),
  audit: (id: number) => data<AuditLog>(http.get(`/api/v1/audit-logs/${id}`)),
  settings: () => data<{ items: SettingItem[] }>(http.get('/api/v1/settings')),
  setting: (key: string) => data<SettingItem>(http.get(`/api/v1/settings/${encodeURIComponent(key)}`)),
  saveSettings: (items: { key: string; value: string }[]) => data(http.put('/api/v1/settings', { items })),

  categoryTree: () => data<CategoryNode[]>(http.get('/api/v1/categories/tree')),
  category: (id: number) => data<CategoryNode>(http.get(`/api/v1/categories/${id}`)),
  createCategory: (body: object) => data<CategoryNode>(http.post('/api/v1/categories', body)),
  updateCategory: (id: number, body: object) => data<CategoryNode>(http.put(`/api/v1/categories/${id}`, body)),
  deleteCategory: (id: number) => data(http.delete(`/api/v1/categories/${id}`)),
  moveCategory: (id: number, body: { parentId: number; sort?: number }) => data<CategoryNode>(http.patch(`/api/v1/categories/${id}/move`, body)),

  tags: (params: object) => data<PageData<TagItem>>(http.get('/api/v1/tags', { params })),
  tag: (id: number) => data<TagItem>(http.get(`/api/v1/tags/${id}`)),
  createTag: (body: object) => data<TagItem>(http.post('/api/v1/tags', body)),
  updateTag: (id: number, body: object) => data<TagItem>(http.put(`/api/v1/tags/${id}`, body)),
  deleteTag: (id: number) => data(http.delete(`/api/v1/tags/${id}`)),

  products: (params: object) => data<PageData<Product>>(http.get('/api/v1/products', { params })),
  product: (id: number) => data<Product>(http.get(`/api/v1/products/${id}`)),
  createProduct: (body: object) => data<Product>(http.post('/api/v1/products', body)),
  updateProduct: (id: number, body: object) => data<Product>(http.put(`/api/v1/products/${id}`, body)),
  patchProduct: (id: number, body: object) => data<Product>(http.patch(`/api/v1/products/${id}`, body)),
  deleteProduct: (id: number) => data(http.delete(`/api/v1/products/${id}`)),
  batchDeleteProducts: (ids: number[]) => data<{ deleted: number }>(http.post('/api/v1/products/batch-delete', { ids })),
  batchProductStatus: (ids: number[], status: string) => data(http.patch('/api/v1/products/batch-status', { ids, status })),
  productTags: (id: number, tagIds: number[]) => data<Product>(http.put(`/api/v1/products/${id}/tags`, { tagIds })),
  uploadProductImage: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return data<ProductImage>(http.post(`/api/v1/products/${id}/images`, form))
  },
  deleteProductImage: (id: number, imageId: number) => data(http.delete(`/api/v1/products/${id}/images/${imageId}`)),
  sortProductImages: (id: number, imageIds: number[]) => data<ProductImage[]>(http.put(`/api/v1/products/${id}/images/sort`, { imageIds })),
  exportProducts: (params: object) => blobOf('/api/v1/products/export', params),
  productTemplate: () => blobOf('/api/v1/products/import-template'),
  importProducts: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return data<ImportResult>(http.post('/api/v1/products/import', form))
  },

  customers: (params: object) => data<PageData<Customer>>(http.get('/api/v1/customers', { params })),
  customer: (id: number) => data<Customer>(http.get(`/api/v1/customers/${id}`)),
  createCustomer: (body: object) => data<Customer>(http.post('/api/v1/customers', body)),
  updateCustomer: (id: number, body: object) => data<Customer>(http.put(`/api/v1/customers/${id}`, body)),
  deleteCustomer: (id: number) => data(http.delete(`/api/v1/customers/${id}`)),
  addresses: (id: number) => data<Address[]>(http.get(`/api/v1/customers/${id}/addresses`)),
  createAddress: (id: number, body: object) => data<Address>(http.post(`/api/v1/customers/${id}/addresses`, body)),
  updateAddress: (id: number, addrId: number, body: object) => data<Address>(http.put(`/api/v1/customers/${id}/addresses/${addrId}`, body)),
  deleteAddress: (id: number, addrId: number) => data(http.delete(`/api/v1/customers/${id}/addresses/${addrId}`)),
  defaultAddress: (id: number, addrId: number) => data<Address>(http.patch(`/api/v1/customers/${id}/addresses/${addrId}/default`)),

  orders: (params: object) => data<PageData<Order>>(http.get('/api/v1/orders', { params })),
  order: (id: number) => data<Order>(http.get(`/api/v1/orders/${id}`)),
  createOrder: async (body: object, idempotencyKey: string) => {
    const response = await http.post('/api/v1/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } })
    return { order: response.data.data as Order, replayed: String(response.headers['idempotency-replayed'] || '') === 'true' }
  },
  addOrderItem: (id: number, body: object) => data<Order>(http.post(`/api/v1/orders/${id}/items`, body)),
  patchOrderItem: (id: number, itemId: number, qty: number) => data<Order>(http.patch(`/api/v1/orders/${id}/items/${itemId}`, { qty })),
  deleteOrderItem: (id: number, itemId: number) => data<Order>(http.delete(`/api/v1/orders/${id}/items/${itemId}`)),
  payOrder: (id: number) => data<Order>(http.post(`/api/v1/orders/${id}/pay`)),
  shipOrder: (id: number, body: { carrier: string; trackingNo: string }) => data<Order>(http.post(`/api/v1/orders/${id}/ship`, body)),
  completeOrder: (id: number) => data<Order>(http.post(`/api/v1/orders/${id}/complete`)),
  cancelOrder: (id: number, reason: string) => data<Order>(http.post(`/api/v1/orders/${id}/cancel`, { reason })),
  timeline: (id: number) => data<TimelineItem[]>(http.get(`/api/v1/orders/${id}/timeline`)),
  refundOrder: (id: number, body: { reason: string; amount: number }) => data<RefundItem>(http.post(`/api/v1/orders/${id}/refunds`, body)),
  approveRefund: (id: number, refundId: number) => data<Order>(http.post(`/api/v1/orders/${id}/refunds/${refundId}/approve`)),
  rejectRefund: (id: number, refundId: number, reason: string) => data<Order>(http.post(`/api/v1/orders/${id}/refunds/${refundId}/reject`, { reason })),
  exportOrders: (params: object) => blobOf('/api/v1/orders/export', params),

  notices: (params: object) => data<PageData<Notice>>(http.get('/api/v1/notices', { params })),
  notice: (id: number) => data<Notice>(http.get(`/api/v1/notices/${id}`)),
  createNotice: (body: object) => data<Notice>(http.post('/api/v1/notices', body)),
  updateNotice: (id: number, body: object) => data<Notice>(http.put(`/api/v1/notices/${id}`, body)),
  deleteNotice: (id: number) => data(http.delete(`/api/v1/notices/${id}`)),
  publishNotice: (id: number) => data<Notice>(http.post(`/api/v1/notices/${id}/publish`)),
  unpublishNotice: (id: number) => data<Notice>(http.post(`/api/v1/notices/${id}/unpublish`)),
  comments: (id: number) => data<CommentNode[]>(http.get(`/api/v1/notices/${id}/comments`)),
  createComment: (id: number, content: string) => data<CommentNode>(http.post(`/api/v1/notices/${id}/comments`, { content })),
  replyComment: (id: number, content: string) => data<CommentNode>(http.post(`/api/v1/comments/${id}/replies`, { content })),
  commentStatus: (id: number, status: 'visible' | 'hidden') => data<CommentNode>(http.patch(`/api/v1/comments/${id}/status`, { status })),
  deleteComment: (id: number) => data(http.delete(`/api/v1/comments/${id}`)),

  uploadFile: (file: File, bizType: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('bizType', bizType)
    return data<FileItem>(http.post('/api/v1/files/upload', form))
  },
  files: (params: object) => data<PageData<FileItem>>(http.get('/api/v1/files', { params })),
  file: (id: number) => data<FileItem>(http.get(`/api/v1/files/${id}`)),
  downloadFile: (id: number) => blobOf(`/api/v1/files/${id}/download`),
  deleteFile: (id: number) => data(http.delete(`/api/v1/files/${id}`)),
  initUpload: (body: { filename: string; size: number; chunkSize: number; mime: string; bizType: string }) =>
    data<UploadSession>(http.post('/api/v1/files/uploads', body)),
  putChunk: (uploadId: string, index: number, chunk: ArrayBuffer) =>
    data<{ received: number }>(
      http.put(`/api/v1/files/uploads/${uploadId}/chunks/${index}`, chunk, {
        headers: { 'Content-Type': 'application/octet-stream' },
        transformRequest: [(payload) => payload],
      }),
    ),
  completeUpload: (uploadId: string) => data<FileItem>(http.post(`/api/v1/files/uploads/${uploadId}/complete`)),
  abortUpload: (uploadId: string) => data(http.delete(`/api/v1/files/uploads/${uploadId}`)),

  notifications: (params: object) => data<PageData<NotificationItem>>(http.get('/api/v1/notifications', { params })),
  unreadCount: () => data<{ count: number }>(http.get('/api/v1/notifications/unread-count')),
  readNotification: (id: number) => data<{ unread: number }>(http.post(`/api/v1/notifications/${id}/read`)),
  readAllNotifications: () => data<{ unread: number }>(http.post('/api/v1/notifications/read-all')),
  deleteNotification: (id: number) => data(http.delete(`/api/v1/notifications/${id}`)),

  overview: () => data<Overview>(http.get('/api/v1/dashboard/overview')),
  trends: (range: string) => data<TrendPoint[]>(http.get('/api/v1/dashboard/trends', { params: { range } })),
  rankings: () => data<Rankings>(http.get('/api/v1/dashboard/rankings')),
  todos: () => data<TodoItem[]>(http.get('/api/v1/dashboard/todos')),
}
