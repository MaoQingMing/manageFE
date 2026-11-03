import type { Route } from './context'
import { db } from './store'

const counted = new Set(['paid', 'shipped', 'completed'])

export const dashboardRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/api/v1/dashboard/overview',
    auth: true,
    perm: 'dashboard:view',
    handle: () => ({
      userCount: db.users.filter((item) => !item.deletedAt).length,
      productCount: db.products.length,
      orderCount: db.orders.length,
      todayAmount: db.orders
        .filter((item) => counted.has(item.status) && item.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10))
        .reduce((sum, item) => sum + item.payAmount, 0),
      pendingOrders: db.orders.filter((item) => item.status === 'pending').length,
      refundingOrders: db.orders.filter((item) => item.status === 'refunding').length,
      lowStock: db.products.filter((item) => item.status === 'on' && item.stock < 10).length,
      unread: db.notifications.filter((item) => !item.read).length,
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/dashboard/trends',
    auth: true,
    perm: 'dashboard:view',
    handle: (ctx) => {
      const days = ctx.query.range === '30d' ? 30 : 7
      return Array.from({ length: days }, (_, index) => {
        const date = new Date(Date.now() - (days - 1 - index) * 86400000).toISOString().slice(0, 10)
        const matched = db.orders.filter((item) => item.createdAt.slice(0, 10) === date)
        return {
          date,
          orderCount: matched.length,
          amount: matched.filter((item) => counted.has(item.status)).reduce((sum, item) => sum + item.payAmount, 0),
        }
      })
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/dashboard/rankings',
    auth: true,
    perm: 'dashboard:view',
    handle: () => {
      const orders = db.orders.filter((item) => counted.has(item.status))
      const productMap = new Map<string, { name: string; qty: number; amount: number }>()
      const customerMap = new Map<number, { name: string; amount: number; orderCount: number }>()
      orders.forEach((order) => {
        const customer = customerMap.get(order.customerId) || { name: order.customerName, amount: 0, orderCount: 0 }
        customer.amount += order.payAmount
        customer.orderCount += 1
        customerMap.set(order.customerId, customer)
        order.items.forEach((item) => {
          const current = productMap.get(item.name) || { name: item.name, qty: 0, amount: 0 }
          current.qty += item.qty
          current.amount += item.price * item.qty
          productMap.set(item.name, current)
        })
      })
      const top = <T extends { amount: number }>(list: T[]) => list.sort((a, b) => b.amount - a.amount).slice(0, 5)
      return { products: top([...productMap.values()]), customers: top([...customerMap.values()]) }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/dashboard/todos',
    auth: true,
    perm: 'dashboard:view',
    handle: () => [
      { key: 'pending', title: '待支付订单', count: db.orders.filter((item) => item.status === 'pending').length, path: '/trade/orders' },
      { key: 'refund', title: '待审批退款', count: db.orders.filter((item) => item.status === 'refunding').length, path: '/trade/orders' },
      { key: 'stock', title: '低库存在售商品', count: db.products.filter((item) => item.status === 'on' && item.stock < 10).length, path: '/catalog/products' },
      { key: 'draft', title: '未发布公告', count: db.notices.filter((item) => item.status === 'draft').length, path: '/content/notices' },
    ],
  },
]
