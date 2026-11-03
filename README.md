# ManageFE

给 Go 后端练习用的运营中台。页面按真实后台来组织，接口故意覆盖分页、树、状态机、乐观锁、幂等、导入导出、分片上传和 WebSocket。

仓库：<https://github.com/MaoQingMing/manageFE.git>

## 先跑起来

```bash
npm install
npm run dev
```

打开 <http://localhost:5173> 。默认 `VITE_USE_MOCK=true`，数据在浏览器内存里，刷新页面会回到初始数据。

| 账号 | 密码 | 能做什么 |
| --- | --- | --- |
| admin | admin123 | 全部权限 |
| operator | operator123 | 工作台、商品列表、订单流转、公告只读 |
| service | service123 | 工作台、客户、退款审批 |
| frozen | frozen123 | 禁用账号，登录返回 40301 |

验证码是图片上的 4 位数字，点图片可刷新。2 分钟有效，一次一用；登录无论成功失败都会作废，失败后自动换图并清空验证码输入。加载验证码时不能提交，加载失败可点刷新重试。

Mock 登录页的「Mock 验证码练习」可以直接制造过期、已使用、加载失败。登录后的「个人资料 → 认证练习」覆盖 Access 过期、并发续期、Refresh 轮换/过期、请求和续期的 HTTP 500/断网。

右下角按钮可以看到最近请求的方法、路径、状态码和业务 code，自动续期前的失败请求与重放请求都会记录；状态码 `0` 表示未收到 HTTP 响应。每个页面顶部列出它对应的接口。完整目录在「接口实验室」。

Mock 的令牌和验证码记录同样在页面内存里：刷新页面会重置，多个标签页不共享。多端登录、持久化会话恢复、禁用账号等跨会话场景需要接真实 BE 验证，不能把多个 Mock 标签页当成同一个服务端。

## 接到你的 Go 服务

1. Go 监听 `:8080`。
2. 把 `.env.development` 里的 `VITE_USE_MOCK` 改成 `false`。
3. 重启 `npm run dev`。Vite 会把 `/api` 和 `/ws` 代理到 `http://localhost:8080`。
4. 不走代理时，把 `VITE_API_BASE` 设成 `http://localhost:8080`，并自己处理 CORS。需要放行 `Authorization`、`Content-Type`、`Idempotency-Key`。

静态部署时，前端路由要回落到 `index.html`。

字段级示例、状态机和分片协议见 [docs/api.md](docs/api.md)。下面这 132 个接口是需要实现的全部范围。认证练习按钮只改变本地 Mock 状态，不增加测试专用 BE 接口。

## 认证必须练通的场景

**BE 必须同时返回约定的 HTTP 状态与业务 code，不要为了让前端续期而把所有错误改成 HTTP 200。** 前端统一处理 Mock 响应和真实 HTTP 错误，保留业务 message/code/traceId；文件下载返回的 JSON 错误同样处理。

| 场景 | 怎么验证 | 预期 |
| --- | --- | --- |
| 正常登录、错误账号/密码、禁用账号 | 登录表单，禁用样例 `frozen` | 成功；错误凭证统一 `40100`；禁用 `40301`。不触发自动续期 |
| 验证码错误、过期、重复使用 | 表单输错；Mock 验证码练习按钮；真实 BE 等 2 分钟或重用同一 captchaId | `40001`；提交后旧验证码作废，自动换图并清空输入 |
| 验证码加载失败 | Mock 登录页按钮；真实 BE 暂停验证码服务 | 明确提示，可刷新重试，没有有效图片时不能提交 |
| Access 过期与并发续期 | Mock「个人资料 → 认证练习」；真实 BE 配短 Access 有效期，过期后同时请求多个受保护接口 | `40101` 后同一页面只发一次 refresh，轮换令牌，原请求各重放一次；延迟到达的旧令牌请求复用新令牌 |
| Refresh 过期、撤销或旧令牌复用 | Mock 过期/轮换按钮；真实 BE 留存旧 refresh 并再次提交 | refresh 返回 `40100`。当前会话自动续期失败则清会话回登录；单独验证旧 refresh 不影响浏览器已保存的新会话 |
| 请求或续期超时、断网、HTTP 500 | Mock 故障按钮；真实 BE 临时停服务 | 不清登录凭证；服务恢复后可重试。初始化加载失败展示「重试」，不冒充密码错误 |
| 只有 Refresh，没有 Access | 真实 BE 登录后只删除浏览器的 `managefe_access`，刷新页面 | 先续期，再加载当前用户，恢复登录态 |
| 登录回跳 | 未登录打开订单详情等内部 URL，再登录 | 返回原路径，保留查询参数与 hash；不接受外部跳转地址 |
| 登录后账号被禁用 | 真实 BE 用管理员会话禁用另一个已登录用户，再让该用户请求接口 | 下一次受保护请求或续期返回 `40301`，前端立即退出登录；普通无权限 `40300` 不退出 |
| 改密码、管理员重置密码 | 改密码；管理员重置另一个用户密码，再使用该用户旧 refresh | 撤销该用户全部 refresh。改密码页面主动退出；已有 Access 可用到过期，除非账号同时被禁用 |
| Access 过期时退出 | 真实 BE 等 Access 过期再退出；或直接调用 logout | logout 用请求体中的 refresh 撤销会话，不要求有效 Access，不先续期；重复退出也成功 |

