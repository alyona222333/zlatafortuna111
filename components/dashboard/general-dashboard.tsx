import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, CheckCircle2, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react'

interface Props { businessName: string }

export function GeneralDashboard({ businessName }: Props) {
  return (
    <>
      <Header title="Панель" />
      <main className="p-6 space-y-6">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1b2e] via-[#163b49] to-[#146c5b] text-white p-8 md:p-10">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-emerald-300/20 blur-2xl animate-pulse" />
          <div className="absolute right-24 bottom-[-80px] h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="text-sm text-emerald-200 mb-3">Злата Фортуна Груп</div>
            <h2 className="text-3xl font-semibold tracking-tight">Вітаємо в робочій панелі</h2>
            <p className="mt-3 text-white/75 leading-relaxed">{businessName} — простір для злагодженої роботи команди, турботи про клієнтів і якісного виконання завдань.</p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-emerald-100 bg-emerald-50/60"><CardContent className="p-5"><HeartHandshake className="w-6 h-6 text-emerald-600 mb-4" /><h3 className="font-semibold text-gray-900">Клієнт у центрі</h3><p className="text-sm text-gray-600 mt-2">Працюємо уважно, доброзичливо та з повагою до кожного звернення.</p></CardContent></Card>
          <Card className="border-blue-100 bg-blue-50/60"><CardContent className="p-5"><ShieldCheck className="w-6 h-6 text-blue-600 mb-4" /><h3 className="font-semibold text-gray-900">Політика компанії</h3><p className="text-sm text-gray-600 mt-2">Зберігаємо конфіденційність, дотримуємося домовленостей і підтримуємо команду.</p></CardContent></Card>
          <Card className="border-violet-100 bg-violet-50/60"><CardContent className="p-5"><Sparkles className="w-6 h-6 text-violet-600 mb-4" /><h3 className="font-semibold text-gray-900">Спільний результат</h3><p className="text-sm text-gray-600 mt-2">Передаємо задачі вчасно та залишаємо після себе зрозумілий результат.</p></CardContent></Card>
        </div>

        <Card><CardContent className="p-6"><div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-gray-900">Робочі розділи</h3><p className="text-sm text-gray-500 mt-1">Оберіть розділ, з яким працюєте сьогодні.</p></div><ArrowRight className="w-5 h-5 text-gray-300" /></div><div className="mt-5 flex flex-wrap gap-3"><Link href="/orders" className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-emerald-400 hover:text-emerald-700">Замовлення</Link><Link href="/chats" className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-emerald-400 hover:text-emerald-700">Чати</Link><Link href="/crm" className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-emerald-400 hover:text-emerald-700">Клієнти</Link></div></CardContent></Card>
      </main>
    </>
  )
}
