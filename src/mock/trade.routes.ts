import { bodyOf, fileResult, header, withHeaders, type Route } from './context'
import { conflict, csv, illegalState, includes, invalid, notFound, nowIso, num, optionalNum, pageOf, sortBy, text } from './kit'
import { addTimeline, db, nextId, presentOrder, recalcOrder, type DbOrder } from './store'

function mustCustomer(id: number) {
  const item = db.customers.find((customer) => customer.id === id)
  if (!item) throw notFound('客户不存在')
  return item
}

function mustOrder(id: number) {
  const item = db.orders.find((order) => order.id === id)
  if (!item) throw notFound('订单不存在')
  return item
}

function levelOf(value: unknown) {
  const level = text(value, '客户等级', 32)
  const type = db.dictTypes.find((item) => item.code === 'customer_level')
  const ok = db.dictItems.some((item) => item.typeId === type?.id && item.value === level && item.status === 1)
  if (!ok) throw invalid('客户等级不在字典中')
  return level
}

function filterOrders(query: Record<string, string>) {
  let list = [...db.orders]
  if (query.keyword) list = list.filter((item) => includes(`${item.orderNo}${item.customerName}`, query.keyword))
  if (query.status) list = list.filter((item) => item.status === query.status)
  const customerId = optionalNum(query.customerId)
  if (customerId) list = list.filter((item) => item.customerId === customerId)
  if (query.startTime) list = list.filter((item) => item.createdAt >= query.startTime)
  if (query.endTime) list = list.filter((item) => item.createdAt <= query.endTime)
  return sortBy(list, query.sortField || 'createdAt', query.sortOrder || 'descend')
}

function assertPending(order: DbOrder) {
  if (order.status !== 'pending') throw illegalState('只有待支付订单可以修改明细')
}

function stockEnough(productId: number, qty: number) {
  const product = db.products.find((item) => item.id === productId)
  if (!product || product.status !== 'on') throw invalid('商品不可售')
  if (product.stock < qty) throw conflict(`${product.name} 库存不足`)
  return product
}

function snapshotItem(productId: number, qty: number) {
  if (!Number.isInteger(qty) || qty <= 0) throw invalid('数量必须是正整数')
  const product = stockEnough(productId, qty)
  return { id: nextId('orderItem'), productId, name: product.name, price: product.price, qty }
}