真实 BE 模式隐藏 Mock 故障按钮，不会篡改 JWT 的签名或过期时间。同一页面的并发续期会合并；多个浏览器标签页的 refresh 竞争不属于此单页合并保证，应单独设计跨标签页协调。

## 本地回归验证

```bash
npm run test:auth
npm run build
```

认证回归使用 Node 内置测试运行器和项目已有 TypeScript，无需新增测试依赖；覆盖真实 HTTP 错误分支、并发续期、失效/临时故障、文件流错误、Mock 验证码与会话规则。

## 数量

**一共 132 个接口：131 个 HTTP + 1 个 WebSocket。**

| 分组 | 数量 | 你要练到的东西 |
| --- | ---: | --- |
| 健康检查 | 1 | 探针、统一响应 |
| 认证 | 7 | 验证码、JWT、refresh 轮换 |
| 用户 | 10 | 分页筛选排序、软删除、批量、关联覆盖 |
| 角色 | 6 | RBAC |
| 菜单 | 6 | 树、排序 |
| 部门 | 6 | 树、一对多 |
| 字典 | 9 | 小表全量 + 子项分页 |
| 审计日志 | 2 | 游标分页 |
| 系统配置 | 3 | 键值、批量 upsert |
| 商品分类 | 6 | 树的移动和防环 |
| 标签 | 5 | 基础 CRUD |
| 商品 | 15 | 乐观锁、多对多、导入导出、子资源 |
| 客户 | 10 | 嵌套地址、默认值切换 |
| 订单 | 15 | 状态机、幂等、库存事务、审批 |
| 公告 | 7 | 草稿 / 发布动作 |
| 评论 | 5 | 两级评论 |
| 文件 | 9 | multipart 与分片上传 |
| 通知 | 5 | 已读状态、计数 |
| 实时通道 | 1 | WebSocket |
| 数据看板 | 4 | 聚合查询 |
| **合计** | **132** | |

## 写接口时先定下的规则

- 成功和失败都返回 JSON 信封：`code`、`message`、`data`、`traceId`。文件流是例外。
- 登录后请求带 `Authorization: Bearer <accessToken>`。
- 金额用分，`int64`，不要用 float。前端按元输入，提交前转成分。
- 用户是软删除，商品是物理删除。两种都要会。
- 静态路径要写在 `/:id` 前面，例如 `/products/export`、`/users/batch-delete`、`/notifications/unread-count`。
- 列表 DTO 和详情 DTO 分开。订单列表不带明细，详情才带 `items`、`refunds`、客户摘要。
- 订单状态用代码枚举。字典只负责「客户等级」这种可配置文案，不要拿字典驱动状态机。
- 写操作记审计日志，密码、验证码、refreshToken 要脱敏。
- 权限码放在角色上。`*` 表示全部。没有权限返回 `40300`。
- 雪花 ID 如果超过 `2^53-1`，JSON 里输出字符串。本练习的示例 ID 都是小整数。

错误码、游标、幂等、乐观锁、分片和 WebSocket 帧见 [docs/api.md](docs/api.md)。

## 业务约束

这些约束前端都会打到，Mock 已经按这个行为返回：

