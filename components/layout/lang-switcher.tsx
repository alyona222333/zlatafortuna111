'use client'

import { useLocale } from 'next-intl'
import { useState } from 'react'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOCALES = [
  { code: 'uk', label: 'UA' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
]

export function LangSwitcher() {
  const locale = useLocale()
  const [loading, setLoading] = useState(false)

  async function switchLocale(code: string) {
    if (code === locale || loading) return
    setLoading(true)
    try {
      // Persist on the server for the next request.
      await fetch('/api/user/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ locale: code }),
      })
      // Also write immediately in the browser. This avoids a stale cookie
      // after a Netlify/CDN response and makes the next SSR request deterministic.
      document.cookie = `dashboard_locale=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; SameSite=Lax`
      window.location.href = `${window.location.pathname}${window.location.search}`
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <Globe className="w-3.5 h-3.5 text-white/30 shrink-0 mr-0.5" />
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={loading}
          className={cn(
            'text-xs font-medium px-1.5 py-0.5 rounded transition-colors',
            code === locale
              ? 'text-white bg-white/15'
              : 'text-white/40 hover:text-white/70'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
