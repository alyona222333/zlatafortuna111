'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Users, Package, CalendarDays, Truck, Wallet,
  MessageCircle, Settings, LogOut, Menu, X, Copy, ShoppingBag, TrendingUp,
  PieChart, LineChart, Sparkles, UserCheck, RefreshCcw, ArrowLeftRight,
  FileText, Receipt, DollarSign, CreditCard, Handshake, Landmark, Mail,
  Tags, Send, Boxes, Upload, Download, History, FolderTree,
  SlidersHorizontal, PackagePlus, PackageMinus, RotateCcw, PhoneCall, Phone,
  Store, LayoutGrid, ListTree, GitBranch, Tag, Link2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { LangSwitcher } from './lang-switcher'

import type { SidebarSection } from '@/lib/permissions'

interface SidebarProps {
  businessName: string
  allowedSections?: SidebarSection[]
  isOwnerOrDirector?: boolean
}

export function Sidebar({ businessName, allowedSections, isOwnerOrDirector = true }: SidebarProps) {
  const t = useTranslations('sidebar')
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const allGroups: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard; section: SidebarSection; ownerOnly?: boolean }[] }[] = [
    { label: '', items: [
      { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard, section: 'dashboard' },
    ]},
    { label: t('groupSales'), items: [
      { href: '/pos', label: t('pos'), icon: ShoppingCart, section: 'pos' },
      { href: '/orders', label: t('orders'), icon: Truck, section: 'orders' },
      { href: '/orders/duplicate', label: t('ordersDuplicates'), icon: Copy, section: 'orders' },
      { href: '/crm', label: t('clients'), icon: Users, section: 'clients' },
      { href: '/team', label: t('team'), icon: UserCheck, section: 'team' },
      { href: '/orders/basket', label: t('ordersBasket'), icon: ShoppingBag, section: 'orders' },
      { href: '/booking', label: t('booking'), icon: CalendarDays, section: 'booking' },
    ]},
    { label: t('groupAnalytics'), items: [
      { href: '/analytics', label: t('analytics'), icon: TrendingUp, section: 'analytics' },
      { href: '/analytics/product-status', label: t('analyticsProductStatus'), icon: PieChart, section: 'analytics' },
      { href: '/analytics/sales', label: t('analyticsSales'), icon: LineChart, section: 'analytics' },
      { href: '/analytics/managers', label: t('analyticsManagers'), icon: UserCheck, section: 'analytics' },
      { href: '/analytics/upsells', label: t('analyticsUpsells'), icon: Sparkles, section: 'analytics' },
    ]},
    { label: t('groupMoney'), items: [
      { href: '/finance', label: t('finance'), icon: Wallet, section: 'finance' },
      { href: '/finance/transactions', label: t('financeTransactions'), icon: ArrowLeftRight, section: 'finance' },
      { href: '/finance/statements', label: t('financeStatements'), icon: FileText, section: 'finance' },
      { href: '/finance/expenses', label: t('financeExpenses'), icon: Receipt, section: 'finance' },
    ]},
    { label: t('groupChats'), items: [
      { href: '/chats', label: t('chats'), icon: MessageCircle, section: 'chats' },
      { href: '/chats/settings', label: t('chatsSettingsLabel'), icon: Settings, section: 'chats', ownerOnly: true },
    ]},
    { label: t('groupProducts'), items: [
      { href: '/products', label: t('productsList'), icon: Boxes, section: 'products' },
      { href: '/products/sets', label: t('productsSets'), icon: Package, section: 'products' },
      { href: '/products/import', label: t('productsImport'), icon: Upload, section: 'products', ownerOnly: true },
      { href: '/products/export', label: t('productsExport'), icon: Download, section: 'products', ownerOnly: true },
      { href: '/products/statuses', label: t('productsStatuses'), icon: Tag, section: 'products', ownerOnly: true },
      { href: '/products/history', label: t('productsHistory'), icon: History, section: 'products', ownerOnly: true },
      { href: '/products/categories', label: t('productsCategories'), icon: FolderTree, section: 'products', ownerOnly: true },
      { href: '/products/settings', label: t('productsSettings'), icon: Settings, section: 'products', ownerOnly: true },
    ]},
    { label: t('groupWarehouse'), items: [
      { href: '/inventory', label: t('inventory'), icon: Package, section: 'inventory' },
      { href: '/inventory/purchase', label: t('inventoryPurchase'), icon: PackagePlus, section: 'inventory' },
      { href: '/inventory/returns', label: t('inventoryReturns'), icon: RotateCcw, section: 'inventory' },
      { href: '/inventory/returns/history', label: t('inventoryReturnsHistory'), icon: History, section: 'inventory' },
      { href: '/inventory/transfer', label: t('inventoryTransfer'), icon: ArrowLeftRight, section: 'inventory' },
      { href: '/inventory/stocktaking', label: t('inventoryStocktaking'), icon: ListTree, section: 'inventory' },
    ]},
    { label: t('groupSuppliers'), items: [
      { href: '/suppliers', label: t('suppliers'), icon: Link2, section: 'suppliers' },
    ]},
    { label: t('groupDelivery'), items: [
      { href: '/delivery/nova-poshta', label: t('deliveryNpRegistry'), icon: Truck, section: 'delivery' },
      { href: '/delivery/nova-poshta/settings', label: t('deliveryNpSettings'), icon: Settings, section: 'delivery', ownerOnly: true },
    ]},
    { label: '', items: [
      { href: '/modules', label: t('modules'), icon: LayoutGrid, section: 'modules' },
    ]},
  ]

  const nav = allGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (allowedSections && !allowedSections.includes(i.section)) return false
        if (i.ownerOnly && !isOwnerOrDirector) return false
        return true
      }),
    }))
    .filter((g) => g.items.length > 0)
  const showSettings = !allowedSections || allowedSections.includes('settings')

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navLinks = (
    <>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'pt-3' : ''}>
            {group.label && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {group.label}
              </div>
            )}
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'text-[#4ade80]'
                  : 'text-white/[0.55] hover:text-white/80'
              )}
              style={
                pathname === href || pathname.startsWith(href + '/')
                  ? { backgroundColor: 'rgba(22,163,74,0.15)' }
                  : undefined
              }
              onMouseEnter={(e) => {
                if (!(pathname === href || pathname.startsWith(href + '/')))
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={(e) => {
                if (!(pathname === href || pathname.startsWith(href + '/')))
                  (e.currentTarget as HTMLElement).style.backgroundColor = ''
              }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-0.5">
        <LangSwitcher />
        {showSettings && (
        <Link href="/settings" onClick={() => setOpen(false)} className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          pathname.startsWith('/settings')
            ? 'text-[#4ade80]'
            : 'text-white/[0.55] hover:text-white/80'
        )}
        style={
          pathname.startsWith('/settings')
            ? { backgroundColor: 'rgba(22,163,74,0.15)' }
            : undefined
        }
        onMouseEnter={(e) => {
          if (!pathname.startsWith('/settings'))
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'
        }}
        onMouseLeave={(e) => {
          if (!pathname.startsWith('/settings'))
            (e.currentTarget as HTMLElement).style.backgroundColor = ''
        }}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {t('settings')}
        </Link>
        )}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/[0.55] hover:text-white/80 transition-colors"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t('signOut')}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="font-bold text-base" style={{ color: '#111' }}>
          Злата Фортуна<span style={{ color: '#16a34a' }}>.</span>
        </div>
        <div className="text-sm text-gray-500 truncate flex-1">{businessName}</div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0 border-r border-white/10" style={{ backgroundColor: '#0d1b2e' }}>
        <div className="px-5 py-5 border-b border-white/10">
          <div className="font-bold text-lg" style={{ color: '#fff' }}>Злата Фортуна<span style={{ color: '#16a34a' }}>.</span></div>
          <div className="text-xs text-white/40 truncate mt-0.5">{businessName}</div>
        </div>
        {navLinks}
      </aside>

      {/* Mobile drawer */}
      <aside className={cn(
        'md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-white/10',
        'transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )} style={{ backgroundColor: '#0d1b2e' }}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg" style={{ color: '#fff' }}>Злата Фортуна<span style={{ color: '#16a34a' }}>.</span></div>
            <div className="text-xs text-white/40 truncate mt-0.5">{businessName}</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/70 transition-colors"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {navLinks}
      </aside>
    </>
  )
}
