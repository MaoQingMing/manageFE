import { db } from './store'

export function expireMockCaptcha(captchaId: string) {
  const captcha = db.captchas.find((item) => item.id === captchaId)
  if (captcha) captcha.expiresAt = 1
}

export function consumeMockCaptcha(captchaId: string) {
  db.captchas = db.captchas.filter((item) => item.id !== captchaId)
}

export function expireMockRefresh(token: string) {
  const [, userId, id] = token.split('.')
  const refresh = db.refreshTokens.find((item) => item.id === id && String(item.userId) === userId)
  if (refresh) refresh.expiresAt = 1
}
