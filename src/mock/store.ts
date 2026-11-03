import type {
  Address,
  AuditLog,
  AuthUser,
  CategoryNode,
  CommentNode,
  Customer,
  DictItem,
  DictType,
  FileItem,
  MenuNode,
  Notice,
  NotificationItem,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductImage,
  RefundItem,
  RoleItem,
  TagItem,
  TimelineItem,
  UserItem,
} from '@/types'
import { can, captchaImage, daysAgo, nowIso, svgData, toTree, uuid } from './kit'

export interface DbUser extends UserItem {
  password: string
  roleIds: number[]
}

export interface DbRole extends RoleItem {
  permissions: string[]
}

export interface DbDept {
  id: number
  parentId: number
  name: string
  leader: string
  sort: number
  status: number
}

export interface DbCategory {
  id: number
  parentId: number
  name: string
  sort: number
  status: number
}

export interface DbProduct extends Product {
  images: ProductImage[]
}

export interface DbOrder extends Order {
  items: OrderItem[]
  refunds: RefundItem[]
}

export interface DbComment extends CommentNode {
  replies?: undefined
}

export interface DbFile extends FileItem {
  textContent: string
}

export interface RefreshToken {
  id: string
  userId: number
  expiresAt: number
}

export interface Captcha {
  id: string
  code: string
  expiresAt: number
}

export interface IdemRecord {
  userId: number
  hash: string
  orderId: number
  expiresAt: number
}

export interface UploadTask {
  uploadId: string
  userId: number
  filename: string
  size: number
  mime: string
  chunkSize: number
  totalChunks: number
  bizType: string
  received: number[]
  createdAt: number
}

const seq: Record<string, number> = {}

export function nextId(key: string) {
  seq[key] = (seq[key] ?? 100) + 1
  return seq[key]
}

function menu(
  id: number,
  parentId: number,
  name: string,
  path: string,
  icon: string,
  type: MenuNode['type'],
  permission: string,
  sort: number,
): MenuNode {
  return { id, parentId, name, path, icon, type, permission, sort, visible: true }
}