- 用户名、SKU、角色编码、字典编码唯一；字典项的 value 在同一个类型内唯一。
- 不能禁用或删除自己，不能删除 `admin` 用户和 `admin` 角色。
- 有子节点的部门、菜单、分类不能直接删。
- 部门还有直属成员、分类下还有商品、角色还绑着用户、标签还挂在商品上、商品已被订单引用、客户已有订单，都要拒绝删除。
- 删除客户时级联删地址。删除公告时级联删评论。删除顶层评论时带走回复。
- 分类不能移动到自己或自己的子孙下面。
- 客户等级必须是 `customer_level` 字典里的启用项。
- 同一客户只有一个默认地址，切换时要放在一个事务里。
- 被订单引用的商品不能物理删除，应该下架。
- 支付扣库存、订单状态变更放在一个事务里。退款审核通过后回补库存。
- 评论最多两级。管理端看得到隐藏评论。

## 建议的实现顺序

1. 健康检查和统一响应、错误处理、访问日志。
2. 验证码、登录、refresh 轮换、鉴权中间件。
3. 字典、标签这种直线 CRUD。
4. 用户分页，加上筛选、排序、软删除和批量。
5. 部门 / 菜单 / 分类三种树。
6. 角色权限。
7. 商品：version、标签、图片、导入导出。
8. 客户地址。
9. 订单状态机、幂等键、库存。
10. 文件分片。
11. 审计游标和看板聚合。
12. WebSocket。

一个可用的 Go 目录：

```text
cmd/server
internal/handler
internal/service
internal/repo
internal/middleware
internal/pkg/response
```

密码用 bcrypt。Mock 里的明文密码只为了本地登录。

## 接口清单


### 健康检查

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 1 | GET | `/api/v1/health` | 存活探针 | 健康检查 | - |

### 认证

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 2 | GET | `/api/v1/auth/captcha` | 获取图片验证码 | 验证码 | - |
| 3 | POST | `/api/v1/auth/login` | 用户名密码登录 | 会话与令牌 | { username, password, captchaId, captchaCode } |
| 4 | POST | `/api/v1/auth/refresh` | 刷新访问令牌 | 令牌轮换 | { refreshToken } |
| 5 | POST | `/api/v1/auth/logout` | 退出并作废 refresh | 会话作废 | { refreshToken } |
| 6 | GET | `/api/v1/auth/me` | 当前用户、权限和菜单 | 身份上下文 | - |
| 7 | PUT | `/api/v1/auth/profile` | 修改个人资料 | 自身资源更新 | { nickname, email, phone, avatar } |
| 8 | PUT | `/api/v1/auth/password` | 修改密码并踢掉刷新令牌 | 凭证更新 | { oldPassword, newPassword } |

### 用户

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 9 | GET | `/api/v1/users` | 用户分页列表 | 分页筛选排序 | keyword,status,deptId,roleId,deleted,page,pageSize,sortField,sortOrder |
| 10 | GET | `/api/v1/users/:id` | 用户详情 | 详情 | - |
| 11 | POST | `/api/v1/users` | 创建用户 | 创建与校验 | { username, password, nickname, email, phone, deptId, roleIds, status } |
| 12 | PUT | `/api/v1/users/:id` | 更新用户 | 全量更新 | { nickname, email, phone, deptId, status } |
| 13 | PATCH | `/api/v1/users/:id/status` | 启用或禁用 | 局部更新 | { status } |
| 14 | DELETE | `/api/v1/users/:id` | 软删除用户 | 软删除 | - |
| 15 | POST | `/api/v1/users/:id/restore` | 从回收站恢复 | 恢复 | - |
| 16 | POST | `/api/v1/users/batch-delete` | 批量软删除 | 批量操作 | { ids } |
| 17 | POST | `/api/v1/users/:id/reset-password` | 重置密码 | 敏感写操作 | { password } |
| 18 | PUT | `/api/v1/users/:id/roles` | 覆盖用户角色 | 关联覆盖写 | { roleIds } |

### 角色

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 19 | GET | `/api/v1/roles` | 角色分页 | 分页 | keyword,page,pageSize |
| 20 | GET | `/api/v1/roles/:id` | 角色详情 | 详情 | - |
| 21 | POST | `/api/v1/roles` | 创建角色 | 创建 | { name, code, remark, status } |
| 22 | PUT | `/api/v1/roles/:id` | 更新角色 | 全量更新 | { name, remark, status } |
| 23 | DELETE | `/api/v1/roles/:id` | 删除角色 | 删除约束 | - |
| 24 | PUT | `/api/v1/roles/:id/permissions` | 覆盖权限码 | 关联覆盖写 | { permissions } |

