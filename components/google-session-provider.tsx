'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { GOOGLE_CLIENT_ID, initGoogleAuth } from '@/lib/google-auth'

export function GoogleSessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initGoogleAuth()
  }, [])

  return (
    <>
      {GOOGLE_CLIENT_ID ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => initGoogleAuth()}
        />
      ) : null}
      {children}
    </>
  )
}