const menus: MenuNode[] = [
  menu(1, 0, '工作台', '/dashboard', 'DashboardOutlined', 'menu', 'dashboard:view', 1),
  menu(10, 0, '系统管理', '/system', 'SettingOutlined', 'dir', '', 2),
  menu(11, 10, '用户', '/system/users', 'UserOutlined', 'menu', 'system:user:list', 1),
  menu(111, 11, '新建用户', '', '', 'button', 'system:user:create', 1),
  menu(112, 11, '编辑用户', '', '', 'button', 'system:user:update', 2),
  menu(113, 11, '删除用户', '', '', 'button', 'system:user:delete', 3),
  menu(12, 10, '角色', '/system/roles', 'TeamOutlined', 'menu', 'system:role:list', 2),
  menu(121, 12, '新建角色', '', '', 'button', 'system:role:create', 1),
  menu(122, 12, '编辑角色', '', '', 'button', 'system:role:update', 2),
  menu(123, 12, '删除角色', '', '', 'button', 'system:role:delete', 3),
  menu(13, 10, '菜单', '/system/menus', 'ApartmentOutlined', 'menu', 'system:menu:list', 3),
  menu(131, 13, '编辑菜单', '', '', 'button', 'system:menu:update', 1),
  menu(14, 10, '部门', '/system/departments', 'ApartmentOutlined', 'menu', 'system:dept:list', 4),
  menu(141, 14, '编辑部门', '', '', 'button', 'system:dept:update', 1),
  menu(15, 10, '字典', '/system/dicts', 'BookOutlined', 'menu', 'system:dict:list', 5),
  menu(151, 15, '编辑字典', '', '', 'button', 'system:dict:update', 1),
  menu(16, 10, '审计日志', '/system/audits', 'FileSearchOutlined', 'menu', 'system:audit:list', 6),
  menu(17, 10, '系统配置', '/system/settings', 'ToolOutlined', 'menu', 'system:setting:list', 7),
  menu(171, 17, '修改配置', '', '', 'button', 'system:setting:update', 1),
  menu(20, 0, '商品中心', '/catalog', 'ShopOutlined', 'dir', '', 3),
  menu(21, 20, '分类', '/catalog/categories', 'ApartmentOutlined', 'menu', 'catalog:category:list', 1),
  menu(211, 21, '编辑分类', '', '', 'button', 'catalog:category:update', 1),
  menu(22, 20, '标签', '/catalog/tags', 'TagsOutlined', 'menu', 'catalog:tag:list', 2),
  menu(221, 22, '编辑标签', '', '', 'button', 'catalog:tag:update', 1),
  menu(23, 20, '商品', '/catalog/products', 'AppstoreOutlined', 'menu', 'catalog:product:list', 3),
  menu(231, 23, '新建商品', '', '', 'button', 'catalog:product:create', 1),
  menu(232, 23, '编辑商品', '', '', 'button', 'catalog:product:update', 2),
  menu(233, 23, '删除商品', '', '', 'button', 'catalog:product:delete', 3),
  menu(30, 0, '交易中心', '/trade', 'ShoppingOutlined', 'dir', '', 4),
  menu(31, 30, '客户', '/trade/customers', 'UsergroupAddOutlined', 'menu', 'trade:customer:list', 1),
  menu(311, 31, '编辑客户', '', '', 'button', 'trade:customer:update', 1),
  menu(32, 30, '订单', '/trade/orders', 'ShoppingCartOutlined', 'menu', 'trade:order:list', 2),
  menu(321, 32, '创建订单', '', '', 'button', 'trade:order:create', 1),
  menu(322, 32, '订单流转', '', '', 'button', 'trade:order:transition', 2),
  menu(323, 32, '退款审批', '', '', 'button', 'trade:order:refund', 3),
  menu(40, 0, '内容与文件', '/content', 'NotificationOutlined', 'dir', '', 5),
  menu(41, 40, '公告', '/content/notices', 'NotificationOutlined', 'menu', 'content:notice:list', 1),
  menu(411, 41, '编辑公告', '', '', 'button', 'content:notice:update', 1),
  menu(412, 41, '评论管理', '', '', 'button', 'content:comment:update', 2),
  menu(42, 40, '文件', '/content/files', 'FolderOpenOutlined', 'menu', 'content:file:list', 2),
  menu(421, 42, '上传文件', '', '', 'button', 'content:file:create', 1),
  menu(50, 0, '接口实验室', '/lab', 'ApiOutlined', 'menu', '', 6),
]

const roles: DbRole[] = [
  { id: 1, name: '超级管理员', code: 'admin', remark: '拥有全部权限码 *', status: 1, permissions: ['*'], createdAt: daysAgo(40) },
  {
    id: 2,
    name: '运营',
    code: 'ops',
    remark: '商品、订单流转、公告只读',
    status: 1,
    permissions: ['dashboard:view', 'catalog:product:list', 'trade:order:list', 'trade:order:transition', 'content:notice:list'],
    createdAt: daysAgo(30),
  },
  {
    id: 3,
    name: '客服',
    code: 'cs',
    remark: '客户与退款',
    status: 1,
    permissions: ['dashboard:view', 'trade:customer:list', 'trade:customer:update', 'trade:order:list', 'trade:order:refund'],
    createdAt: daysAgo(28),
  },
]

const departments: DbDept[] = [
  { id: 1, parentId: 0, name: '总部', leader: '林知夏', sort: 1, status: 1 },
  { id: 2, parentId: 1, name: '技术部', leader: '周衡', sort: 1, status: 1 },
  { id: 3, parentId: 1, name: '运营部', leader: '陈麦', sort: 2, status: 1 },
  { id: 4, parentId: 2, name: '后端组', leader: '苏晚', sort: 1, status: 1 },
  { id: 5, parentId: 2, name: '前端组', leader: '何清', sort: 2, status: 1 },
]

function user(
  id: number,
  username: string,
  nickname: string,
  deptId: number,
  roleIds: number[],
  password: string,
  status = 1,
  deletedAt = '',
  phone = '',
): DbUser {
  return {
    id,
    username,
    nickname,
    email: `${username}@managefe.local`,
    phone: phone || `1380000${String(id).padStart(4, '0')}`,
    avatar: svgData(nickname.slice(0, 1), '#0f172a'),
    status,
    deptId,
    deptName: '',
    roleIds,
    roleNames: [],
    createdAt: daysAgo(20 - id, id),
    deletedAt,
    password,
  }
}

