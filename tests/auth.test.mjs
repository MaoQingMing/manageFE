import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')

async function environment(mock = false) {
  const storage = new Map()
  const messages = []
  const redirects = []
  const context = vm.createContext({
    console, setTimeout, clearTimeout, URL, URLSearchParams, Blob, FormData, AbortController,
    crypto: { randomUUID },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    location: { pathname: '/trade/orders/1', search: '?tab=items', hash: '#detail', assign: (url) => redirects.push(url) },
  })
  const modules = new Map()
  async function moduleFor(specifier, parent = path.join(root, 'entry.ts')) {
    const local = specifier.startsWith('.') || specifier.startsWith('@/') || path.isAbsolute(specifier)
    const resolved = local ? path.resolve(specifier.startsWith('@/') ? root : path.dirname(parent), specifier.startsWith('@/') ? specifier.slice(2) : specifier) : specifier
    const key = local && !/\.tsx?$/.test(resolved) ? `${resolved}.ts` : resolved
    if (modules.has(key)) return modules.get(key)
    const pending = (async () => {
      if (!local) {
        const exports = specifier === 'antd' ? { message: { error: (text) => messages.push(text) } } : await import(specifier)
        return new vm.SyntheticModule(Object.keys(exports), function () {
          for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
        }, { context, identifier: key })
      }
      const source = await readFile(key, 'utf8')
      const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
      return new vm.SourceTextModule(compiled, {
        context, identifier: key,
        initializeImportMeta: (meta) => { meta.env = { VITE_USE_MOCK: mock ? 'true' : 'false', VITE_API_BASE: '' } },
      })
    })()
    modules.set(key, pending)
    return pending
  }
  async function load(filename) {
    const module = await moduleFor(path.join(root, filename))
    if (module.status === 'unlinked') await module.link((specifier, parent) => moduleFor(specifier, parent.identifier))
    if (module.status === 'linked') await module.evaluate()
    return module.namespace
  }
  const http = await load('api/http.ts')
  http.setTokens('old-access', 'old-refresh')
  return { ...http, load, storage, messages, redirects }
}

function response(config, status, code, message = 'ok', data = {}) {
  return { config, status, statusText: String(status), headers: {}, data: { code, message, data, traceId: 'test-trace' } }
}

function realResponse(result) {
  if (result.status >= 400) throw new axios.AxiosError(`Request failed with status code ${result.status}`, 'ERR_BAD_REQUEST', result.config, null, result)
  return result
}

for (const status of [400, 401, 403]) {
  test(`real HTTP ${status} login preserves business error without refreshing or clearing session`, async () => {
    const env = await environment()
    const code = status === 400 ? 40001 : status === 401 ? 40100 : 40301
    env.http.defaults.adapter = async (config) => realResponse(response(config, status, code, '业务错误'))
    await assert.rejects(env.http.post('/api/v1/auth/login', {}), (error) => error.code === code && error.status === status && error.traceId === 'test-trace' && error.message === '业务错误')
    assert.equal(env.getRefresh(), 'old-refresh')
    assert.equal(env.getLogs().length, 1)
    assert.equal(env.messages[0], '业务错误')
    assert.equal(env.redirects.length, 0)
  })
}

for (const mockResponse of [false, true]) {
  test(`${mockResponse ? 'Mock' : 'real HTTP'} concurrent expiration refreshes once and replays all requests`, async () => {
    const env = await environment()
    let refreshes = 0
    env.http.defaults.adapter = async (config) => {
      if (config.url.endsWith('/refresh')) {
        refreshes += 1
        await new Promise((resolve) => setTimeout(resolve, 20))
        return response(config, 200, 0, 'ok', { accessToken: 'new-access', refreshToken: 'new-refresh' })
      }
      const result = config.__retry ? response(config, 200, 0) : response(config, 401, 40101, 'Access 已过期')
      return mockResponse ? result : realResponse(result)
    }
    await Promise.all([env.http.get('/api/v1/auth/me'), env.http.get('/api/v1/users'), env.http.get('/api/v1/orders')])
    assert.equal(refreshes, 1)
    assert.equal(env.getRefresh(), 'new-refresh')
    assert.equal(env.getLogs().length, 7)
    assert.equal(env.messages.length, 0)
  })
}

test('late expired response reuses completed refresh', async () => {
  const env = await environment()
  let refreshes = 0
  env.http.defaults.adapter = async (config) => {
    if (config.url.endsWith('/refresh')) {
      refreshes += 1
      return response(config, 200, 0, 'ok', { accessToken: 'new-access', refreshToken: 'new-refresh' })
    }
    if (!config.__retry && config.url.endsWith('/orders')) await new Promise((resolve) => setTimeout(resolve, 30))
    return realResponse(config.__retry ? response(config, 200, 0) : response(config, 401, 40101))
  }
  await Promise.all([env.http.get('/api/v1/users'), env.http.get('/api/v1/orders')])
  assert.equal(refreshes, 1)
})

