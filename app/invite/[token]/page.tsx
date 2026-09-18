import type { Metadata } from 'next'
import { getInvite } from './actions'
import { InviteForm } from './invite-form'
import { ROLE_LABELS, type RoleSlug } from '@/lib/permissions'

export const metadata: Metadata = {
  title: 'Запрошення до Злата Фортуна Групп',
  description: 'Запрошення співробітника до CRM Злата Фортуна Групп.',
  openGraph: {
    title: 'Запрошення до Злата Фортуна Групп',
    description: 'Запрошення співробітника до CRM Злата Фортуна Групп.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Злата Фортуна Групп' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-image.png'] },
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await getInvite(token)

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full text-center bg-white rounded-xl shadow-sm border p-8">
          <h1 className="text-lg font-semibold mb-2">Посилання недійсне</h1>
          <p className="text-sm text-gray-500">
            Це запрошення вже використано або термін його дії минув (7 днів).
            Попросіть керівника надіслати нове запрошення в Налаштування → Співробітники.
          </p>
        </div>
      </div>
    )
  }

  const roleLabel = ROLE_LABELS[invite.role as RoleSlug]?.uk ?? invite.role

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-sm border p-8">
        <div className="font-bold text-lg mb-1">
          Злата Фортуна<span style={{ color: '#16a34a' }}>.</span>
        </div>
        <h1 className="text-xl font-semibold mb-1">Вітаємо, {invite.name}!</h1>
        <p className="text-sm text-gray-500 mb-6">
          Роль: <span className="font-medium text-gray-700">{roleLabel}</span> · Email: {invite.email}
          <br />
          Задайте пароль, щоб увійти до CRM.
        </p>
        <InviteForm token={token} />
      </div>
    </div>
  )
}
