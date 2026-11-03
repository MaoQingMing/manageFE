export interface MenuNode {
  id: number
  parentId: number
  name: string
  path: string
  icon: string
  type: 'dir' | 'menu' | 'button'
  permission: string
  sort: number
  visible: boolean
  children?: MenuNode[]
}

export interface AuthUser {
  id: number
  username: string
  nickname: string
  email: string
  phone: string
  avatar: string
  deptId: number
  status: number
  permissions: string[]
  roles: { id: number; name: string; code: string }[]
  menus: MenuNode[]
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface CursorData<T> {
  list: T[]
  nextCursor: string
  hasMore: boolean
}

export interface UserItem {
  id: number
  username: string
  nickname: string
  email: string
  phone: string
  avatar: string
  status: number
  deptId: number
  deptName: string
  roleIds: number[]
  roleNames: string[]
  createdAt: string
  deletedAt: string
}

export interface RoleItem {
  id: number
  name: string
  code: string
  remark: string
  status: number
  permissions: string[]
  createdAt: string
}

export interface DeptNode {
  id: number
  parentId: number
  name: string
  leader: string
  sort: number
  status: number
  children?: DeptNode[]
}

export interface DictType {
  id: number
  code: string
  name: string
  remark: string
  status: number
}

export interface DictItem {
  id: number
  typeId: number
  label: string
  value: string
  sort: number
  status: number
}

export interface AuditLog {
  id: number
  operator: string
  action: string
  resource: string
  method: string
  path: string
  ip: string
  status: number
  detail: string
  createdAt: string
}

export interface SettingItem {
  key: string
  value: string
  remark: string
  updatedAt: string
}

export interface CategoryNode {
  id: number
  parentId: number
  name: string
  sort: number
  status: number
  children?: CategoryNode[]
}

export interface TagItem {
  id: number
  name: string
  color: string
  createdAt: string
}

export interface ProductImage {
  id: number
  url: string
  name: string
  sort: number
}

export interface Product {
  id: number
  name: string
  sku: string
  categoryId: number
  categoryName: string
  price: number
  stock: number
  status: 'draft' | 'on' | 'off'
  description: string
  tagIds: number[]
  tags: { id: number; name: string; color: string }[]
  images: ProductImage[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: number
  name: string
  phone: string
  email: string
  level: string
  status: number
  createdAt: string
}

export interface Address {
  id: number
  customerId: number
  receiver: string
  phone: string
  region: string
  detail: string
  isDefault: boolean
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'refunding'
  | 'refunded'

export interface OrderItem {
  id: number
  productId: number
  name: string
  price: number
  qty: number
}

export interface RefundItem {
  id: number
  orderId: number
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export interface Order {
  id: number
  orderNo: string
  customerId: number
  customerName: string
  status: OrderStatus
  statusBeforeRefund: OrderStatus | ''
  amount: number
  payAmount: number
  freight: number
  remark: string
  carrier: string
  trackingNo: string
  itemCount: number
  items?: OrderItem[]
  refunds?: RefundItem[]
  customer?: { id: number; name: string; phone: string }
  createdAt: string
  updatedAt: string
}

export interface TimelineItem {
  id: number
  orderId: number
  action: string
  remark: string
  operator: string
  createdAt: string
}

export interface Notice {
  id: number
  title: string
  content: string
  status: 'draft' | 'published'
  pinned: boolean
  createdAt: string
  publishedAt: string
}

export interface CommentNode {
  id: number
  noticeId: number
  parentId: number
  user: string
  content: string
  status: 'visible' | 'hidden'
  createdAt: string
  replies?: CommentNode[]
}

export interface FileItem {
  id: number
  name: string
  size: number
  mime: string
  bizType: string
  url: string
  createdAt: string
}

export interface UploadSession {
  uploadId: string
  filename: string
  size: number
  mime: string
  chunkSize: number
  totalChunks: number
  bizType: string
  received: number[]
}

export interface NotificationItem {
  id: number
  title: string
  content: string
  type: string
  read: boolean
  createdAt: string
}

export interface Overview {
  userCount: number
  productCount: number
  orderCount: number
  todayAmount: number
  pendingOrders: number
  refundingOrders: number
  lowStock: number
  unread: number
}

export interface TrendPoint {
  date: string
  orderCount: number
  amount: number
}

export interface Rankings {
  products: { name: string; qty: number; amount: number }[]
  customers: { name: string; amount: number; orderCount: number }[]
}

export interface TodoItem {
  key: string
  title: string
  count: number
  path: string
}

export interface ImportResult {
  total: number
  success: number
  failed: number
  errors: { row: number; message: string }[]
}
