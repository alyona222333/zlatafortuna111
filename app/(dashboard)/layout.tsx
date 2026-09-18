import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/layout/sidebar'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner, getMyEmployeeRole } from '@/lib/business'
import { sectionsForRole } from '@/lib/permissions'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const user = await getAuthUser()

  if (!user) redirect('/login')

  const business = await getBusinessForOwner(user.id)
  const isOwner = !!business && business.owner_id === user.id
  const myRole = isOwner ? null : await getMyEmployeeRole(user.id)

  if (!business) redirect('/onboarding')

  const allowedSections = sectionsForRole(myRole, isOwner)
  const isOwnerOrDirector = isOwner || myRole === 'director'
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? '/dashboard'
  const routeSections: Array<[string, (typeof allowedSections)[number]]> = [
    ['/pos', 'pos'], ['/crm', 'clients'], ['/team', 'team'], ['/booking', 'booking'],
    ['/orders', 'orders'], ['/chats', 'chats'], ['/analytics', 'analytics'],
    ['/finance', 'finance'], ['/inventory/stocktaking', 'inventory_stocktaking'], ['/inventory/transfer', 'inventory_transfer'], ['/inventory', 'inventory'], ['/suppliers', 'suppliers'],
    ['/delivery', 'delivery'], ['/products', 'products'], ['/modules', 'modules'],
    ['/settings', 'settings'], ['/calls', 'calls'], ['/packaging', 'packaging'],
    ['/sale-sources', 'saleSources'], ['/statuses', 'statuses'], ['/workspace', 'workspace'], ['/instructions', 'instructions'],
  ]
  const requiredSection = routeSections.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1]
  if (!isOwnerOrDirector && requiredSection && !allowedSections.includes(requiredSection)) {
    redirect('/dashboard')
  }

  // SaaS: if user is on the main domain, redirect to their subdomain preserving the path.
  // Covers /dashboard, /settings, /pos, /crm, /inventory, /booking — any app route.
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (rootDomain && business?.slug) {
    const host = headersList.get('host') ?? ''
    if (host === rootDomain || host === `www.${rootDomain}`) {
      // x-pathname is set by middleware on every request
      const pathname = headersList.get('x-pathname') ?? '/dashboard'
      redirect(`https://${business.slug}.${rootDomain}${pathname}`)
    }
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gray-50">
      <Sidebar businessName={business.name} allowedSections={allowedSections} isOwnerOrDirector={isOwnerOrDirector} role={myRole} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pt-14 md:pt-0">
        {children}
      </div>
    </div>
  )
}
