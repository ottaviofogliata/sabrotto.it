export {}

declare global {
  interface Window {
    turnstile?: {
      render: (target: string | HTMLElement, options: {
        sitekey: string
        theme?: 'light' | 'dark' | 'auto'
        size?: 'normal' | 'compact' | 'flexible'
        callback: (token: string) => void
        'error-callback'?: () => void
        'expired-callback'?: () => void
      }) => string
      reset: (widgetId?: string) => void
    }
  }
}