### 菜单

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 25 | GET | `/api/v1/menus/tree` | 菜单权限树 | 树形 | - |
| 26 | GET | `/api/v1/menus/:id` | 菜单详情 | 详情 | - |
| 27 | POST | `/api/v1/menus` | 创建菜单或按钮 | 树节点创建 | { parentId, name, path, icon, type, permission, sort, visible } |
| 28 | PUT | `/api/v1/menus/:id` | 更新菜单 | 全量更新 | 同创建 |
| 29 | DELETE | `/api/v1/menus/:id` | 删除菜单 | 删除约束 | - |
| 30 | PUT | `/api/v1/menus/sort` | 批量更新排序 | 排序 | { items: [{ id, sort }] } |

### 部门

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 31 | GET | `/api/v1/departments/tree` | 部门树 | 树形 | - |
| 32 | GET | `/api/v1/departments/:id` | 部门详情 | 详情 | - |
| 33 | POST | `/api/v1/departments` | 创建部门 | 树节点创建 | { parentId, name, leader, sort, status } |
| 34 | PUT | `/api/v1/departments/:id` | 更新部门 | 全量更新 | 同创建 |
| 35 | DELETE | `/api/v1/departments/:id` | 删除部门 | 删除约束 | - |
| 36 | GET | `/api/v1/departments/:id/members` | 直属成员 | 一对多查询 | - |

### 字典

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 37 | GET | `/api/v1/dict/types` | 字典类型全量 | 小数据集全量 | keyword |
| 38 | GET | `/api/v1/dict/types/:id` | 字典类型详情 | 详情 | - |
| 39 | POST | `/api/v1/dict/types` | 创建字典类型 | 创建 | { code, name, remark, status } |
| 40 | PUT | `/api/v1/dict/types/:id` | 更新字典类型 | 全量更新 | { name, remark, status } |
| 41 | DELETE | `/api/v1/dict/types/:id` | 删除字典类型 | 删除约束 | - |
| 42 | GET | `/api/v1/dict/items` | 字典项分页 | 分页与外键过滤 | typeId 或 typeCode,page,pageSize |
| 43 | POST | `/api/v1/dict/items` | 创建字典项 | 创建 | { typeId, label, value, sort, status } |
| 44 | PUT | `/api/v1/dict/items/:id` | 更新字典项 | 全量更新 | { label, value, sort, status } |
| 45 | DELETE | `/api/v1/dict/items/:id` | 删除字典项 | 删除 | - |

### 审计日志

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 46 | GET | `/api/v1/audit-logs` | 操作日志游标分页 | 游标分页 | keyword,resource,operator,cursor,limit |
| 47 | GET | `/api/v1/audit-logs/:id` | 日志详情 | 详情 | - |

### 系统配置

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 48 | GET | `/api/v1/settings` | 全部配置 | 键值配置 | - |
| 49 | GET | `/api/v1/settings/:key` | 单个配置 | 按键读取 | - |
| 50 | PUT | `/api/v1/settings` | 批量创建或更新 | 批量 Upsert | { items: [{ key, value }] } |

### 商品分类

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 51 | GET | `/api/v1/categories/tree` | 分类树 | 树形 | - |
| 52 | GET | `/api/v1/categories/:id` | 分类详情 | 详情 | - |
| 53 | POST | `/api/v1/categories` | 创建分类 | 树节点创建 | { parentId, name, sort, status } |
| 54 | PUT | `/api/v1/categories/:id` | 更新分类 | 全量更新 | { name, sort, status } |
| 55 | DELETE | `/api/v1/categories/:id` | 删除分类 | 删除约束 | - |
| 56 | PATCH | `/api/v1/categories/:id/move` | 移动分类节点 | 树移动 | { parentId, sort } |

### 标签

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 57 | GET | `/api/v1/tags` | 标签分页 | 分页 | keyword,page,pageSize |
| 58 | GET | `/api/v1/tags/:id` | 标签详情 | 详情 | - |
| 59 | POST | `/api/v1/tags` | 创建标签 | 创建 | { name, color } |
| 60 | PUT | `/api/v1/tags/:id` | 更新标签 | 全量更新 | { name, color } |
| 61 | DELETE | `/api/v1/tags/:id` | 删除标签 | 删除约束 | - |

