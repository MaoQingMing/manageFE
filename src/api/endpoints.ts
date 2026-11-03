export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'WS'

export interface EndpointSpec {
  id: string
  group: string
  method: HttpMethod
  path: string
  summary: string
  practice: string
  auth: boolean
  request: string
  response: string
}

function ep(
  id: string,
  group: string,
  method: HttpMethod,
  path: string,
  summary: string,
  practice: string,
  request = '-',
  response = '见 docs/api.md',
  auth = true,
): EndpointSpec {
  return { id, group, method, path, summary, practice, auth, request, response }
}

export const endpoints: EndpointSpec[] = [
  ep('health', '健康检查', 'GET', '/api/v1/health', '存活探针', '健康检查', '-', '{ status, time }', false),

  ep('captcha', '认证', 'GET', '/api/v1/auth/captcha', '获取图片验证码', '验证码', '-', '{ captchaId, image }', false),
  ep('login', '认证', 'POST', '/api/v1/auth/login', '用户名密码登录', '会话与令牌', '{ username, password, captchaId, captchaCode }', '{ accessToken, refreshToken, expiresIn, user }', false),
  ep('refresh', '认证', 'POST', '/api/v1/auth/refresh', '刷新访问令牌', '令牌轮换', '{ refreshToken }', '{ accessToken, refreshToken, expiresIn }', false),
  ep('logout', '认证', 'POST', '/api/v1/auth/logout', '退出并作废 refresh', '会话作废', '{ refreshToken }', '{}'),
  ep('me', '认证', 'GET', '/api/v1/auth/me', '当前用户、权限和菜单', '身份上下文', '-', 'AuthUser'),
  ep('profile', '认证', 'PUT', '/api/v1/auth/profile', '修改个人资料', '自身资源更新', '{ nickname, email, phone, avatar }', 'AuthUser'),
  ep('password', '认证', 'PUT', '/api/v1/auth/password', '修改密码并踢掉刷新令牌', '凭证更新', '{ oldPassword, newPassword }', '{}'),

  ep('user-list', '用户', 'GET', '/api/v1/users', '用户分页列表', '分页筛选排序', 'keyword,status,deptId,roleId,deleted,page,pageSize,sortField,sortOrder', 'Page<User>'),
  ep('user-get', '用户', 'GET', '/api/v1/users/:id', '用户详情', '详情', '-', 'User'),
  ep('user-create', '用户', 'POST', '/api/v1/users', '创建用户', '创建与校验', '{ username, password, nickname, email, phone, deptId, roleIds, status }', 'User'),
  ep('user-update', '用户', 'PUT', '/api/v1/users/:id', '更新用户', '全量更新', '{ nickname, email, phone, deptId, status }', 'User'),
  ep('user-status', '用户', 'PATCH', '/api/v1/users/:id/status', '启用或禁用', '局部更新', '{ status }', 'User'),
  ep('user-delete', '用户', 'DELETE', '/api/v1/users/:id', '软删除用户', '软删除', '-', '{ id }'),
  ep('user-restore', '用户', 'POST', '/api/v1/users/:id/restore', '从回收站恢复', '恢复', '-', 'User'),
  ep('user-batch', '用户', 'POST', '/api/v1/users/batch-delete', '批量软删除', '批量操作', '{ ids }', '{ deleted }'),
  ep('user-reset', '用户', 'POST', '/api/v1/users/:id/reset-password', '重置密码', '敏感写操作', '{ password }', '{ password }'),
  ep('user-roles', '用户', 'PUT', '/api/v1/users/:id/roles', '覆盖用户角色', '关联覆盖写', '{ roleIds }', 'User'),

  ep('role-list', '角色', 'GET', '/api/v1/roles', '角色分页', '分页', 'keyword,page,pageSize', 'Page<Role>'),
  ep('role-get', '角色', 'GET', '/api/v1/roles/:id', '角色详情', '详情', '-', 'Role'),
  ep('role-create', '角色', 'POST', '/api/v1/roles', '创建角色', '创建', '{ name, code, remark, status }', 'Role'),
  ep('role-update', '角色', 'PUT', '/api/v1/roles/:id', '更新角色', '全量更新', '{ name, remark, status }', 'Role'),
  ep('role-delete', '角色', 'DELETE', '/api/v1/roles/:id', '删除角色', '删除约束', '-', '{ id }'),
  ep('role-perm', '角色', 'PUT', '/api/v1/roles/:id/permissions', '覆盖权限码', '关联覆盖写', '{ permissions }', 'Role'),

  ep('menu-tree', '菜单', 'GET', '/api/v1/menus/tree', '菜单权限树', '树形', '-', 'Menu[]'),
  ep('menu-get', '菜单', 'GET', '/api/v1/menus/:id', '菜单详情', '详情', '-', 'Menu'),
  ep('menu-create', '菜单', 'POST', '/api/v1/menus', '创建菜单或按钮', '树节点创建', '{ parentId, name, path, icon, type, permission, sort, visible }', 'Menu'),
  ep('menu-update', '菜单', 'PUT', '/api/v1/menus/:id', '更新菜单', '全量更新', '同创建', 'Menu'),
  ep('menu-delete', '菜单', 'DELETE', '/api/v1/menus/:id', '删除菜单', '删除约束', '-', '{ id }'),
  ep('menu-sort', '菜单', 'PUT', '/api/v1/menus/sort', '批量更新排序', '排序', '{ items: [{ id, sort }] }', '{ updated }'),

  ep('dept-tree', '部门', 'GET', '/api/v1/departments/tree', '部门树', '树形', '-', 'Dept[]'),
  ep('dept-get', '部门', 'GET', '/api/v1/departments/:id', '部门详情', '详情', '-', 'Dept'),
  ep('dept-create', '部门', 'POST', '/api/v1/departments', '创建部门', '树节点创建', '{ parentId, name, leader, sort, status }', 'Dept'),
  ep('dept-update', '部门', 'PUT', '/api/v1/departments/:id', '更新部门', '全量更新', '同创建', 'Dept'),
  ep('dept-delete', '部门', 'DELETE', '/api/v1/departments/:id', '删除部门', '删除约束', '-', '{ id }'),
  ep('dept-members', '部门', 'GET', '/api/v1/departments/:id/members', '直属成员', '一对多查询', '-', 'User[]'),

  ep('dict-type-list', '字典', 'GET', '/api/v1/dict/types', '字典类型全量', '小数据集全量', 'keyword', '{ list }'),
  ep('dict-type-get', '字典', 'GET', '/api/v1/dict/types/:id', '字典类型详情', '详情', '-', 'DictType'),
  ep('dict-type-create', '字典', 'POST', '/api/v1/dict/types', '创建字典类型', '创建', '{ code, name, remark, status }', 'DictType'),
  ep('dict-type-update', '字典', 'PUT', '/api/v1/dict/types/:id', '更新字典类型', '全量更新', '{ name, remark, status }', 'DictType'),
  ep('dict-type-delete', '字典', 'DELETE', '/api/v1/dict/types/:id', '删除字典类型', '删除约束', '-', '{ id }'),
  ep('dict-item-list', '字典', 'GET', '/api/v1/dict/items', '字典项分页', '分页与外键过滤', 'typeId 或 typeCode,page,pageSize', 'Page<DictItem>'),
  ep('dict-item-create', '字典', 'POST', '/api/v1/dict/items', '创建字典项', '创建', '{ typeId, label, value, sort, status }', 'DictItem'),
  ep('dict-item-update', '字典', 'PUT', '/api/v1/dict/items/:id', '更新字典项', '全量更新', '{ label, value, sort, status }', 'DictItem'),
  ep('dict-item-delete', '字典', 'DELETE', '/api/v1/dict/items/:id', '删除字典项', '删除', '-', '{ id }'),

  ep('audit-list', '审计日志', 'GET', '/api/v1/audit-logs', '操作日志游标分页', '游标分页', 'keyword,resource,operator,cursor,limit', '{ list, nextCursor, hasMore }'),
  ep('audit-get', '审计日志', 'GET', '/api/v1/audit-logs/:id', '日志详情', '详情', '-', 'AuditLog'),

  ep('setting-list', '系统配置', 'GET', '/api/v1/settings', '全部配置', '键值配置', '-', '{ items }'),
  ep('setting-get', '系统配置', 'GET', '/api/v1/settings/:key', '单个配置', '按键读取', '-', 'Setting'),
  ep('setting-put', '系统配置', 'PUT', '/api/v1/settings', '批量创建或更新', '批量 Upsert', '{ items: [{ key, value }] }', '{ items }'),

  ep('cat-tree', '商品分类', 'GET', '/api/v1/categories/tree', '分类树', '树形', '-', 'Category[]'),
  ep('cat-get', '商品分类', 'GET', '/api/v1/categories/:id', '分类详情', '详情', '-', 'Category'),
  ep('cat-create', '商品分类', 'POST', '/api/v1/categories', '创建分类', '树节点创建', '{ parentId, name, sort, status }', 'Category'),
  ep('cat-update', '商品分类', 'PUT', '/api/v1/categories/:id', '更新分类', '全量更新', '{ name, sort, status }', 'Category'),
  ep('cat-delete', '商品分类', 'DELETE', '/api/v1/categories/:id', '删除分类', '删除约束', '-', '{ id }'),
  ep('cat-move', '商品分类', 'PATCH', '/api/v1/categories/:id/move', '移动分类节点', '树移动', '{ parentId, sort }', 'Category'),

  ep('tag-list', '标签', 'GET', '/api/v1/tags', '标签分页', '分页', 'keyword,page,pageSize', 'Page<Tag>'),
  ep('tag-get', '标签', 'GET', '/api/v1/tags/:id', '标签详情', '详情', '-', 'Tag'),
  ep('tag-create', '标签', 'POST', '/api/v1/tags', '创建标签', '创建', '{ name, color }', 'Tag'),
  ep('tag-update', '标签', 'PUT', '/api/v1/tags/:id', '更新标签', '全量更新', '{ name, color }', 'Tag'),
  ep('tag-delete', '标签', 'DELETE', '/api/v1/tags/:id', '删除标签', '删除约束', '-', '{ id }'),

  ep('prod-list', '商品', 'GET', '/api/v1/products', '商品分页', '分页筛选排序', 'keyword,categoryId,status,tagId,minPrice,maxPrice,page,pageSize,sortField,sortOrder', 'Page<Product>'),
  ep('prod-get', '商品', 'GET', '/api/v1/products/:id', '商品详情', '详情', '-', 'Product'),
  ep('prod-create', '商品', 'POST', '/api/v1/products', '创建商品', '创建', '{ name, sku, categoryId, price, stock, status, description, tagIds }', 'Product'),
  ep('prod-update', '商品', 'PUT', '/api/v1/products/:id', '全量更新商品', '乐观锁', '{ name, sku, categoryId, price, stock, status, description, version }', 'Product'),
  ep('prod-patch', '商品', 'PATCH', '/api/v1/products/:id', '局部更新价格库存状态', '局部更新 + 乐观锁', '{ version, price?, stock?, status?, description? }', 'Product'),
  ep('prod-delete', '商品', 'DELETE', '/api/v1/products/:id', '物理删除商品', '物理删除', '-', '{ id }'),
  ep('prod-batch-del', '商品', 'POST', '/api/v1/products/batch-delete', '批量物理删除', '批量操作', '{ ids }', '{ deleted }'),
  ep('prod-batch-status', '商品', 'PATCH', '/api/v1/products/batch-status', '批量上下架', '批量状态', '{ ids, status }', '{ updated }'),
  ep('prod-tags', '商品', 'PUT', '/api/v1/products/:id/tags', '覆盖商品标签', '多对多', '{ tagIds }', 'Product'),
  ep('prod-image-add', '商品', 'POST', '/api/v1/products/:id/images', '上传商品图片', '子资源上传', 'multipart file', 'ProductImage'),
  ep('prod-image-del', '商品', 'DELETE', '/api/v1/products/:id/images/:imageId', '删除商品图片', '嵌套资源', '-', '{ id }'),
  ep('prod-image-sort', '商品', 'PUT', '/api/v1/products/:id/images/sort', '图片排序', '子资源排序', '{ imageIds }', 'ProductImage[]'),
  ep('prod-export', '商品', 'GET', '/api/v1/products/export', '导出 CSV', '导出下载', '与列表相同的筛选', 'CSV 文件流'),
  ep('prod-template', '商品', 'GET', '/api/v1/products/import-template', '下载导入模板', '模板下载', '-', 'CSV 文件流'),
  ep('prod-import', '商品', 'POST', '/api/v1/products/import', '导入 CSV', '导入', 'multipart file', '{ total, success, failed, errors }'),

  ep('cus-list', '客户', 'GET', '/api/v1/customers', '客户分页', '分页筛选', 'keyword,level,status,page,pageSize', 'Page<Customer>'),
  ep('cus-get', '客户', 'GET', '/api/v1/customers/:id', '客户详情', '详情', '-', 'Customer'),
  ep('cus-create', '客户', 'POST', '/api/v1/customers', '创建客户', '创建', '{ name, phone, email, level, status }', 'Customer'),
  ep('cus-update', '客户', 'PUT', '/api/v1/customers/:id', '更新客户', '全量更新', '同创建', 'Customer'),
  ep('cus-delete', '客户', 'DELETE', '/api/v1/customers/:id', '删除客户', '删除约束与级联', '-', '{ id }'),
  ep('addr-list', '客户', 'GET', '/api/v1/customers/:id/addresses', '客户地址列表', '嵌套资源', '-', 'Address[]'),
  ep('addr-create', '客户', 'POST', '/api/v1/customers/:id/addresses', '新增地址', '嵌套资源', '{ receiver, phone, region, detail, isDefault }', 'Address'),
  ep('addr-update', '客户', 'PUT', '/api/v1/customers/:id/addresses/:addrId', '更新地址', '嵌套资源', '同创建', 'Address'),
  ep('addr-delete', '客户', 'DELETE', '/api/v1/customers/:id/addresses/:addrId', '删除地址', '嵌套资源', '-', '{ id }'),
  ep('addr-default', '客户', 'PATCH', '/api/v1/customers/:id/addresses/:addrId/default', '设为默认地址', '默认值切换', '-', 'Address'),

  ep('ord-list', '订单', 'GET', '/api/v1/orders', '订单分页', '分页筛选排序', 'keyword,status,customerId,startTime,endTime,page,pageSize,sortField,sortOrder', 'Page<Order>'),
  ep('ord-get', '订单', 'GET', '/api/v1/orders/:id', '订单详情', '聚合详情', '-', 'Order + items + refunds'),
  ep('ord-create', '订单', 'POST', '/api/v1/orders', '创建订单', '幂等', 'Header Idempotency-Key；body { customerId, remark, items:[{productId,qty}] }', 'Order'),
  ep('ord-item-add', '订单', 'POST', '/api/v1/orders/:id/items', '待支付订单加明细', '嵌套写入', '{ productId, qty }', 'Order'),
  ep('ord-item-patch', '订单', 'PATCH', '/api/v1/orders/:id/items/:itemId', '修改明细数量', '嵌套局部更新', '{ qty }', 'Order'),
  ep('ord-item-del', '订单', 'DELETE', '/api/v1/orders/:id/items/:itemId', '删除明细', '嵌套删除', '-', 'Order'),
  ep('ord-pay', '订单', 'POST', '/api/v1/orders/:id/pay', '支付', '状态机命令', '-', 'Order'),
  ep('ord-ship', '订单', 'POST', '/api/v1/orders/:id/ship', '发货', '状态机命令', '{ carrier, trackingNo }', 'Order'),
  ep('ord-complete', '订单', 'POST', '/api/v1/orders/:id/complete', '确认完成', '状态机命令', '-', 'Order'),
  ep('ord-cancel', '订单', 'POST', '/api/v1/orders/:id/cancel', '取消未支付订单', '状态机命令', '{ reason }', 'Order'),
  ep('ord-timeline', '订单', 'GET', '/api/v1/orders/:id/timeline', '状态轨迹', '流水查询', '-', 'Timeline[]'),
  ep('ord-refund', '订单', 'POST', '/api/v1/orders/:id/refunds', '申请整单退款', '审批流', '{ reason, amount }', 'Refund'),
  ep('ord-refund-ok', '订单', 'POST', '/api/v1/orders/:id/refunds/:refundId/approve', '同意退款', '审批动作', '-', 'Order'),
  ep('ord-refund-no', '订单', 'POST', '/api/v1/orders/:id/refunds/:refundId/reject', '拒绝退款', '审批动作', '{ reason }', 'Order'),
  ep('ord-export', '订单', 'GET', '/api/v1/orders/export', '导出订单 CSV', '导出下载', '与列表相同的筛选', 'CSV 文件流'),

  ep('notice-list', '公告', 'GET', '/api/v1/notices', '公告分页', '分页筛选', 'keyword,status,page,pageSize', 'Page<Notice>'),
  ep('notice-get', '公告', 'GET', '/api/v1/notices/:id', '公告详情', '详情', '-', 'Notice'),
  ep('notice-create', '公告', 'POST', '/api/v1/notices', '创建草稿', '创建', '{ title, content, pinned }', 'Notice'),
  ep('notice-update', '公告', 'PUT', '/api/v1/notices/:id', '更新公告', '全量更新', '{ title, content, pinned }', 'Notice'),
  ep('notice-delete', '公告', 'DELETE', '/api/v1/notices/:id', '删除公告', '级联删除', '-', '{ id }'),
  ep('notice-pub', '公告', 'POST', '/api/v1/notices/:id/publish', '发布', '发布动作', '-', 'Notice'),
  ep('notice-unpub', '公告', 'POST', '/api/v1/notices/:id/unpublish', '撤回为草稿', '发布动作', '-', 'Notice'),

  ep('cmt-list', '评论', 'GET', '/api/v1/notices/:id/comments', '评论树', '两级评论', '-', 'Comment[]'),
  ep('cmt-create', '评论', 'POST', '/api/v1/notices/:id/comments', '发表评论', '嵌套创建', '{ content }', 'Comment'),
  ep('cmt-reply', '评论', 'POST', '/api/v1/comments/:id/replies', '回复顶层评论', '楼中楼', '{ content }', 'Comment'),
  ep('cmt-status', '评论', 'PATCH', '/api/v1/comments/:id/status', '显示或隐藏', '内容审核', '{ status }', 'Comment'),
  ep('cmt-delete', '评论', 'DELETE', '/api/v1/comments/:id', '删除评论及回复', '级联删除', '-', '{ id }'),

  ep('file-upload', '文件', 'POST', '/api/v1/files/upload', '普通上传', 'multipart 上传', 'multipart file, bizType', 'File'),
  ep('file-list', '文件', 'GET', '/api/v1/files', '文件分页', '分页筛选', 'keyword,bizType,page,pageSize', 'Page<File>'),
  ep('file-get', '文件', 'GET', '/api/v1/files/:id', '文件详情', '详情', '-', 'File'),
  ep('file-down', '文件', 'GET', '/api/v1/files/:id/download', '下载文件', '二进制下载', '-', '文件流'),
  ep('file-delete', '文件', 'DELETE', '/api/v1/files/:id', '删除文件', '删除', '-', '{ id }'),
  ep('chunk-init', '文件', 'POST', '/api/v1/files/uploads', '初始化分片上传', '分片上传', '{ filename, size, chunkSize, mime, bizType }', 'UploadSession'),
  ep('chunk-put', '文件', 'PUT', '/api/v1/files/uploads/:uploadId/chunks/:index', '上传单个分片', '分片上传', 'application/octet-stream', '{ uploadId, index, received }'),
  ep('chunk-done', '文件', 'POST', '/api/v1/files/uploads/:uploadId/complete', '合并分片', '分片上传', '-', 'File'),
  ep('chunk-abort', '文件', 'DELETE', '/api/v1/files/uploads/:uploadId', '取消分片任务', '分片上传', '-', '{ uploadId }'),

  ep('ntf-list', '通知', 'GET', '/api/v1/notifications', '站内信分页', '分页筛选', 'read,page,pageSize', 'Page<Notification>'),
  ep('ntf-count', '通知', 'GET', '/api/v1/notifications/unread-count', '未读数', '计数接口', '-', '{ count }'),
  ep('ntf-read', '通知', 'POST', '/api/v1/notifications/:id/read', '标记已读', '状态动作', '-', '{ id, read, unread }'),
  ep('ntf-read-all', '通知', 'POST', '/api/v1/notifications/read-all', '全部已读', '批量状态', '-', '{ unread }'),
  ep('ntf-delete', '通知', 'DELETE', '/api/v1/notifications/:id', '删除站内信', '删除', '-', '{ id }'),

  ep('ws', '实时通道', 'WS', '/ws/notifications', '通知推送', 'WebSocket', 'query token；客户端 ping', 'notification / unread / pong', true),

  ep('dash-overview', '数据看板', 'GET', '/api/v1/dashboard/overview', '总览计数', '聚合统计', '-', 'Overview'),
  ep('dash-trends', '数据看板', 'GET', '/api/v1/dashboard/trends', '订单趋势', '时间序列', 'range=7d|30d', 'TrendPoint[]'),
  ep('dash-rank', '数据看板', 'GET', '/api/v1/dashboard/rankings', '商品与客户排行', '聚合排行', '-', 'Rankings'),
  ep('dash-todos', '数据看板', 'GET', '/api/v1/dashboard/todos', '待办摘要', '聚合统计', '-', 'Todo[]'),
]

export const endpointTotal = endpoints.length

export const endpointGroups = [...new Set(endpoints.map((item) => item.group))]
