/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_AUTH_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_ENABLE_DEVTOOLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
