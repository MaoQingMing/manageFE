import type { OrderStatus } from './types'

export const orderStatusMeta: Record<OrderStatus, { text: string; color: string }> = {
  pending: { text: '待支付', color: 'gold' },
  paid: { text: '已支付', color: 'blue' },
  shipped: { text: '已发货', color: 'cyan' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'default' },
  refunding: { text: '退款中', color: 'orange' },
  refunded: { text: '已退款', color: 'magenta' },
}

export const productStatusMeta = {
  draft: { text: '草稿', color: 'default' },
  on: { text: '在售', color: 'green' },
  off: { text: '下架', color: 'red' },
} as const

export const levelMeta: Record<string, string> = {
  normal: '普通',
  silver: '银卡',
  gold: '金卡',
}
