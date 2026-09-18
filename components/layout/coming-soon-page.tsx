import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { Construction } from 'lucide-react'

/**
 * Placeholder for a sidebar item that exists in navigation but doesn't have
 * a real screen behind it yet (see the 042-patch sidebar rework: dozens of
 * items were added to match the reference CRM's menu, one route at a time).
 *
 * `titleKey` is a key inside the `sidebar` messages namespace — the exact
 * same key used for the nav label in components/layout/sidebar.tsx, so the
 * page title always matches what the user clicked.
 */
export async function ComingSoonPage({ titleKey }: { titleKey: string }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')

  const t = await getTranslations('sidebar')
  const title = t(titleKey as never)

  return (
    <>
      <Header title={title} />
      <main className="p-6">
        <div className="flex flex-col items-center justify-center text-center py-24 rounded-xl border border-dashed border-gray-200 bg-white">
          <Construction className="w-8 h-8 text-gray-300 mb-3" />
          <div className="font-medium text-gray-700 mb-1">{t('comingSoonTitle' as never)}</div>
          <div className="text-gray-500 text-sm max-w-sm">{t('comingSoonBody' as never)}</div>
        </div>
      </main>
    </>
  )
}
