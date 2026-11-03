import { bodyOf, type Route } from './context'
import {
  conflict,
  decodeCursor,
  encodeCursor,
  includes,
  invalid,
  notFound,
  nowIso,
  num,
  optionalNum,
  pageOf,
  sortBy,
  text,
  toTree,
} from './kit'
import { db, deptName, nextId, presentUser, roleNames, type DbUser } from './store'

function flag(value: unknown) {
  const parsed = Number(value)
  if (parsed !== 0 && parsed !== 1) throw invalid('状态只能是 0 或 1')
  return parsed
}

function ensureDept(id: number) {
  if (!db.departments.some((item) => item.id === id)) throw invalid('部门不存在')
}

function ensureRoles(ids: number[]) {
  if (!ids.length) throw invalid('至少选择一个角色')
  if (ids.some((id) => !db.roles.some((role) => role.id === id))) throw invalid('角色不存在')
}

function activeUser(id: number) {
  const user = db.users.find((item) => item.id === id)
  if (!user || user.deletedAt) throw notFound('用户不存在')
  return user
}

export const systemRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/api/v1/users',
    auth: true,
    perm: 'system:user:list',
    handle: (ctx) => {
      const { query } = ctx
      let list = db.users.filter((item) => (query.deleted === '1' ? !!item.deletedAt : !item.deletedAt))
      if (query.keyword) {
        list = list.filter((item) => includes(`${item.username}${item.nickname}${item.phone}`, query.keyword))
      }
      const status = optionalNum(query.status)
      if (status !== undefined) list = list.filter((item) => item.status === status)
      const deptId = optionalNum(query.deptId)
      if (deptId) list = list.filter((item) => item.deptId === deptId)
      const roleId = optionalNum(query.roleId)
      if (roleId) list = list.filter((item) => item.roleIds.includes(roleId))
      list = sortBy(list, query.sortField, query.sortOrder)
      const page = pageOf(list, query)
      return { ...page, list: page.list.map(presentUser) }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/users/:id',
    auth: true,
    perm: 'system:user:list',
    handle: (ctx) => presentUser(db.users.find((item) => item.id === num(ctx.params.id, 'id')) || (() => { throw notFound('用户不存在') })()),
  },
  {
    method: 'POST',
    pattern: '/api/v1/users',
    auth: true,
    perm: 'system:user:create',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const username = text(body.username, '用户名', 16)
      if (!/^[a-z][a-z0-9_]{2,15}$/.test(username)) throw invalid('用户名需以小写字母开头，3-16 位')
      if (db.users.some((item) => item.username === username)) throw conflict('用户名已存在')
      const password = String(body.password ?? '')
      if (password.length < 6) throw invalid('密码至少 6 位')
      const roleIds = asIds(body.roleIds)
      ensureRoles(roleIds)
      const deptId = Number(body.deptId)
      ensureDept(deptId)
      const user: DbUser = {
        id: nextId('user'),
        username,
        password,
        nickname: text(body.nickname, '昵称', 32),
        email: String(body.email ?? ''),
        phone: String(body.phone ?? ''),
        avatar: '',
        status: body.status === undefined ? 1 : flag(body.status),
        deptId,
        deptName: deptName(deptId),
        roleIds,
        roleNames: roleNames(roleIds),
        createdAt: nowIso(),
        deletedAt: '',
      }
      db.users.unshift(user)
      return presentUser(user)
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/users/:id',
    auth: true,
    perm: 'system:user:update',
    handle: (ctx) => {
      const user = activeUser(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      const deptId = Number(body.deptId)
      ensureDept(deptId)
      user.nickname = text(body.nickname, '昵称', 32)
      user.email = String(body.email ?? '')
      user.phone = String(body.phone ?? '')
      user.deptId = deptId
      user.status = flag(body.status)
      if (user.id === ctx.user!.id && user.status !== 1) throw invalid('不能禁用自己')
      return presentUser(user)
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/users/:id/status',
    auth: true,
    perm: 'system:user:update',
    handle: (ctx) => {
      const user = activeUser(num(ctx.params.id, 'id'))
      const status = flag(bodyOf(ctx).status)
      if (user.id === ctx.user!.id && status !== 1) throw invalid('不能禁用自己')
      user.status = status
      return presentUser(user)
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/users/:id',
    auth: true,
    perm: 'system:user:delete',
    handle: (ctx) => {
      const user = activeUser(num(ctx.params.id, 'id'))
      if (user.id === ctx.user!.id) throw invalid('不能删除自己')
      if (user.username === 'admin') throw conflict('不能删除超级管理员')
      user.deletedAt = nowIso()
      return { id: user.id }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/users/:id/restore',
    auth: true,
    perm: 'system:user:delete',
    handle: (ctx) => {
      const user = db.users.find((item) => item.id === num(ctx.params.id, 'id'))
      if (!user || !user.deletedAt) throw notFound('回收站中没有该用户')
      user.deletedAt = ''
      return presentUser(user)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/users/batch-delete',
    auth: true,
    perm: 'system:user:delete',
    handle: (ctx) => {
      const ids = asIds(bodyOf(ctx).ids)
      let deleted = 0
      ids.forEach((id) => {
        const user = db.users.find((item) => item.id === id && !item.deletedAt)
        if (!user || user.id === ctx.user!.id || user.username === 'admin') return
        user.deletedAt = nowIso()
        deleted += 1
      })
      return { deleted }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/users/:id/reset-password',
    auth: true,
    perm: 'system:user:update',
    handle: (ctx) => {
      const user = activeUser(num(ctx.params.id, 'id'))
      const password = String(bodyOf(ctx).password ?? '123456')
      if (password.length < 6) throw invalid('密码至少 6 位')
      user.password = password
      db.refreshTokens = db.refreshTokens.filter((item) => item.userId !== user.id)
      return { password }
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/users/:id/roles',
    auth: true,
    perm: 'system:user:update',
    handle: (ctx) => {
      const user = activeUser(num(ctx.params.id, 'id'))
      const roleIds = asIds(bodyOf(ctx).roleIds)
      ensureRoles(roleIds)
      user.roleIds = roleIds
      return presentUser(user)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/roles',
    auth: true,
    perm: 'system:role:list',
    handle: (ctx) => {
      let list = [...db.roles]
      if (ctx.query.keyword) list = list.filter((item) => includes(`${item.name}${item.code}`, ctx.query.keyword))
      const page = pageOf(list, ctx.query)
      return page
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/roles/:id',
    auth: true,
    perm: 'system:role:list',
    handle: (ctx) => {
      const role = db.roles.find((item) => item.id === num(ctx.params.id, 'id'))
      if (!role) throw notFound('角色不存在')
      return role
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/roles',
    auth: true,
    perm: 'system:role:create',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const code = text(body.code, '编码', 32)
      if (!/^[a-z][a-z0-9_]{1,31}$/.test(code)) throw invalid('角色编码需小写字母开头')
      if (db.roles.some((item) => item.code === code)) throw conflict('角色编码已存在')
      const role = {
        id: nextId('role'),
        name: text(body.name, '名称', 32),
        code,
        remark: String(body.remark ?? ''),
        status: body.status === undefined ? 1 : flag(body.status),
        permissions: [] as string[],
        createdAt: nowIso(),
      }
      db.roles.unshift(role)
      return role
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/roles/:id',
    auth: true,
    perm: 'system:role:update',
    handle: (ctx) => {
      const role = mustRole(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      role.name = text(body.name, '名称', 32)
      role.remark = String(body.remark ?? '')
      role.status = flag(body.status)
      return role
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/roles/:id',
    auth: true,
    perm: 'system:role:delete',
    handle: (ctx) => {
      const role = mustRole(num(ctx.params.id, 'id'))
      if (role.code === 'admin') throw conflict('不能删除超级管理员角色')
      if (db.users.some((item) => !item.deletedAt && item.roleIds.includes(role.id))) throw conflict('仍有用户绑定该角色')
      db.roles = db.roles.filter((item) => item.id !== role.id)
      return { id: role.id }
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/roles/:id/permissions',
    auth: true,
    perm: 'system:role:update',
    handle: (ctx) => {
      const role = mustRole(num(ctx.params.id, 'id'))
      if (role.permissions.includes('*')) throw conflict('超级管理员权限不可在此修改')
      const permissions = asStrings(bodyOf(ctx).permissions)
      const known = new Set(db.menus.map((item) => item.permission).filter(Boolean))
      if (permissions.some((code) => !known.has(code))) throw invalid('包含未知权限码')
      role.permissions = [...new Set(permissions)]
      return role
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/menus/tree',
    auth: true,
    perm: 'system:menu:list',
    handle: () => toTree(db.menus),
  },
  {
    method: 'GET',
    pattern: '/api/v1/menus/:id',
    auth: true,
    perm: 'system:menu:list',
    handle: (ctx) => mustMenu(num(ctx.params.id, 'id')),
  },
  {
    method: 'POST',
    pattern: '/api/v1/menus',
    auth: true,
    perm: 'system:menu:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const parentId = Number(body.parentId) || 0
      if (parentId && !db.menus.some((item) => item.id === parentId)) throw invalid('父菜单不存在')
      const item = {
        id: nextId('menu'),
        parentId,
        name: text(body.name, '名称', 32),
        path: String(body.path ?? ''),
        icon: String(body.icon ?? ''),
        type: menuType(body.type),
        permission: String(body.permission ?? ''),
        sort: Number(body.sort) || 0,
        visible: body.visible === undefined ? true : Boolean(body.visible),
      }
      db.menus.push(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/menus/:id',
    auth: true,
    perm: 'system:menu:update',
    handle: (ctx) => {
      const item = mustMenu(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      item.name = text(body.name, '名称', 32)
      item.path = String(body.path ?? '')
      item.icon = String(body.icon ?? '')
      item.type = menuType(body.type)
      item.permission = String(body.permission ?? '')
      item.sort = Number(body.sort) || 0
      item.visible = Boolean(body.visible)
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/menus/:id',
    auth: true,
    perm: 'system:menu:update',
    handle: (ctx) => {
      const item = mustMenu(num(ctx.params.id, 'id'))
      if (db.menus.some((menu) => menu.parentId === item.id)) throw conflict('请先删除子节点')
      db.menus = db.menus.filter((menu) => menu.id !== item.id)
      return { id: item.id }
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/menus/sort',
    auth: true,
    perm: 'system:menu:update',
    handle: (ctx) => {
      const items = Array.isArray(bodyOf(ctx).items) ? (bodyOf(ctx).items as { id: number; sort: number }[]) : []
      if (!items.length) throw invalid('排序项不能为空')
      items.forEach((entry) => {
        const menu = mustMenu(Number(entry.id))
        menu.sort = Number(entry.sort) || 0
      })
      return { updated: items.length }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/departments/tree',
    auth: true,
    perm: 'system:dept:list',
    handle: () => toTree(db.departments),
  },
  {
    method: 'GET',
    pattern: '/api/v1/departments/:id',
    auth: true,
    perm: 'system:dept:list',
    handle: (ctx) => mustDept(num(ctx.params.id, 'id')),
  },
  {
    method: 'POST',
    pattern: '/api/v1/departments',
    auth: true,
    perm: 'system:dept:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const parentId = Number(body.parentId) || 0
      if (parentId && !db.departments.some((item) => item.id === parentId)) throw invalid('父部门不存在')
      const item = {
        id: nextId('dept'),
        parentId,
        name: text(body.name, '名称', 32),
        leader: String(body.leader ?? ''),
        sort: Number(body.sort) || 0,
        status: body.status === undefined ? 1 : flag(body.status),
      }
      db.departments.push(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/departments/:id',
    auth: true,
    perm: 'system:dept:update',
    handle: (ctx) => {
      const item = mustDept(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      item.name = text(body.name, '名称', 32)
      item.leader = String(body.leader ?? '')
      item.sort = Number(body.sort) || 0
      item.status = flag(body.status)
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/departments/:id',
    auth: true,
    perm: 'system:dept:update',
    handle: (ctx) => {
      const item = mustDept(num(ctx.params.id, 'id'))
      if (db.departments.some((dept) => dept.parentId === item.id)) throw conflict('请先删除子部门')
      if (db.users.some((user) => !user.deletedAt && user.deptId === item.id)) throw conflict('部门下仍有成员')
      db.departments = db.departments.filter((dept) => dept.id !== item.id)
      return { id: item.id }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/departments/:id/members',
    auth: true,
    perm: 'system:dept:list',
    handle: (ctx) => {
      const dept = mustDept(num(ctx.params.id, 'id'))
      return db.users.filter((user) => !user.deletedAt && user.deptId === dept.id).map(presentUser)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/dict/types',
    auth: true,
    perm: 'system:dict:list',
    handle: (ctx) => {
      let list = [...db.dictTypes]
      if (ctx.query.keyword) list = list.filter((item) => includes(`${item.name}${item.code}`, ctx.query.keyword))
      return { list }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/dict/types/:id',
    auth: true,
    perm: 'system:dict:list',
    handle: (ctx) => mustDictType(num(ctx.params.id, 'id')),
  },
  {
    method: 'POST',
    pattern: '/api/v1/dict/types',
    auth: true,
    perm: 'system:dict:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const code = text(body.code, '编码', 64)
      if (db.dictTypes.some((item) => item.code === code)) throw conflict('字典编码已存在')
      const item = { id: nextId('dictType'), code, name: text(body.name, '名称', 32), remark: String(body.remark ?? ''), status: body.status === undefined ? 1 : flag(body.status) }
      db.dictTypes.unshift(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/dict/types/:id',
    auth: true,
    perm: 'system:dict:update',
    handle: (ctx) => {
      const item = mustDictType(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      item.name = text(body.name, '名称', 32)
      item.remark = String(body.remark ?? '')
      item.status = flag(body.status)
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/dict/types/:id',
    auth: true,
    perm: 'system:dict:update',
    handle: (ctx) => {
      const item = mustDictType(num(ctx.params.id, 'id'))
      if (db.dictItems.some((dictItem) => dictItem.typeId === item.id)) throw conflict('请先删除字典项')
      db.dictTypes = db.dictTypes.filter((dictType) => dictType.id !== item.id)
      return { id: item.id }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/dict/items',
    auth: true,
    perm: 'system:dict:list',
    handle: (ctx) => {
      let typeId = optionalNum(ctx.query.typeId)
      if (!typeId && ctx.query.typeCode) {
        typeId = db.dictTypes.find((item) => item.code === ctx.query.typeCode)?.id
        if (!typeId) throw notFound('字典类型不存在')
      }
      if (!typeId) throw invalid('需要 typeId 或 typeCode')
      const page = pageOf(db.dictItems.filter((item) => item.typeId === typeId).sort((a, b) => a.sort - b.sort), ctx.query)
      return page
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/dict/items',
    auth: true,
    perm: 'system:dict:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const typeId = Number(body.typeId)
      mustDictType(typeId)
      const value = text(body.value, '值', 64)
      if (db.dictItems.some((item) => item.typeId === typeId && item.value === value)) throw conflict('字典值已存在')
      const item = { id: nextId('dictItem'), typeId, label: text(body.label, '标签', 32), value, sort: Number(body.sort) || 0, status: body.status === undefined ? 1 : flag(body.status) }
      db.dictItems.push(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/dict/items/:id',
    auth: true,
    perm: 'system:dict:update',
    handle: (ctx) => {
      const item = db.dictItems.find((dictItem) => dictItem.id === num(ctx.params.id, 'id'))
      if (!item) throw notFound('字典项不存在')
      const body = bodyOf(ctx)
      const value = text(body.value, '值', 64)
      if (db.dictItems.some((dictItem) => dictItem.typeId === item.typeId && dictItem.value === value && dictItem.id !== item.id)) {
        throw conflict('字典值已存在')
      }
      item.label = text(body.label, '标签', 32)
      item.value = value
      item.sort = Number(body.sort) || 0
      item.status = flag(body.status)
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/dict/items/:id',
    auth: true,
    perm: 'system:dict:update',
    handle: (ctx) => {
      const id = num(ctx.params.id, 'id')
      if (!db.dictItems.some((item) => item.id === id)) throw notFound('字典项不存在')
      db.dictItems = db.dictItems.filter((item) => item.id !== id)
      return { id }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/audit-logs',
    auth: true,
    perm: 'system:audit:list',
    handle: (ctx) => {
      let list = [...db.audits].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      if (ctx.query.keyword) list = list.filter((item) => includes(`${item.path}${item.detail}${item.action}`, ctx.query.keyword))
      if (ctx.query.resource) list = list.filter((item) => item.resource === ctx.query.resource)
      if (ctx.query.operator) list = list.filter((item) => item.operator === ctx.query.operator)
      if (ctx.query.cursor) {
        const cursor = decodeCursor(ctx.query.cursor)
        list = list.filter((item) => item.createdAt < cursor.createdAt || (item.createdAt === cursor.createdAt && item.id < cursor.id))
      }
      let limit = Number(ctx.query.limit) || 20
      if (limit < 1) limit = 20
      if (limit > 100) limit = 100
      const slice = list.slice(0, limit)
      const last = slice[slice.length - 1]
      const hasMore = list.length > slice.length
      return { list: slice, nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : '', hasMore }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/audit-logs/:id',
    auth: true,
    perm: 'system:audit:list',
    handle: (ctx) => {
      const item = db.audits.find((log) => log.id === num(ctx.params.id, 'id'))
      if (!item) throw notFound('日志不存在')
      return item
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/settings',
    auth: true,
    perm: 'system:setting:list',
    handle: () => ({ items: db.settings }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/settings/:key',
    auth: true,
    perm: 'system:setting:list',
    handle: (ctx) => {
      const item = db.settings.find((setting) => setting.key === decodeURIComponent(ctx.params.key))
      if (!item) throw notFound('配置不存在')
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/settings',
    auth: true,
    perm: 'system:setting:update',
    handle: (ctx) => {
      const items = bodyOf(ctx).items
      if (!Array.isArray(items) || !items.length) throw invalid('items 不能为空')
      items.forEach((entry) => {
        const key = text((entry as { key?: string }).key, 'key', 64)
        if (!/^[a-z][a-z0-9.]*$/.test(key)) throw invalid('key 只允许小写字母、数字和点')
        const value = String((entry as { value?: string }).value ?? '')
        const found = db.settings.find((setting) => setting.key === key)
        if (found) {
          found.value = value
          found.updatedAt = nowIso()
        } else {
          db.settings.push({ key, value, remark: '', updatedAt: nowIso() })
        }
      })
      return { items: db.settings }
    },
  },
]

function asIds(value: unknown) {
  if (!Array.isArray(value)) throw invalid('需要 id 数组')
  return value.map((item) => {
    const id = Number(item)
    if (!Number.isInteger(id) || id <= 0) throw invalid('id 非法')
    return id
  })
}

function asStrings(value: unknown) {
  if (!Array.isArray(value)) throw invalid('需要字符串数组')
  return value.map((item) => String(item))
}

function mustRole(id: number) {
  const role = db.roles.find((item) => item.id === id)
  if (!role) throw notFound('角色不存在')
  return role
}

function mustMenu(id: number) {
  const menu = db.menus.find((item) => item.id === id)
  if (!menu) throw notFound('菜单不存在')
  return menu
}

function mustDept(id: number) {
  const dept = db.departments.find((item) => item.id === id)
  if (!dept) throw notFound('部门不存在')
  return dept
}

function mustDictType(id: number) {
  const item = db.dictTypes.find((dictType) => dictType.id === id)
  if (!item) throw notFound('字典类型不存在')
  return item
}

function menuType(value: unknown): 'dir' | 'menu' | 'button' {
  if (value !== 'dir' && value !== 'menu' && value !== 'button') throw invalid('菜单类型非法')
  return value
}
