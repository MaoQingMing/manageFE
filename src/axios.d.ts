import 'axios'

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipErrorToast?: boolean
    __retry?: boolean
    __startedAt?: number
  }
}
