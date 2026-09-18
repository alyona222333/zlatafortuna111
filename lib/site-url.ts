const FALLBACK_SITE_URL = 'https://zlatafortuna111.lelakrimska.workers.dev'

/** Public origin used in Supabase email/OAuth redirect URLs. */
export function getSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
  ]
  for (const value of candidates) {
    const configured = value?.trim()
    if (!configured || configured === '****') continue
    try {
      const parsed = new URL(configured)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
      if (/your-app\.netlify\.app|trypronto\.app|localhost(?::\d+)?|127\.0\.0\.1/i.test(parsed.hostname)) continue
      return parsed.origin
    } catch {
      // Ignore malformed Netlify variables and use the current production URL.
    }
  }
  return FALLBACK_SITE_URL
}