test('replayed authentication failure does not loop', async () => {
  const env = await environment()
  let refreshes = 0
  env.http.defaults.adapter = async (config) => {
    if (config.url.endsWith('/refresh')) {
      refreshes += 1
      return response(config, 200, 0, 'ok', { accessToken: 'new-access', refreshToken: 'new-refresh' })
    }
    return realResponse(response(config, 401, 40101))
  }
  await assert.rejects(env.http.get('/api/v1/auth/me'), (error) => error.code === 40101)
  assert.equal(refreshes, 1)
  assert.equal(env.getAccess(), '')
  assert.equal(env.redirects.length, 1)
})

for (const code of [40100, 40301, 40300]) {
  test(`protected ${code} ${code === 40300 ? 'preserves' : 'clears'} session`, async () => {
    const env = await environment()
    env.http.defaults.adapter = async (config) => realResponse(response(config, code === 40100 ? 401 : 403, code))
    await assert.rejects(env.http.get('/api/v1/auth/me'), (error) => error.code === code)
    assert.equal(env.getAccess(), code === 40300 ? 'old-access' : '')
    assert.equal(env.redirects.length, code === 40300 ? 0 : 1)
  })
}

for (const fault of ['network', 'server']) {
  test(`refresh ${fault} failure preserves tokens and allows retry`, async () => {
    const env = await environment()
    let broken = true
    env.http.defaults.adapter = async (config) => {
      if (config.url.endsWith('/refresh')) {
        if (broken) {
          if (fault === 'network') throw new axios.AxiosError('offline', 'ERR_NETWORK', config)
          return realResponse(response(config, 500, 50000, '服务不可用'))
        }
        return response(config, 200, 0, 'ok', { accessToken: 'new-access', refreshToken: 'new-refresh' })
      }
      return realResponse(config.__retry ? response(config, 200, 0) : response(config, 401, 40101))
    }
    await assert.rejects(env.http.get('/api/v1/auth/me', { skipErrorToast: true }))
    assert.equal(env.getAccess(), 'old-access')
    assert.equal(env.getRefresh(), 'old-refresh')
    assert.equal(env.redirects.length, 0)
    broken = false
    await env.http.get('/api/v1/auth/me')
    assert.equal(env.getRefresh(), 'new-refresh')
  })
}

test('expired refresh clears session once for concurrent requests', async () => {
  const env = await environment()
  env.http.defaults.adapter = async (config) => {
    if (config.url.endsWith('/refresh')) await new Promise((resolve) => setTimeout(resolve, 20))
    return realResponse(response(config, 401, config.url.endsWith('/refresh') ? 40100 : 40101))
  }
  const results = await Promise.allSettled([env.http.get('/api/v1/users'), env.http.get('/api/v1/orders')])
  assert.equal(results.every((item) => item.status === 'rejected'), true)
  assert.equal(env.getRefresh(), '')
  assert.equal(env.redirects.length, 1)
})

test('refresh-only session can obtain access without an Authorization header', async () => {
  const env = await environment()
  env.storage.delete('managefe_access')
  env.http.defaults.adapter = async (config) => {
    assert.equal(config.headers.Authorization, undefined)
    assert.equal(JSON.parse(config.data).refreshToken, 'old-refresh')
    return response(config, 200, 0, 'ok', { accessToken: 'new-access', refreshToken: 'new-refresh' })
  }
  await env.refreshAccess()
  assert.equal(env.getAccess(), 'new-access')
})

test('session restoration refreshes missing access then loads the current user', async () => {
  const env = await environment()
  const client = await env.load('api/client.ts')
  env.storage.delete('managefe_access')
  const requests = []
  env.http.defaults.adapter = async (config) => {
    requests.push(config.url)
    if (config.url.endsWith('/refresh')) return response(config, 200, 0, 'ok', { accessToken: 'new-access', refreshToken: 'new-refresh' })
    return response(config, 200, 0, 'ok', { id: 1 })
  }
  assert.equal((await client.restoreAuthUser()).id, 1)
  assert.deepEqual(requests, ['/api/v1/auth/refresh', '/api/v1/auth/me'])
  env.clearTokens()
  assert.equal(await client.restoreAuthUser(), null)
  assert.equal(requests.length, 2)
})

