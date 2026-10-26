export function yahooQuoteUrl(ticker: string) {
  const symbol = ticker.trim().toUpperCase()
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`
}
