'use client'

import { Cloud, CloudOff, ExternalLink, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clearWatchlistSession, type SyncStatus } from '@/lib/use-watchlist'
import { useGoogleSession } from '@/lib/google-auth'

type AccountButtonProps = {
  syncStatus: SyncStatus
  syncMessage: string | null
  spreadsheetUrl?: string
}

export function AccountButton({ syncStatus, syncMessage, spreadsheetUrl }: AccountButtonProps) {
  const { user, signOut } = useGoogleSession()
  if (!user) return null

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
      <SyncHint status={syncStatus} message={syncMessage} spreadsheetUrl={spreadsheetUrl} />
      <div className="flex min-w-0 items-center gap-2">
        {user.picture ? (
          <img
            src={user.picture}
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 rounded-full bg-secondary object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline">{user.email}</span>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Sign out ${user.email}`}
          onClick={() => {
            clearWatchlistSession(user.sub)
            signOut()
          }}
        >
          <LogOut aria-hidden />
          Sign out
        </Button>
      </div>
    </div>
  )
}

function SyncHint({
  status,
  message,
  spreadsheetUrl,
}: {
  status: SyncStatus
  message: string | null
  spreadsheetUrl?: string
}) {
  const sheetLink = spreadsheetUrl ? (
    <a
      href={spreadsheetUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      Sheets
      <ExternalLink className="size-3" aria-hidden />
    </a>
  ) : (
    <span className="text-xs text-muted-foreground">Google Sheets</span>
  )

  if (status === 'idle' || status === 'saved') {
    return (
      <span className="flex items-center gap-2">
        <Cloud className="size-3.5 text-muted-foreground" aria-hidden />
        {sheetLink}
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive" title={message ?? undefined}>
        <CloudOff className="size-3.5" aria-hidden />
        {message ?? 'Could not update Sheets'}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {status === 'refreshing' ? 'Refreshing quotes' : 'Saving'}
    </span>
  )
}