const users: DbUser[] = [
  user(1, 'admin', '林知夏', 4, [1], 'admin123', 1, '', '13800000001'),
  user(2, 'operator', '陈麦', 3, [2], 'operator123'),
  user(3, 'service', '赵小满', 3, [3], 'service123'),
  user(4, 'staff', '苏晚', 4, [2], '123456'),
  user(5, 'frozen', '停用账号', 5, [2], 'frozen123', 0),
  user(6, 'retired', '已离职', 5, [2], '123456', 1, daysAgo(2)),
  user(7, 'heqing', '何清', 5, [2], '123456'),
  user(8, 'zhouheng', '周衡', 2, [1], '123456'),
  user(9, 'wangke', '王可', 3, [3], '123456'),
  user(10, 'linan', '李楠', 4, [2], '123456'),
  user(11, 'qiao', '乔一', 5, [2], '123456'),
  user(12, 'muchen', '木辰', 3, [3], '123456'),
]

const dictTypes: DictType[] = [
  { id: 1, code: 'customer_level', name: '客户等级', remark: '动态枚举示例', status: 1 },
  { id: 2, code: 'product_status', name: '商品状态', remark: '展示文案，真实约束在代码里', status: 1 },
  { id: 3, code: 'user_status', name: '用户状态', remark: '', status: 1 },
]

const dictItems: DictItem[] = [
  { id: 1, typeId: 1, label: '普通', value: 'normal', sort: 1, status: 1 },
  { id: 2, typeId: 1, label: '银卡', value: 'silver', sort: 2, status: 1 },
  { id: 3, typeId: 1, label: '金卡', value: 'gold', sort: 3, status: 1 },
  { id: 4, typeId: 2, label: '草稿', value: 'draft', sort: 1, status: 1 },
  { id: 5, typeId: 2, label: '在售', value: 'on', sort: 2, status: 1 },
  { id: 6, typeId: 2, label: '下架', value: 'off', sort: 3, status: 1 },
  { id: 7, typeId: 3, label: '启用', value: '1', sort: 1, status: 1 },
  { id: 8, typeId: 3, label: '禁用', value: '0', sort: 2, status: 1 },
]

const categories: DbCategory[] = [
  { id: 1, parentId: 0, name: '数码', sort: 1, status: 1 },
  { id: 2, parentId: 1, name: '手机', sort: 1, status: 1 },
  { id: 3, parentId: 1, name: '配件', sort: 2, status: 1 },
  { id: 4, parentId: 0, name: '家居', sort: 2, status: 1 },
  { id: 5, parentId: 4, name: '灯具', sort: 1, status: 1 },
]

const tags: TagItem[] = [
  { id: 1, name: '新品', color: '#1677ff', createdAt: daysAgo(12) },
  { id: 2, name: '热卖', color: '#f5222d', createdAt: daysAgo(12) },
  { id: 3, name: '包邮', color: '#52c41a', createdAt: daysAgo(11) },
  { id: 4, name: '限时', color: '#fa8c16', createdAt: daysAgo(9) },
]

function product(
  id: number,
  name: string,
  sku: string,
  categoryId: number,
  price: number,
  stock: number,
  status: Product['status'],
  tagIds: number[],
  color: string,
): DbProduct {
  return {
    id,
    name,
    sku,
    categoryId,
    categoryName: '',
    price,
    stock,
    status,
    description: `${name}，用于订单和库存练习。`,
    tagIds,
    tags: [],
    images: [{ id: id * 10, url: svgData(name.slice(0, 2), color), name: `${sku}.svg`, sort: 0 }],
    version: 1,
    createdAt: daysAgo(15 - (id % 10), id),
    updatedAt: daysAgo(3, id),
  }
}

