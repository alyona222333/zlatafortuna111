import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { OnboardingWizard } from './OnboardingWizard'

export default async function OnboardingPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const business = await getBusinessForOwner(user.id)

  // Do NOT redirect to /login here. The user IS authenticated at this point
  // (getAuthUser returned them), so /login would bounce them straight back
  // to /dashboard, which bounces here again — an infinite white-screen loop.
  // That is exactly what an invited employee hit before migration 046: their
  // company row existed, but RLS hid it, so this looked like "no business".
  // Show the situation instead of ping-ponging.
  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8 text-center">
          <h1 className="text-lg font-semibold mb-2">Обліковий запис не прив&apos;язано до компанії</h1>
          <p className="text-sm text-gray-500">
            Ви увійшли, але ваш обліковий запис поки не пов&apos;язаний з жодною компанією.
            Попросіть керівника надіслати нове запрошення в Налаштування → Співробітники,
            або вийдіть і увійдіть під обліковим записом власника.
          </p>
          <a href="/login" className="inline-block mt-5 text-sm text-blue-600 hover:underline">
            Вийти та увійти іншим акаунтом
          </a>
        </div>
      </div>
    )
  }

  // Employees use the already configured business and must never enter the
  // owner-only onboarding wizard. This also prevents dashboard/login loops.
  if (business.owner_id !== user.id) redirect('/dashboard')

  if (business.onboarding_completed) {
    const isSaas = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'saas'
    if (isSaas && business.slug) {
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'trypronto.app'
      redirect(`https://${business.slug}.${rootDomain}/dashboard`)
    }
    redirect('/dashboard')
  }

  const isSaas = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'saas'
  return (
    <OnboardingWizard
      initialSlug={business.slug ?? ''}
      initialName={business.name ?? ''}
      isSaas={isSaas}
      rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'trypronto.app'}
    />
  )
}
