import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'

export default async function ProductCategoriesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')
  const supabase = await createClient()
  const { data } = await supabase.from('inventory_items').select('category').eq('business_id', business.id)
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const category = row.category?.trim() || 'Без категорії'
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  const categories = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'uk'))

  return (
    <>
      <Header title="Категорії товарів" />
      <main className="p-4 md:p-6">
        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          <Link href="/products" className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50">Перелік товарів</Link>
          <Link href="/products/categories" className="rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-700">Категорії</Link>
        </div>
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">Категорії формуються автоматично з товарів. Для нового товару категорію можна вказати під час створення або редагування.</div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {categories.length === 0 ? <div className="p-10 text-center text-gray-400">Категорій ще немає. Додайте перший товар.</div> : (
            <div className="divide-y divide-gray-100">
              {categories.map(([name, count]) => (
                <Link key={name} href={name === 'Без категорії' ? '/products' : `/products?category=${encodeURIComponent(name)}`} className="flex items-center justify-between px-4 py-4 hover:bg-gray-50">
                  <span className="font-medium text-gray-900">{name}</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">{count} товарів</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