const products: DbProduct[] = [
  product(1, '机械键盘 84 键', 'SKU-KB-84', 3, 39900, 42, 'on', [2, 3], '#334155'),
  product(2, '27 寸显示器', 'SKU-MON-27', 3, 129900, 16, 'on', [2], '#1d4ed8'),
  product(3, 'USB-C 编织线', 'SKU-CBL-01', 3, 2900, 8, 'on', [3], '#0f766e'),
  product(4, '台灯', 'SKU-LAMP-01', 5, 8900, 30, 'on', [1, 3], '#b45309'),
  product(5, '折叠手机', 'SKU-PHONE-01', 2, 699900, 6, 'on', [1, 4], '#7c3aed'),
  product(6, '入门手机', 'SKU-PHONE-02', 2, 199900, 22, 'on', [3], '#0369a1'),
  product(7, '桌面收纳', 'SKU-HOME-01', 4, 4900, 4, 'draft', [1], '#64748b'),
  product(8, '旧款耳机', 'SKU-AUD-OLD', 3, 9900, 0, 'off', [], '#94a3b8'),
  product(9, '移动电源', 'SKU-PWR-01', 3, 14900, 50, 'on', [2, 3], '#be123c'),
  product(10, '显示器支架', 'SKU-MON-ARM', 3, 25900, 18, 'on', [3], '#155e75'),
  product(11, '床头灯', 'SKU-LAMP-02', 5, 6900, 25, 'on', [1], '#c2410c'),
  product(12, '样品机', 'SKU-PHONE-SP', 2, 100, 1, 'draft', [4], '#475569'),
]

const customers: Customer[] = [
  { id: 1, name: '江晚', phone: '13900000001', email: 'jiang@example.com', level: 'gold', status: 1, createdAt: daysAgo(18) },
  { id: 2, name: '宋知', phone: '13900000002', email: 'song@example.com', level: 'silver', status: 1, createdAt: daysAgo(16) },
  { id: 3, name: '许年', phone: '13900000003', email: 'xu@example.com', level: 'normal', status: 1, createdAt: daysAgo(14) },
  { id: 4, name: '北岛', phone: '13900000004', email: 'bei@example.com', level: 'silver', status: 1, createdAt: daysAgo(12) },
  { id: 5, name: '唐糖', phone: '13900000005', email: 'tang@example.com', level: 'gold', status: 1, createdAt: daysAgo(9) },
  { id: 6, name: '顾清', phone: '13900000006', email: 'gu@example.com', level: 'normal', status: 0, createdAt: daysAgo(7) },
  { id: 7, name: '沈星', phone: '13900000007', email: 'shen@example.com', level: 'normal', status: 1, createdAt: daysAgo(5) },
  { id: 8, name: '叶宁', phone: '13900000008', email: 'ye@example.com', level: 'silver', status: 1, createdAt: daysAgo(2) },
]

const addresses: Address[] = [
  { id: 1, customerId: 1, receiver: '江晚', phone: '13900000001', region: '上海市 徐汇区', detail: '龙腾大道 100 号', isDefault: true },
  { id: 2, customerId: 1, receiver: '江晚', phone: '13900000001', region: '杭州市 西湖区', detail: '学院路 18 号', isDefault: false },
  { id: 3, customerId: 2, receiver: '宋知', phone: '13900000002', region: '北京市 朝阳区', detail: '酒仙桥路 8 号', isDefault: true },
  { id: 4, customerId: 3, receiver: '许年', phone: '13900000003', region: '深圳市 南山区', detail: '科技园南路 1 号', isDefault: true },
  { id: 5, customerId: 4, receiver: '北岛', phone: '13900000004', region: '成都市 高新区', detail: '天府大道 66 号', isDefault: true },
  { id: 6, customerId: 5, receiver: '唐糖', phone: '13900000005', region: '南京市 鼓楼区', detail: '中山路 20 号', isDefault: true },
]

function line(id: number, productId: number, qty: number): OrderItem {
  const found = products.find((item) => item.id === productId)!
  return { id, productId, name: found.name, price: found.price, qty }
}

function order(
  id: number,
  orderNo: string,
  customerId: number,
  status: OrderStatus,
  items: OrderItem[],
  extra: Partial<DbOrder> = {},
): DbOrder {
  const customer = customers.find((item) => item.id === customerId)!
  const goods = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  return {
    id,
    orderNo,
    customerId,
    customerName: customer.name,
    status,
    statusBeforeRefund: '',
    amount: goods,
    payAmount: goods,
    freight: 0,
    remark: '',
    carrier: '',
    trackingNo: '',
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    items,
    refunds: [],
    createdAt: daysAgo(id, 2),
    updatedAt: daysAgo(Math.max(0, id - 3), 1),
    ...extra,
  }
}