export const tradeRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/api/v1/customers',
    auth: true,
    perm: 'trade:customer:list',
    handle: (ctx) => {
      let list = [...db.customers]
      if (ctx.query.keyword) list = list.filter((item) => includes(`${item.name}${item.phone}`, ctx.query.keyword))
      if (ctx.query.level) list = list.filter((item) => item.level === ctx.query.level)
      const status = optionalNum(ctx.query.status)
      if (status !== undefined) list = list.filter((item) => item.status === status)
      return pageOf(list, ctx.query)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/customers/:id',
    auth: true,
    perm: 'trade:customer:list',
    handle: (ctx) => mustCustomer(num(ctx.params.id, 'id')),
  },
  {
    method: 'POST',
    pattern: '/api/v1/customers',
    auth: true,
    perm: 'trade:customer:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const item = {
        id: nextId('customer'),
        name: text(body.name, '姓名', 32),
        phone: text(body.phone, '手机', 20),
        email: String(body.email ?? ''),
        level: levelOf(body.level || 'normal'),
        status: Number(body.status) === 0 ? 0 : 1,
        createdAt: nowIso(),
      }
      db.customers.unshift(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/customers/:id',
    auth: true,
    perm: 'trade:customer:update',
    handle: (ctx) => {
      const item = mustCustomer(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      item.name = text(body.name, '姓名', 32)
      item.phone = text(body.phone, '手机', 20)
      item.email = String(body.email ?? '')
      item.level = levelOf(body.level)
      item.status = Number(body.status) === 0 ? 0 : 1
      db.orders.forEach((order) => {
        if (order.customerId === item.id) order.customerName = item.name
      })
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/customers/:id',
    auth: true,
    perm: 'trade:customer:update',
    handle: (ctx) => {
      const item = mustCustomer(num(ctx.params.id, 'id'))
      if (db.orders.some((order) => order.customerId === item.id)) throw conflict('客户已有订单，不能删除')
      db.customers = db.customers.filter((customer) => customer.id !== item.id)
      db.addresses = db.addresses.filter((address) => address.customerId !== item.id)
      return { id: item.id }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/customers/:id/addresses',
    auth: true,
    perm: 'trade:customer:list',
    handle: (ctx) => {
      const customer = mustCustomer(num(ctx.params.id, 'id'))
      return db.addresses.filter((item) => item.customerId === customer.id)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/customers/:id/addresses',
    auth: true,
    perm: 'trade:customer:update',
    handle: (ctx) => {
      const customer = mustCustomer(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      const item = {
        id: nextId('address'),
        customerId: customer.id,
        receiver: text(body.receiver, '收货人', 32),
        phone: text(body.phone, '手机', 20),
        region: text(body.region, '地区', 64),
        detail: text(body.detail, '详细地址', 120),
        isDefault: Boolean(body.isDefault),
      }
      if (item.isDefault || !db.addresses.some((address) => address.customerId === customer.id)) {
        db.addresses.forEach((address) => {
          if (address.customerId === customer.id) address.isDefault = false
        })
        item.isDefault = true
      }
      db.addresses.push(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/customers/:id/addresses/:addrId',
    auth: true,
    perm: 'trade:customer:update',
    handle: (ctx) => {
      const address = mustAddress(num(ctx.params.id, 'id'), num(ctx.params.addrId, 'addrId'))
      const body = bodyOf(ctx)
      address.receiver = text(body.receiver, '收货人', 32)
      address.phone = text(body.phone, '手机', 20)
      address.region = text(body.region, '地区', 64)
      address.detail = text(body.detail, '详细地址', 120)
      if (body.isDefault) markDefault(address.customerId, address.id)
      return address
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/customers/:id/addresses/:addrId',
    auth: true,
    perm: 'trade:customer:update',
    handle: (ctx) => {
      const address = mustAddress(num(ctx.params.id, 'id'), num(ctx.params.addrId, 'addrId'))
      db.addresses = db.addresses.filter((item) => item.id !== address.id)
      if (address.isDefault) {
        const next = db.addresses.find((item) => item.customerId === address.customerId)
        if (next) next.isDefault = true
      }
      return { id: address.id }
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/customers/:id/addresses/:addrId/default',
    auth: true,
    perm: 'trade:customer:update',
    handle: (ctx) => {
      const address = mustAddress(num(ctx.params.id, 'id'), num(ctx.params.addrId, 'addrId'))
      markDefault(address.customerId, address.id)
      return address
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/orders/export',
    auth: true,
    perm: 'trade:order:list',
    handle: (ctx) => {
      const rows = [['orderNo', 'customerName', 'status', 'amount', 'createdAt'], ...filterOrders(ctx.query).map((item) => [item.orderNo, item.customerName, item.status, String(item.amount), item.createdAt])]
      return fileResult(csv(rows), 'orders.csv', 'text/csv;charset=utf-8')
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/orders',
    auth: true,
    perm: 'trade:order:list',
    handle: (ctx) => {
      const page = pageOf(filterOrders(ctx.query), ctx.query)
      return { ...page, list: page.list.map((item) => presentOrder(item)) }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders',
    auth: true,
    perm: 'trade:order:create',
    handle: (ctx) => {
      const key = header(ctx, 'Idempotency-Key')
      if (!key) throw invalid('缺少 Idempotency-Key')
      const hash = JSON.stringify(bodyOf(ctx))
      const slot = `${ctx.user!.id}:${key}`
      const cached = db.idempotency.get(slot)
      if (cached && cached.expiresAt > Date.now()) {
        if (cached.hash !== hash) throw conflict('幂等键已被使用且请求体不同')
        const order = mustOrder(cached.orderId)
        return withHeaders(presentOrder(order, true), { 'idempotency-replayed': 'true' })
      }
      const body = bodyOf(ctx)
      const customer = mustCustomer(Number(body.customerId))
      if (customer.status !== 1) throw invalid('客户已停用')
      const rawItems = body.items
      if (!Array.isArray(rawItems) || !rawItems.length) throw invalid('至少一条商品明细')
      const items = rawItems.map((item) => snapshotItem(Number((item as { productId: number }).productId), Number((item as { qty: number }).qty)))
      const order: DbOrder = {
        id: nextId('order'),
        orderNo: makeOrderNo(),
        customerId: customer.id,
        customerName: customer.name,
        status: 'pending',
        statusBeforeRefund: '',
        amount: 0,
        payAmount: 0,
        freight: 0,
        remark: String(body.remark ?? ''),
        carrier: '',
        trackingNo: '',
        itemCount: 0,
        items,
        refunds: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      recalcOrder(order)
      db.orders.unshift(order)
      addTimeline(order.id, '创建订单', '', ctx.operator)
      db.idempotency.set(slot, { userId: ctx.user!.id, hash, orderId: order.id, expiresAt: Date.now() + 86400000 })
      return presentOrder(order, true)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/orders/:id',
    auth: true,
    perm: 'trade:order:list',
    handle: (ctx) => presentOrder(mustOrder(num(ctx.params.id, 'id')), true),
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders/:id/items',
    auth: true,
    perm: 'trade:order:create',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      assertPending(order)
      const body = bodyOf(ctx)
      order.items.push(snapshotItem(Number(body.productId), Number(body.qty)))
      recalcOrder(order)
      addTimeline(order.id, '新增明细', '', ctx.operator)
      return presentOrder(order, true)
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/orders/:id/items/:itemId',
    auth: true,
    perm: 'trade:order:create',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      assertPending(order)
      const item = order.items.find((line) => line.id === num(ctx.params.itemId, 'itemId'))
      if (!item) throw notFound('明细不存在')
      const qty = Number(bodyOf(ctx).qty)
      stockEnough(item.productId, qty)
      item.qty = qty
      recalcOrder(order)
      addTimeline(order.id, '修改明细', `数量改为 ${qty}`, ctx.operator)
      return presentOrder(order, true)
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/orders/:id/items/:itemId',
    auth: true,
    perm: 'trade:order:create',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      assertPending(order)
      if (order.items.length <= 1) throw invalid('订单至少保留一条明细')
      const itemId = num(ctx.params.itemId, 'itemId')
      if (!order.items.some((item) => item.id === itemId)) throw notFound('明细不存在')
      order.items = order.items.filter((item) => item.id !== itemId)
      recalcOrder(order)
      addTimeline(order.id, '删除明细', '', ctx.operator)
      return presentOrder(order, true)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders/:id/pay',
    auth: true,
    perm: 'trade:order:transition',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      if (order.status !== 'pending') throw illegalState()
      order.items.forEach((item) => stockEnough(item.productId, item.qty))
      order.items.forEach((item) => {
        const product = db.products.find((entry) => entry.id === item.productId)!
        product.stock -= item.qty
        product.version += 1
      })
      order.status = 'paid'
      order.updatedAt = nowIso()
      addTimeline(order.id, '支付', '扣减库存', ctx.operator)
      return presentOrder(order, true)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders/:id/ship',
    auth: true,
    perm: 'trade:order:transition',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      if (order.status !== 'paid') throw illegalState()
      const body = bodyOf(ctx)
      order.carrier = text(body.carrier, '物流公司', 32)
      order.trackingNo = text(body.trackingNo, '运单号', 64)
      order.status = 'shipped'
      order.updatedAt = nowIso()
      addTimeline(order.id, '发货', `${order.carrier} ${order.trackingNo}`, ctx.operator)
      return presentOrder(order, true)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders/:id/complete',
    auth: true,
    perm: 'trade:order:transition',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      if (order.status !== 'shipped') throw illegalState()
      order.status = 'completed'
      order.updatedAt = nowIso()
      addTimeline(order.id, '完成', '', ctx.operator)
      return presentOrder(order, true)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders/:id/cancel',
    auth: true,
    perm: 'trade:order:transition',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      if (order.status !== 'pending') throw illegalState('已支付订单请走退款')
      const reason = text(bodyOf(ctx).reason, '取消原因', 120)
      order.status = 'cancelled'
      order.remark = reason
      order.updatedAt = nowIso()
      addTimeline(order.id, '取消', reason, ctx.operator)
      return presentOrder(order, true)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/orders/:id/timeline',
    auth: true,
    perm: 'trade:order:list',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      return db.timelines.filter((item) => item.orderId === order.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders/:id/refunds',
    auth: true,
    perm: 'trade:order:refund',
    handle: (ctx) => {
      if (db.settings.find((item) => item.key === 'feature.refundEnabled')?.value !== 'true') throw illegalState('退款功能已关闭')
      const order = mustOrder(num(ctx.params.id, 'id'))
      if (order.status !== 'paid' && order.status !== 'shipped') throw illegalState('当前状态不能退款')
      if (order.refunds.some((item) => item.status === 'pending')) throw conflict('已有处理中的退款')
      const body = bodyOf(ctx)
      const amount = Number(body.amount)
      if (amount !== order.payAmount) throw invalid('当前只支持整单退款，金额必须等于实付')
      const refund = { id: nextId('refund'), orderId: order.id, amount, reason: text(body.reason, '原因', 120), status: 'pending' as const, createdAt: nowIso() }
      order.statusBeforeRefund = order.status
      order.status = 'refunding'
      order.refunds.push(refund)
      order.updatedAt = nowIso()
      addTimeline(order.id, '申请退款', refund.reason, ctx.operator)
      return refund
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders/:id/refunds/:refundId/approve',
    auth: true,
    perm: 'trade:order:refund',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      const refund = pendingRefund(order, num(ctx.params.refundId, 'refundId'))
      refund.status = 'approved'
      order.status = 'refunded'
      order.items.forEach((item) => {
        const product = db.products.find((entry) => entry.id === item.productId)
        if (!product) return
        product.stock += item.qty
        product.version += 1
      })
      order.updatedAt = nowIso()
      addTimeline(order.id, '同意退款', '回补库存', ctx.operator)
      return presentOrder(order, true)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/orders/:id/refunds/:refundId/reject',
    auth: true,
    perm: 'trade:order:refund',
    handle: (ctx) => {
      const order = mustOrder(num(ctx.params.id, 'id'))
      const refund = pendingRefund(order, num(ctx.params.refundId, 'refundId'))
      const reason = text(bodyOf(ctx).reason, '拒绝原因', 120)
      refund.status = 'rejected'
      order.status = order.statusBeforeRefund || 'paid'
      order.updatedAt = nowIso()
      addTimeline(order.id, '拒绝退款', reason, ctx.operator)
      return presentOrder(order, true)
    },
  },
]

function mustAddress(customerId: number, addrId: number) {
  mustCustomer(customerId)
  const item = db.addresses.find((address) => address.id === addrId && address.customerId === customerId)
  if (!item) throw notFound('地址不存在')
  return item
}

function markDefault(customerId: number, addrId: number) {
  db.addresses.forEach((address) => {
    if (address.customerId === customerId) address.isDefault = address.id === addrId
  })
}

function pendingRefund(order: DbOrder, refundId: number) {
  const refund = order.refunds.find((item) => item.id === refundId)
  if (!refund) throw notFound('退款单不存在')
  if (refund.status !== 'pending' || order.status !== 'refunding') throw illegalState()
  return refund
}

function makeOrderNo() {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `OD${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${Math.floor(Math.random() * 900 + 100)}`
}
