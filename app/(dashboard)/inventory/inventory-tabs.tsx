'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { WarehouseTable } from './warehouse-table'
import { SalesTab } from './sales-tab'

interface Props {
  currency: string
  initialFilter?: string
  initialTab?: string
}

type Tab = 'items' | 'sales'

export function WarehouseTabs({ currency, initialFilter, initialTab }: Props) {
  const t = useTranslations('inventory')
  const [activeTab, setActiveTab] = useState<Tab>(initialTab === 'sales' ? 'sales' : 'items')

  return (
    <>
      <div className="flex gap-0 border-b border-gray-200 mb-5">
        {(['items', 'sales'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'items'
        ? <WarehouseTable currency={currency} initialFilter={initialFilter} />
        : <SalesTab />}
    </>
  )
}

// Стара назва лишається експортованою: на неї посилаються інші екрани
// складу, і міняти їх усі заради перейменування сенсу немає.
export { WarehouseTabs as InventoryTabs }