const orders: DbOrder[] = [
  order(1, 'OD202611010001', 1, 'pending', [line(1, 1, 1), line(2, 3, 2)], { remark: '工作日送达' }),
  order(2, 'OD202611010002', 2, 'paid', [line(3, 2, 1)]),
  order(3, 'OD202611010003', 1, 'shipped', [line(4, 4, 1), line(5, 9, 1)], { carrier: '顺丰', trackingNo: 'SF10086001' }),
  order(4, 'OD202611010004', 3, 'completed', [line(6, 6, 1)]),
  order(5, 'OD202611010005', 4, 'cancelled', [line(7, 10, 1)], { remark: '买家取消' }),
  order(6, 'OD202611010006', 2, 'refunding', [line(8, 5, 1)], { statusBeforeRefund: 'paid' }),
  order(7, 'OD202611010007', 5, 'refunded', [line(9, 11, 2)], { statusBeforeRefund: 'shipped', carrier: '中通', trackingNo: 'ZT200100' }),
  order(8, 'OD202611010008', 5, 'pending', [line(10, 1, 1)]),
  order(9, 'OD202610280009', 7, 'paid', [line(11, 9, 2), line(12, 3, 1)]),
  order(10, 'OD202610200010', 8, 'completed', [line(13, 2, 1)]),
  order(11, 'OD202610150011', 1, 'shipped', [line(14, 6, 1)], { carrier: '京东', trackingNo: 'JD300200' }),
  order(12, 'OD202611020012', 3, 'pending', [line(15, 4, 3)]),
]

orders[5].refunds = [{ id: 1, orderId: 6, amount: orders[5].payAmount, reason: '拍错型号', status: 'pending', createdAt: daysAgo(1) }]
orders[6].refunds = [{ id: 2, orderId: 7, amount: orders[6].payAmount, reason: '灯罩破损', status: 'approved', createdAt: daysAgo(2) }]

const timelines: TimelineItem[] = [
  { id: 1, orderId: 1, action: '创建订单', remark: '', operator: 'admin', createdAt: orders[0].createdAt },
  { id: 2, orderId: 2, action: '创建订单', remark: '', operator: 'operator', createdAt: orders[1].createdAt },
  { id: 3, orderId: 2, action: '支付', remark: '扣减库存', operator: 'operator', createdAt: daysAgo(1, 5) },
  { id: 4, orderId: 3, action: '支付', remark: '', operator: 'admin', createdAt: daysAgo(2, 4) },
  { id: 5, orderId: 3, action: '发货', remark: '顺丰 SF10086001', operator: 'operator', createdAt: daysAgo(1, 3) },
  { id: 6, orderId: 6, action: '申请退款', remark: '拍错型号', operator: 'service', createdAt: daysAgo(1) },
]

const notices: Notice[] = [
  { id: 1, title: '双十一发货时效', content: '11 月 10 日 18:00 前支付的订单，承诺 48 小时内发出。', status: 'published', pinned: true, createdAt: daysAgo(6), publishedAt: daysAgo(6) },
  { id: 2, title: '客服值班调整', content: '本周日客服在线时间改为 10:00-19:00。', status: 'published', pinned: false, createdAt: daysAgo(3), publishedAt: daysAgo(3) },
  { id: 3, title: '新品预告草稿', content: '折叠手机将在下周三上架，先别发布。', status: 'draft', pinned: false, createdAt: daysAgo(1), publishedAt: '' },
]

const comments: DbComment[] = [
  { id: 1, noticeId: 1, parentId: 0, user: '陈麦', content: '仓储那边已经按这个时效排班。', status: 'visible', createdAt: daysAgo(5) },
  { id: 2, noticeId: 1, parentId: 1, user: '林知夏', content: '收到，超时订单单独打标。', status: 'visible', createdAt: daysAgo(5, -2) },
  { id: 3, noticeId: 1, parentId: 0, user: '匿名', content: '这条评论被隐藏，管理端仍可见。', status: 'hidden', createdAt: daysAgo(4) },
  { id: 4, noticeId: 2, parentId: 0, user: '赵小满', content: '周日我来值上午。', status: 'visible', createdAt: daysAgo(2) },
]

