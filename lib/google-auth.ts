'use client'

import { useSyncExternalStore } from 'react'

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const SCOPES = ['openid', 'email', 'profile', SHEETS_SCOPE, DRIVE_SCOPE].join(' ')
const ACCESS_REQUIRED_MESSAGE =
  'Watchlist needs Google Sheets and Drive access to store your list. Allow both when Google asks.'

const STORAGE_KEY = 'watchlist:google'

export type GoogleUser = {
  sub: string
  name: string
  email: string
  picture: string
}

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in' | 'misconfigured'

export type GoogleSession = {
  status: SessionStatus
  user: GoogleUser | null
  error: string | null
}

type StoredSession = {
  accessToken: string
  expiresAt: number
  scope: string
  user: GoogleUser
}

const listeners = new Set<() => void>()
const SERVER_SNAPSHOT: GoogleSession = { status: 'loading', user: null, error: null }

let tokenClient: GoogleTokenClient | null = null
let accessToken: string | null = null
let expiresAt = 0
let session: GoogleSession = SERVER_SNAPSHOT

function emit() {
  listeners.forEach((listener) => listener())
}

function setSession(next: GoogleSession) {
  session = next
  emit()
}

function hasRequiredScopes(scope?: string, response?: GoogleTokenResponse) {
  const gis = window.google?.accounts?.oauth2
  if (response && gis?.hasGrantedAllScopes) return gis.hasGrantedAllScopes(response, SHEETS_SCOPE, DRIVE_SCOPE)
  const granted = new Set((scope ?? response?.scope ?? '').split(/[ ,]+/).filter(Boolean))
  return granted.has(SHEETS_SCOPE) && granted.has(DRIVE_SCOPE)
}

function readStored(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredSession
    if (!stored.accessToken || !stored.user?.sub || stored.expiresAt <= Date.now() + 30_000) return null
    if (!hasRequiredScopes(stored.scope)) {
      clearStored()
      return null
    }
    return stored
  } catch {
    return null
  }
}

function writeStored(value: StoredSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

function clearStored() {
  window.localStorage.removeItem(STORAGE_KEY)
}

function applyStored(stored: StoredSession) {
  accessToken = stored.accessToken
  expiresAt = stored.expiresAt
  setSession({ status: 'signed-in', user: stored.user, error: null })
}

if (typeof window !== 'undefined') {
  if (!GOOGLE_CLIENT_ID) {
    session = { status: 'misconfigured', user: null, error: null }
  } else {
    const stored = readStored()
    if (stored) applyStored(stored)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return session
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT
}

export function useGoogleSession() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    ...current,
    signIn,
    signOut,
    getAccessToken,
  }
}

export function initGoogleAuth() {
  if (!GOOGLE_CLIENT_ID) {
    setSession({ status: 'misconfigured', user: null, error: null })
    return
  }
  const gis = window.google?.accounts?.oauth2
  if (!gis) return
  if (tokenClient) return

  tokenClient = gis.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    enable_granular_consent: false,
    callback: () => {},
  })

  if (session.status === 'loading') {
    setSession({ status: 'signed-out', user: null, error: null })
  }
}

async function requestToken(prompt: '' | 'consent' | 'select_account') {
  const client = tokenClient
  if (!client) throw new Error('Google Identity is still loading. Try again in a moment.')

  return new Promise<GoogleTokenResponse>((resolve, reject) => {
    client.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error))
        return
      }
      resolve(response)
    }
    client.error_callback = (error) => {
      if (error.type === 'popup_closed') {
        reject(new Error('Google sign-in was closed before finishing.'))
        return
      }
      reject(new Error(error.message || 'Google sign-in failed.'))
    }
    client.requestAccessToken({
      prompt,
      hint: session.user?.email,
    })
  })
}

async function fetchUser(token: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Could not load your Google account.')
  const profile = (await res.json()) as Partial<GoogleUser>
  if (!profile.sub || !profile.email) throw new Error('Google did not return an account profile.')
  return {
    sub: profile.sub,
    name: profile.name || profile.email,
    email: profile.email,
    picture: profile.picture || '',
  }
}

async function applyToken(response: GoogleTokenResponse, user?: GoogleUser) {
  if (!hasRequiredScopes(response.scope, response)) throw new Error(ACCESS_REQUIRED_MESSAGE)
  accessToken = response.access_token
  expiresAt = Date.now() + response.expires_in * 1000
  const nextUser = user ?? session.user ?? (await fetchUser(response.access_token))
  writeStored({
    accessToken: response.access_token,
    expiresAt,
    scope: response.scope,
    user: nextUser,
  })
  setSession({ status: 'signed-in', user: nextUser, error: null })
}

export async function signIn() {
  if (!GOOGLE_CLIENT_ID) {
    setSession({ status: 'misconfigured', user: null, error: null })
    return
  }
  try {
    const response = await requestToken('consent')
    await applyToken(response)
  } catch (error) {
    setSession({
      status: 'signed-out',
      user: null,
      error: error instanceof Error ? error.message : 'Google sign-in failed.',
    })
    throw error
  }
}

export function signOut() {
  const token = accessToken
  accessToken = null
  expiresAt = 0
  clearStored()
  if (token) window.google?.accounts?.oauth2.revoke(token)
  setSession({ status: 'signed-out', user: null, error: null })
}

export async function getAccessToken() {
  if (accessToken && Date.now() < expiresAt - 60_000) return accessToken
  try {
    const response = await requestToken('')
    await applyToken(response, session.user ?? undefined)
    if (!accessToken) throw new Error('Google authorization expired. Sign in again.')
    return accessToken
  } catch (error) {
    if (session.status === 'signed-in') {
      setSession({
        ...session,
        error: error instanceof Error ? error.message : 'Google authorization expired. Sign in again.',
      })
    }
    throw error
  }
}
