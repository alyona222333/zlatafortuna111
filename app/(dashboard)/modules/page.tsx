import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { MODULES } from '@/lib/modules'

const MODULE_STATUS: Record<string, { status: string; tone: string; detail: string }> = {
  bookings: { status: 'Працює', tone: 'bg-green-50 text-green-700 border-green-200', detail: 'Запис, календар, послуги та співробітники.' },
  crm: { status: 'Працює', tone: 'bg-green-50 text-green-700 border-green-200', detail: 'Клієнти, картки, історія та нотатки.' },
  pos: { status: 'Працює', tone: 'bg-green-50 text-green-700 border-green-200', detail: 'Каса, продажі та історія операцій.' },
  inventory: { status: 'Працює', tone: 'bg-green-50 text-green-700 border-green-200', detail: 'Товари, залишки, імпорт та низькі залишки.' },
  notifications: { status: 'Працює', tone: 'bg-green-50 text-green-700 border-green-200', detail: 'Telegram, email та підготовка WhatsApp/Viber.' },
  delivery: { status: 'Підключається', tone: 'bg-blue-50 text-blue-700 border-blue-200', detail: 'Nova Poshta працює; Ukrposhta буде додана як окремий перевізник.' },
  telephony: { status: 'Опційно', tone: 'bg-amber-50 text-amber-700 border-amber-200', detail: 'Підключення залежить від провайдера телефонії або SIP.' },
  ecommerce: { status: 'Підключається', tone: 'bg-blue-50 text-blue-700 border-blue-200', detail: 'WooCommerce webhook уже доступний; інші магазини додаються окремо.' },
}

export default async function ModulesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')

  const enabled = new Set((business.enabled_modules ?? []) as string[])

  return (
    <>
      <Header title="Модулі CRM" />
      <main className="p-4 md:p-6 max-w-5xl">
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">SaaS-конфігурація</p>
          <p className="mt-1 text-blue-800">Кожен бізнес може використовувати власний набір функцій. Інтеграції, які потребують ключів або договорів, показуються окремо та не видаються за вже підключені.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(MODULES).map(([key, module]) => {
            const meta = MODULE_STATUS[key] ?? { status: 'Планується', tone: 'bg-gray-50 text-gray-600 border-gray-200', detail: 'Модуль буде доступний після реалізації.' }
            return (
              <article key={key} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-gray-900">{module.label}</h2>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${meta.tone}`}>{meta.status}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{meta.detail}</p>
                <p className="mt-4 text-xs text-gray-400">{enabled.has(key) ? 'Увімкнено для цього бізнесу' : 'Доступний у конфігурації'}</p>
              </article>
            )
          })}
        </div>
      </main>
    </>
  )
}
