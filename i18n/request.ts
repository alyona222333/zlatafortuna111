import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const SUPPORTED = ['en', 'es', 'it', 'pt', 'uk', 'ru'] as const
type Locale = (typeof SUPPORTED)[number]

export default getRequestConfig(async () => {
  const raw = (await cookies()).get('dashboard_locale')?.value ?? 'uk'
  const locale: Locale = (SUPPORTED as readonly string[]).includes(raw) ? (raw as Locale) : 'uk'
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
