export function loginPath() {
  if (location.pathname === '/login') return '/login'
  const redirect = `${location.pathname}${location.search}${location.hash}`
  return `/login?redirect=${encodeURIComponent(redirect)}`
}

export function postLoginPath(redirect: string | null) {
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('\\') || /[\u0000-\u001f\u007f]/.test(redirect)) return '/dashboard'
  const pathname = redirect.split(/[?#]/)[0]
  if (pathname === '/login' || pathname.startsWith('/login/')) return '/dashboard'
  return redirect
}
