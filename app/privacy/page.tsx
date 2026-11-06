export const metadata = {
  title: 'Privacy · Watchlist',
  description: 'How Watchlist handles your Google account and market data.',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">Watchlist</p>
        <h1 className="text-3xl font-medium tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground">Last updated: 6 November 2026</p>
      </div>

      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Watchlist is a personal stocks tracker. It uses your Google account so it can store your list in a
          private Google Sheet in your Drive.
        </p>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-medium text-foreground">What we access</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Basic Google profile info (name, email, picture) to sign you in</li>
            <li>Google Sheets and Drive file access to create and update your watchlist workbook</li>
            <li>Public market data from Yahoo Finance to show quotes and history</li>
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-medium text-foreground">What we do not do</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>We do not sell your data</li>
            <li>We do not share your watchlist with other users</li>
            <li>We do not store your Google password</li>
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-medium text-foreground">Where data lives</h2>
          <p>
            Your tickers, targets, and notes live in a spreadsheet in your Google Drive. Sign-in tokens stay in
            your browser. Market quotes are fetched when you refresh.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-medium text-foreground">Your control</h2>
          <p>
            You can remove Watchlist access anytime at{' '}
            <a
              className="text-foreground underline-offset-4 hover:underline"
              href="https://myaccount.google.com/connections"
              target="_blank"
              rel="noreferrer"
            >
              Google Account connections
            </a>
            . You can also delete the spreadsheet from Drive.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-medium text-foreground">Contact</h2>
          <p>Questions about this policy: use the support email shown on the Google sign-in screen for this app.</p>
        </section>
      </div>
    </main>
  )
}
