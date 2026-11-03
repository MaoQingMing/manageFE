export type AuthFaultTarget = 'captcha' | 'me' | 'refresh'
export type AuthFault = 'network' | 'server'

const faults = new Map<string, AuthFault>()

export function failNextAuthRequest(target: AuthFaultTarget, fault: AuthFault) {
  faults.set(`/api/v1/auth/${target}`, fault)
}

export function takeAuthFault(path: string) {
  const fault = faults.get(path)
  faults.delete(path)
  return fault
}