### 商品

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 62 | GET | `/api/v1/products` | 商品分页 | 分页筛选排序 | keyword,categoryId,status,tagId,minPrice,maxPrice,page,pageSize,sortField,sortOrder |
| 63 | GET | `/api/v1/products/:id` | 商品详情 | 详情 | - |
| 64 | POST | `/api/v1/products` | 创建商品 | 创建 | { name, sku, categoryId, price, stock, status, description, tagIds } |
| 65 | PUT | `/api/v1/products/:id` | 全量更新商品 | 乐观锁 | { name, sku, categoryId, price, stock, status, description, version } |
| 66 | PATCH | `/api/v1/products/:id` | 局部更新价格库存状态 | 局部更新 + 乐观锁 | { version, price?, stock?, status?, description? } |
| 67 | DELETE | `/api/v1/products/:id` | 物理删除商品 | 物理删除 | - |
| 68 | POST | `/api/v1/products/batch-delete` | 批量物理删除 | 批量操作 | { ids } |
| 69 | PATCH | `/api/v1/products/batch-status` | 批量上下架 | 批量状态 | { ids, status } |
| 70 | PUT | `/api/v1/products/:id/tags` | 覆盖商品标签 | 多对多 | { tagIds } |
| 71 | POST | `/api/v1/products/:id/images` | 上传商品图片 | 子资源上传 | multipart file |
| 72 | DELETE | `/api/v1/products/:id/images/:imageId` | 删除商品图片 | 嵌套资源 | - |
| 73 | PUT | `/api/v1/products/:id/images/sort` | 图片排序 | 子资源排序 | { imageIds } |
| 74 | GET | `/api/v1/products/export` | 导出 CSV | 导出下载 | 与列表相同的筛选 |
| 75 | GET | `/api/v1/products/import-template` | 下载导入模板 | 模板下载 | - |
| 76 | POST | `/api/v1/products/import` | 导入 CSV | 导入 | multipart file |

### 客户

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 77 | GET | `/api/v1/customers` | 客户分页 | 分页筛选 | keyword,level,status,page,pageSize |
| 78 | GET | `/api/v1/customers/:id` | 客户详情 | 详情 | - |
| 79 | POST | `/api/v1/customers` | 创建客户 | 创建 | { name, phone, email, level, status } |
| 80 | PUT | `/api/v1/customers/:id` | 更新客户 | 全量更新 | 同创建 |
| 81 | DELETE | `/api/v1/customers/:id` | 删除客户 | 删除约束与级联 | - |
| 82 | GET | `/api/v1/customers/:id/addresses` | 客户地址列表 | 嵌套资源 | - |
| 83 | POST | `/api/v1/customers/:id/addresses` | 新增地址 | 嵌套资源 | { receiver, phone, region, detail, isDefault } |
| 84 | PUT | `/api/v1/customers/:id/addresses/:addrId` | 更新地址 | 嵌套资源 | 同创建 |
| 85 | DELETE | `/api/v1/customers/:id/addresses/:addrId` | 删除地址 | 嵌套资源 | - |
| 86 | PATCH | `/api/v1/customers/:id/addresses/:addrId/default` | 设为默认地址 | 默认值切换 | - |

### 订单

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 87 | GET | `/api/v1/orders` | 订单分页 | 分页筛选排序 | keyword,status,customerId,startTime,endTime,page,pageSize,sortField,sortOrder |
| 88 | GET | `/api/v1/orders/:id` | 订单详情 | 聚合详情 | - |
| 89 | POST | `/api/v1/orders` | 创建订单 | 幂等 | Header Idempotency-Key；body { customerId, remark, items:[{productId,qty}] } |
| 90 | POST | `/api/v1/orders/:id/items` | 待支付订单加明细 | 嵌套写入 | { productId, qty } |
| 91 | PATCH | `/api/v1/orders/:id/items/:itemId` | 修改明细数量 | 嵌套局部更新 | { qty } |
| 92 | DELETE | `/api/v1/orders/:id/items/:itemId` | 删除明细 | 嵌套删除 | - |
| 93 | POST | `/api/v1/orders/:id/pay` | 支付 | 状态机命令 | - |
| 94 | POST | `/api/v1/orders/:id/ship` | 发货 | 状态机命令 | { carrier, trackingNo } |
| 95 | POST | `/api/v1/orders/:id/complete` | 确认完成 | 状态机命令 | - |
| 96 | POST | `/api/v1/orders/:id/cancel` | 取消未支付订单 | 状态机命令 | { reason } |
| 97 | GET | `/api/v1/orders/:id/timeline` | 状态轨迹 | 流水查询 | - |
| 98 | POST | `/api/v1/orders/:id/refunds` | 申请整单退款 | 审批流 | { reason, amount } |
| 99 | POST | `/api/v1/orders/:id/refunds/:refundId/approve` | 同意退款 | 审批动作 | - |
| 100 | POST | `/api/v1/orders/:id/refunds/:refundId/reject` | 拒绝退款 | 审批动作 | { reason } |
| 101 | GET | `/api/v1/orders/export` | 导出订单 CSV | 导出下载 | 与列表相同的筛选 |