for (const fault of ['network', 'server']) {
  test(`session restoration ${fault} failure preserves credentials for retry`, async () => {
    const env = await environment()
    const client = await env.load('api/client.ts')
    env.http.defaults.adapter = async (config) => {
      if (fault === 'network') throw new axios.AxiosError('offline', 'ERR_NETWORK', config)
      return realResponse(response(config, 500, 50000, '服务不可用'))
    }
    await assert.rejects(client.restoreAuthUser())
    assert.equal(env.getRefresh(), 'old-refresh')
    assert.equal(env.getAccess(), 'old-access')
    assert.equal(env.messages.length, 0)
    env.http.defaults.adapter = async (config) => response(config, 200, 0, 'ok', { id: 1 })
    assert.equal((await client.restoreAuthUser()).id, 1)
  })
}

test('completed old refresh cannot resurrect a logged-out session', async () => {
  const env = await environment()
  let finish
  env.http.defaults.adapter = (config) => new Promise((resolve) => { finish = () => resolve(response(config, 200, 0, 'ok', { accessToken: 'new-access', refreshToken: 'new-refresh' })) })
  const pending = env.refreshAccess()
  await new Promise((resolve) => setTimeout(resolve, 0))
  env.clearTokens()
  finish()
  await assert.rejects(pending, /会话已变更/)
  assert.equal(env.getRefresh(), '')
})

test('logout does not refresh an expired access token', async () => {
  const env = await environment()
  env.http.defaults.adapter = async (config) => {
    assert.equal(config.url, '/api/v1/auth/logout')
    assert.equal(config.headers.Authorization, undefined)
    return response(config, 200, 0)
  }
  await env.http.post('/api/v1/auth/logout', { refreshToken: env.getRefresh() })
  assert.equal(env.getLogs().length, 1)
})

test('JSON errors from file downloads are parsed and binary success is preserved', async () => {
  const env = await environment()
  env.http.defaults.adapter = async (config) => {
    const result = response(config, 403, 40300, '不能下载')
    result.data = new Blob([JSON.stringify(result.data)], { type: 'application/json' })
    return realResponse(result)
  }
  await assert.rejects(env.http.get('/api/v1/files/1/download', { responseType: 'blob' }), (error) => error.code === 40300 && error.message === '不能下载')
  const file = new Blob(['csv'], { type: 'text/csv' })
  env.http.defaults.adapter = async (config) => ({ ...response(config, 200, 0), data: file })
  assert.equal((await env.http.get('/api/v1/products/export', { responseType: 'blob' })).data, file)
})

test('real BE refuses local JWT mutation', async () => {
  const env = await environment()
  assert.throws(() => env.expireAccessLocally(), /真实 BE/)
  assert.equal(env.getAccess(), 'old-access')
})

test('internal redirect preserves query/hash and rejects external or login destinations', async () => {
  const env = await environment()
  const navigation = await env.load('authNavigation.ts')
  assert.equal(navigation.loginPath(), '/login?redirect=%2Ftrade%2Forders%2F1%3Ftab%3Ditems%23detail')
  assert.equal(navigation.postLoginPath('/trade/orders/1?tab=items#detail'), '/trade/orders/1?tab=items#detail')
  for (const value of [null, 'https://example.com', '//example.com', '/\\example.com', '/login', '/login?redirect=/login', '/\t/example.com']) assert.equal(navigation.postLoginPath(value), '/dashboard')
})

async function mockLogin(env, username = 'admin', password = 'admin123') {
  const store = await env.load('mock/store.ts')
  const captcha = (await env.http.get('/api/v1/auth/captcha')).data.data
  const code = store.db.captchas.find((item) => item.id === captcha.captchaId).code
  const result = (await env.http.post('/api/v1/auth/login', { username, password, captchaId: captcha.captchaId, captchaCode: code })).data.data
  env.setTokens(result.accessToken, result.refreshToken)
  return result
}

test('Mock captcha is single-use even when credentials fail', async () => {
  const env = await environment(true)
  const store = await env.load('mock/store.ts')
  const captcha = (await env.http.get('/api/v1/auth/captcha')).data.data
  assert.ok(store.db.captchas.find((item) => item.id === captcha.captchaId), `captcha entries=${store.db.captchas.length}, response keys=${Object.keys(captcha)}, mock=${env.useMock}`)
  const code = store.db.captchas.find((item) => item.id === captcha.captchaId).code
  const payload = { username: 'admin', password: 'wrong', captchaId: captcha.captchaId, captchaCode: code }
  await assert.rejects(env.http.post('/api/v1/auth/login', payload), (error) => error.code === 40100)
  payload.password = 'admin123'
  await assert.rejects(env.http.post('/api/v1/auth/login', payload), (error) => error.code === 40001)
})

