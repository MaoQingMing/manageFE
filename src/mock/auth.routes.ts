import { accountDisabled, invalid, text, unauthorized } from './kit'
import { bodyOf, type Route } from './context'
import {
  buildSession,
  createCaptcha,
  db,
  issueTokens,
  revokeRefresh,
} from './store'

export const authRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/api/v1/health',
    auth: false,
    handle: () => ({ status: 'up', time: new Date().toISOString() }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/auth/captcha',
    auth: false,
    handle: () => createCaptcha(),
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/login',
    auth: false,
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const captcha = db.captchas.find((item) => item.id === body.captchaId)
      db.captchas = db.captchas.filter((item) => item.id !== body.captchaId)
      if (!captcha || captcha.expiresAt < Date.now() || captcha.code !== String(body.captchaCode ?? '').trim()) {
        throw invalid('验证码错误或已过期')
      }
      const username = text(body.username, '用户名', 32)
      const user = db.users.find((item) => item.username === username && !item.deletedAt)
      if (!user || user.password !== String(body.password ?? '')) throw unauthorized('用户名或密码错误')
      if (user.status !== 1) throw accountDisabled()
      ctx.operator = user.username
      ctx.user = user
      return { ...issueTokens(user.id), user: buildSession(user) }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/refresh',
    auth: false,
    handle: (ctx) => {
      const token = String(bodyOf(ctx).refreshToken ?? '')
      const [kind, userId, id] = token.split('.')
      const found = db.refreshTokens.find((item) => item.id === id && String(item.userId) === userId)
      if (kind !== 'refresh' || !found || found.expiresAt < Date.now()) throw unauthorized('刷新令牌无效')
      db.refreshTokens = db.refreshTokens.filter((item) => item.id !== id)
      const user = db.users.find((item) => item.id === found.userId && !item.deletedAt && item.status === 1)
      if (!user) throw unauthorized('刷新令牌无效')
      ctx.operator = user.username
      return issueTokens(user.id)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/logout',
    auth: true,
    handle: (ctx) => {
      revokeRefresh(String(bodyOf(ctx).refreshToken ?? ''))
      return {}
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/auth/me',
    auth: true,
    handle: (ctx) => buildSession(ctx.user!),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/auth/profile',
    auth: true,
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const user = ctx.user!
      const nickname = text(body.nickname, '昵称', 32)
      const email = String(body.email ?? '').trim()
      const phone = String(body.phone ?? '').trim()
      if (email && !email.includes('@')) throw invalid('邮箱格式不正确')
      if (phone && !/^1\d{10}$/.test(phone)) throw invalid('手机号格式不正确')
      user.nickname = nickname
      user.email = email
      user.phone = phone
      user.avatar = String(body.avatar ?? user.avatar)
      return buildSession(user)
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/auth/password',
    auth: true,
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const user = ctx.user!
      if (user.password !== String(body.oldPassword ?? '')) throw invalid('原密码不正确')
      const next = String(body.newPassword ?? '')
      if (next.length < 6) throw invalid('新密码至少 6 位')
      user.password = next
      db.refreshTokens = db.refreshTokens.filter((item) => item.userId !== user.id)
      return {}
    },
  },
]