const files: DbFile[] = [
  { id: 1, name: '发货说明.txt', size: 128, mime: 'text/plain', bizType: 'common', url: '', textContent: '顺丰默认，偏远地区改中通。', createdAt: daysAgo(4) },
  { id: 2, name: '价目表.csv', size: 256, mime: 'text/csv', bizType: 'product', url: '', textContent: 'sku,price\nSKU-KB-84,39900\n', createdAt: daysAgo(2) },
  { id: 3, name: '封面.svg', size: 420, mime: 'image/svg+xml', bizType: 'notice', url: svgData('封面', '#0f172a'), textContent: 'svg', createdAt: daysAgo(1) },
]

const notifications: NotificationItem[] = [
  { id: 1, title: '有一笔退款待审批', content: '订单 OD202611010006 等待客服处理。', type: 'refund', read: false, createdAt: daysAgo(1) },
  { id: 2, title: '库存预警', content: 'USB-C 编织线库存低于 10。', type: 'stock', read: false, createdAt: daysAgo(0, 5) },
  { id: 3, title: '公告已发布', content: '双十一发货时效已对外发布。', type: 'notice', read: true, createdAt: daysAgo(6) },
  { id: 4, title: '欢迎使用 ManageFE', content: '这是一条已读站内信，用来练习筛选。', type: 'system', read: true, createdAt: daysAgo(8) },
]

const settings = [
  { key: 'site.name', value: 'ManageFE 运营中台', remark: '站点名称', updatedAt: daysAgo(10) },
  { key: 'site.notice', value: '这个前端用来练习 Go 接口', remark: '顶部提示', updatedAt: daysAgo(4) },
  { key: 'order.autoCancelMinutes', value: '30', remark: '未支付自动取消分钟数，练习配置解析', updatedAt: daysAgo(8) },
  { key: 'upload.maxSizeMB', value: '20', remark: '上传大小上限', updatedAt: daysAgo(8) },
  { key: 'feature.refundEnabled', value: 'true', remark: '是否开放退款', updatedAt: daysAgo(3) },
]

const resources = ['user', 'role', 'product', 'order', 'notice', 'file', 'setting']
const audits: AuditLog[] = Array.from({ length: 26 }, (_, index) => ({
  id: index + 1,
  operator: index % 3 === 0 ? 'admin' : index % 3 === 1 ? 'operator' : 'service',
  action: index % 2 === 0 ? '更新' : '创建',
  resource: resources[index % resources.length],
  method: index % 2 === 0 ? 'PUT' : 'POST',
  path: '/api/v1/seed',
  ip: '127.0.0.1',
  status: index === 7 ? 409 : 200,
  detail: index === 7 ? '模拟的版本冲突' : '系统预置日志',
  createdAt: new Date(Date.now() - (26 - index) * 3600 * 1000).toISOString(),
}))

export const db = {
  users,
  roles,
  menus,
  departments,
  dictTypes,
  dictItems,
  categories,
  tags,
  products,
  customers,
  addresses,
  orders,
  timelines,
  notices,
  comments,
  files,
  notifications,
  settings,
  audits,
  refreshTokens: [] as RefreshToken[],
  captchas: [] as Captcha[],
  idempotency: new Map<string, IdemRecord>(),
  uploads: [] as UploadTask[],
}

export function deptName(id: number) {
  return db.departments.find((item) => item.id === id)?.name || '-'
}

export function categoryName(id: number) {
  return db.categories.find((item) => item.id === id)?.name || '-'
}

export function roleNames(ids: number[]) {
  return db.roles.filter((item) => ids.includes(item.id)).map((item) => item.name)
}

export function permissionsOf(user: DbUser) {
  const set = new Set<string>()
  db.roles
    .filter((role) => user.roleIds.includes(role.id) && role.status === 1)
    .forEach((role) => role.permissions.forEach((code) => set.add(code)))
  return [...set]
}

export function presentUser(user: DbUser): UserItem {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    status: user.status,
    deptId: user.deptId,
    deptName: deptName(user.deptId),
    roleIds: [...user.roleIds],
    roleNames: roleNames(user.roleIds),
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
  }
}

