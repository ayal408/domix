/// <reference types="vite/client" />

declare module '*.png'
declare module '*.svg'
declare module '*.jpg'

/**
 * Ambient declarations for `import.meta.env.VITE_*`.
 * Keep in sync with the keys read by `src/config/env.ts`, which is the
 * runtime source of truth (this file only affects compile-time typing).
 */
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

/**
 * Minimal surface of the Google Identity Services script
 * (https://accounts.google.com/gsi/client), loaded at runtime by
 * src/lib/googleIdentity.ts. Only the bits GoogleSignInButton uses.
 */
interface GoogleCredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    itp_support?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      width?: number
      locale?: string
    },
  ) => void
  disableAutoSelect: () => void
  cancel: () => void
}

interface Window {
  google?: {
    accounts: {
      id: GoogleAccountsId
    }
  }
}
