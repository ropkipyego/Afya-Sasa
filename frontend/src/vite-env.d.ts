/// <reference types="vite/client" />

declare module '*.css'

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEFAULT_TENANT?: string
  readonly VITE_HIDE_TENANT_SELECTOR?: string
  readonly VITE_SOCKET_URL?: string
}