export function presentProduct(productItem: DbProduct): Product {
  return {
    ...productItem,
    categoryName: categoryName(productItem.categoryId),
    tags: db.tags.filter((tag) => productItem.tagIds.includes(tag.id)).map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    images: [...productItem.images].sort((a, b) => a.sort - b.sort),
    tagIds: [...productItem.tagIds],
  }
}

export function recalcOrder(orderItem: DbOrder) {
  const goods = orderItem.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  orderItem.amount = goods + orderItem.freight
  orderItem.payAmount = orderItem.amount
  orderItem.itemCount = orderItem.items.reduce((sum, item) => sum + item.qty, 0)
  orderItem.updatedAt = nowIso()
}

export function presentOrder(orderItem: DbOrder, detail = false): Order {
  const customer = db.customers.find((item) => item.id === orderItem.customerId)
  const base: Order = {
    id: orderItem.id,
    orderNo: orderItem.orderNo,
    customerId: orderItem.customerId,
    customerName: orderItem.customerName,
    status: orderItem.status,
    statusBeforeRefund: orderItem.statusBeforeRefund,
    amount: orderItem.amount,
    payAmount: orderItem.payAmount,
    freight: orderItem.freight,
    remark: orderItem.remark,
    carrier: orderItem.carrier,
    trackingNo: orderItem.trackingNo,
    itemCount: orderItem.itemCount,
    createdAt: orderItem.createdAt,
    updatedAt: orderItem.updatedAt,
  }
  if (!detail) return base
  return {
    ...base,
    items: orderItem.items.map((item) => ({ ...item })),
    refunds: orderItem.refunds.map((item) => ({ ...item })),
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : undefined,
  }
}

export function addTimeline(orderId: number, action: string, remark: string, operator: string) {
  db.timelines.push({ id: nextId('timeline'), orderId, action, remark, operator, createdAt: nowIso() })
}

export function issueTokens(userId: number) {
  const accessToken = `access.${userId}.${Math.floor(Date.now() / 1000) + 7200}`
  const id = uuid()
  db.refreshTokens.push({ id, userId, expiresAt: Date.now() + 7 * 86400000 })
  return { accessToken, refreshToken: `refresh.${userId}.${id}`, expiresIn: 7200 }
}

export function revokeRefresh(token: string) {
  const parts = token.split('.')
  if (parts[0] !== 'refresh') return
  db.refreshTokens = db.refreshTokens.filter((item) => item.id !== parts[2])
}

export function pushNotification(partial: Pick<NotificationItem, 'title' | 'content' | 'type'>) {
  const item: NotificationItem = {
    id: nextId('notification'),
    read: false,
    createdAt: nowIso(),
    ...partial,
  }
  db.notifications.unshift(item)
  return item
}

export function unreadCount() {
  return db.notifications.filter((item) => !item.read).length
}

export function writeAudit(entry: Omit<AuditLog, 'id' | 'createdAt' | 'ip'>) {
  db.audits.unshift({
    id: nextId('audit'),
    ip: '127.0.0.1',
    createdAt: nowIso(),
    ...entry,
  })
}

export function createCaptcha() {
  const code = String(Math.floor(1000 + Math.random() * 9000))
  const id = uuid()
  db.captchas.push({ id, code, expiresAt: Date.now() + 120000 })
  db.captchas = db.captchas.filter((item) => item.expiresAt > Date.now()).slice(-20)
  return { captchaId: id, image: captchaImage(code) }
}

export function categoryPlain(item: DbCategory): CategoryNode {
  return { ...item }
}

export function buildSession(user: DbUser): AuthUser {
  const permissions = permissionsOf(user)
  const visible = db.menus.filter(
    (item) => item.visible && item.type !== 'button' && (item.type === 'dir' || can(permissions, item.permission)),
  )
  const prune = (nodes: MenuNode[]): MenuNode[] => {
    const result: MenuNode[] = []
    nodes.forEach((node) => {
      const children = node.children ? prune(node.children) : []
      if (node.type === 'dir' && children.length === 0) return
      const next: MenuNode = { ...node }
      if (children.length) next.children = children
      else delete next.children
      result.push(next)
    })
    return result
  }
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    deptId: user.deptId,
    status: user.status,
    permissions,
    roles: db.roles.filter((role) => user.roleIds.includes(role.id)).map((role) => ({ id: role.id, name: role.name, code: role.code })),
    menus: prune(toTree(visible)),
  }
}
