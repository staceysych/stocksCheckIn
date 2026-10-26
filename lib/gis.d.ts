export {}

declare global {
  type GoogleTokenResponse = {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
    error?: string
    error_description?: string
  }

  type GoogleIdentityError = {
    type: 'popup_failed_to_open' | 'popup_closed' | 'unknown'
    message?: string
  }

  type GoogleTokenClient = {
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: GoogleIdentityError) => void
    requestAccessToken: (override?: { prompt?: string; hint?: string }) => void
  }

  type GoogleTokenClientConfig = {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: GoogleIdentityError) => void
    enable_granular_consent?: boolean
  }

  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient
          hasGrantedAllScopes?: (response: GoogleTokenResponse, ...scopes: string[]) => boolean
          revoke: (accessToken: string, callback?: () => void) => void
        }
      }
    }
  }
}