### 公告

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 102 | GET | `/api/v1/notices` | 公告分页 | 分页筛选 | keyword,status,page,pageSize |
| 103 | GET | `/api/v1/notices/:id` | 公告详情 | 详情 | - |
| 104 | POST | `/api/v1/notices` | 创建草稿 | 创建 | { title, content, pinned } |
| 105 | PUT | `/api/v1/notices/:id` | 更新公告 | 全量更新 | { title, content, pinned } |
| 106 | DELETE | `/api/v1/notices/:id` | 删除公告 | 级联删除 | - |
| 107 | POST | `/api/v1/notices/:id/publish` | 发布 | 发布动作 | - |
| 108 | POST | `/api/v1/notices/:id/unpublish` | 撤回为草稿 | 发布动作 | - |

### 评论

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 109 | GET | `/api/v1/notices/:id/comments` | 评论树 | 两级评论 | - |
| 110 | POST | `/api/v1/notices/:id/comments` | 发表评论 | 嵌套创建 | { content } |
| 111 | POST | `/api/v1/comments/:id/replies` | 回复顶层评论 | 楼中楼 | { content } |
| 112 | PATCH | `/api/v1/comments/:id/status` | 显示或隐藏 | 内容审核 | { status } |
| 113 | DELETE | `/api/v1/comments/:id` | 删除评论及回复 | 级联删除 | - |

### 文件

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 114 | POST | `/api/v1/files/upload` | 普通上传 | multipart 上传 | multipart file, bizType |
| 115 | GET | `/api/v1/files` | 文件分页 | 分页筛选 | keyword,bizType,page,pageSize |
| 116 | GET | `/api/v1/files/:id` | 文件详情 | 详情 | - |
| 117 | GET | `/api/v1/files/:id/download` | 下载文件 | 二进制下载 | - |
| 118 | DELETE | `/api/v1/files/:id` | 删除文件 | 删除 | - |
| 119 | POST | `/api/v1/files/uploads` | 初始化分片上传 | 分片上传 | { filename, size, chunkSize, mime, bizType } |
| 120 | PUT | `/api/v1/files/uploads/:uploadId/chunks/:index` | 上传单个分片 | 分片上传 | application/octet-stream |
| 121 | POST | `/api/v1/files/uploads/:uploadId/complete` | 合并分片 | 分片上传 | - |
| 122 | DELETE | `/api/v1/files/uploads/:uploadId` | 取消分片任务 | 分片上传 | - |

### 通知

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 123 | GET | `/api/v1/notifications` | 站内信分页 | 分页筛选 | read,page,pageSize |
| 124 | GET | `/api/v1/notifications/unread-count` | 未读数 | 计数接口 | - |
| 125 | POST | `/api/v1/notifications/:id/read` | 标记已读 | 状态动作 | - |
| 126 | POST | `/api/v1/notifications/read-all` | 全部已读 | 批量状态 | - |
| 127 | DELETE | `/api/v1/notifications/:id` | 删除站内信 | 删除 | - |

### 实时通道

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 128 | WS | `/ws/notifications` | 通知推送 | WebSocket | query token；客户端 ping |

### 数据看板

| # | 方法 | 路径 | 说明 | 练习点 | 请求要点 |
| --- | --- | --- | --- | --- | --- |
| 129 | GET | `/api/v1/dashboard/overview` | 总览计数 | 聚合统计 | - |
| 130 | GET | `/api/v1/dashboard/trends` | 订单趋势 | 时间序列 | range=7d 或 30d |
| 131 | GET | `/api/v1/dashboard/rankings` | 商品与客户排行 | 聚合排行 | - |
| 132 | GET | `/api/v1/dashboard/todos` | 待办摘要 | 聚合统计 | - |