test('Mock captcha expiration and one-shot captcha failure can be retried', async () => {
  const env = await environment(true)
  const store = await env.load('mock/store.ts')
  const practice = await env.load('mock/auth.practice.ts')
  const faults = await env.load('mock/auth.faults.ts')
  const captcha = (await env.http.get('/api/v1/auth/captcha')).data.data
  const code = store.db.captchas.find((item) => item.id === captcha.captchaId).code
  practice.expireMockCaptcha(captcha.captchaId)
  await assert.rejects(env.http.post('/api/v1/auth/login', { username: 'admin', password: 'admin123', captchaId: captcha.captchaId, captchaCode: code }), (error) => error.code === 40001)
  faults.failNextAuthRequest('captcha', 'server')
  await assert.rejects(env.http.get('/api/v1/auth/captcha'), (error) => error.code === 50000)
  assert.ok((await env.http.get('/api/v1/auth/captcha')).data.data.captchaId)
})

test('Mock rotation rejects old refresh without clearing the new browser session', async () => {
  const env = await environment(true)
  await mockLogin(env)
  const old = env.getRefresh()
  await env.refreshAccess()
  const current = env.getRefresh()
  await assert.rejects(env.http.post('/api/v1/auth/refresh', { refreshToken: old }), (error) => error.code === 40100)
  assert.equal(env.getRefresh(), current)
  await env.http.get('/api/v1/auth/me')
})

test('Mock expired refresh clears the active session on automatic renewal', async () => {
  const env = await environment(true)
  await mockLogin(env)
  const practice = await env.load('mock/auth.practice.ts')
  practice.expireMockRefresh(env.getRefresh())
  env.expireAccessLocally()
  await assert.rejects(env.http.get('/api/v1/auth/me'), (error) => error.code === 40100)
  assert.equal(env.getRefresh(), '')
  assert.equal(env.redirects.length, 1)
})

for (const target of ['me', 'refresh']) {
  for (const fault of ['network', 'server']) {
    test(`Mock ${target} ${fault} fault is one-shot and preserves session`, async () => {
      const env = await environment(true)
      await mockLogin(env)
      const faults = await env.load('mock/auth.faults.ts')
      const oldRefresh = env.getRefresh()
      faults.failNextAuthRequest(target, fault)
      if (target === 'refresh') env.expireAccessLocally()
      await assert.rejects(env.http.get('/api/v1/auth/me'), (error) => error.code === (fault === 'server' ? 50000 : 'ERR_NETWORK'))
      assert.equal(env.getRefresh(), oldRefresh)
      await env.http.get('/api/v1/auth/me')
      assert.ok(env.getAccess())
      assert.equal(env.redirects.length, 0)
    })
  }
}

test('Mock disabled account is rejected by both protected requests and refresh', async () => {
  const env = await environment(true)
  const login = await mockLogin(env, 'operator', 'operator123')
  const store = await env.load('mock/store.ts')
  store.db.users.find((item) => item.id === login.user.id).status = 0
  await assert.rejects(env.http.get('/api/v1/auth/me'), (error) => error.code === 40301)
  assert.equal(env.getAccess(), '')
  env.setTokens(login.accessToken, login.refreshToken)
  await assert.rejects(env.refreshAccess(), (error) => error.code === 40301)
  assert.equal(env.getRefresh(), '')
})

test('Mock logout revokes refresh without access and is idempotent', async () => {
  const env = await environment(true)
  await mockLogin(env)
  const old = env.getRefresh()
  env.expireAccessLocally()
  await env.http.post('/api/v1/auth/logout', { refreshToken: old })
  await env.http.post('/api/v1/auth/logout', { refreshToken: old })
  await assert.rejects(env.http.post('/api/v1/auth/refresh', { refreshToken: old }), (error) => error.code === 40100)
  assert.equal(env.getLogs().filter((item) => item.url === '/api/v1/auth/refresh').length, 1)
})

test('Mock password change and administrator reset revoke all user refresh tokens', async () => {
  const env = await environment(true)
  await mockLogin(env, 'operator', 'operator123')
  const operator = await mockLogin(env, 'operator', 'operator123')
  const beforeChange = env.getRefresh()
  await env.http.put('/api/v1/auth/password', { oldPassword: 'operator123', newPassword: 'changed123' })
  const store = await env.load('mock/store.ts')
  assert.equal(store.db.refreshTokens.some((item) => item.userId === operator.user.id), false)
  await assert.rejects(env.http.post('/api/v1/auth/refresh', { refreshToken: beforeChange }), (error) => error.code === 40100)
  await mockLogin(env, 'operator', 'changed123')
  const beforeReset = env.getRefresh()
  await mockLogin(env)
  await env.http.post(`/api/v1/users/${operator.user.id}/reset-password`, { password: 'reset123' })
  assert.equal(store.db.refreshTokens.some((item) => item.userId === operator.user.id), false)
  await assert.rejects(env.http.post('/api/v1/auth/refresh', { refreshToken: beforeReset }), (error) => error.code === 40100)
})
