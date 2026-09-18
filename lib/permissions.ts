/**
 * Role -> permission profile.
 *
 * Data access (RLS) is still tenant-wide for any linked employee — see
 * migration 005/037. This file controls what shows up in the app for
 * each role. It is a UI convenience, not a security boundary by itself:
 * treat it as "don't show people things they don't need", and pair any
 * screen that must actually be locked down with a real RLS/API check.
 *
 * ROLE_LABELS gives each slug a Ukrainian/Russian display name — the
 * `role` column itself stays free text, so this is just how the fixed
 * set renders in the Employees UI. Business owners always see everything
 * regardless of their `role` value.
 */

export const ROLE_SLUGS = [
  'director',
  'sales_director',
  'services_director',
  'marketing_director',
  'it_director',
  'analytics_director',
  'hr',
  'legal',
  'security',
  'sales_manager',
  'sales_manager_store',
  'sales_manager_services',
  'marketer',
  'accountant',
  'it',
  'analyst',
  'investment_analyst',
  'employee',
] as const

export type RoleSlug = (typeof ROLE_SLUGS)[number]

export const ROLE_LABELS: Record<RoleSlug, { uk: string; ru: string; en: string }> = {
  director:      { uk: 'Директор', ru: 'Директор', en: 'Director' },
  sales_director: { uk: 'Директор відділу продажів', ru: 'Директор отдела продаж', en: 'Sales director' },
  services_director: { uk: 'Директор напрямку послуг', ru: 'Директор направления услуг', en: 'Services director' },
  marketing_director: { uk: 'Директор з маркетингу', ru: 'Директор по маркетингу', en: 'Marketing director' },
  it_director: { uk: 'Директор IT-напрямку', ru: 'Директор IT-направления', en: 'IT director' },
  analytics_director: { uk: 'Директор аналітики', ru: 'Директор аналитики', en: 'Analytics director' },
  hr:            { uk: 'HR / Кадри', ru: 'HR / Кадры', en: 'HR / People' },
  legal:         { uk: 'Юрист', ru: 'Юрист', en: 'Legal' },
  security:      { uk: 'Служба безпеки', ru: 'Служба безопасности', en: 'Security' },
  sales_manager: { uk: 'Менеджер з продажів', ru: 'Менеджер по продажам', en: 'Sales manager' },
  sales_manager_store: { uk: 'Менеджер з продажів — інтернет-магазин', ru: 'Менеджер по продажам — интернет-магазин', en: 'Sales manager — online store' },
  sales_manager_services: { uk: 'Менеджер з продажів — послуги', ru: 'Менеджер по продажам — услуги', en: 'Sales manager — services' },
  marketer: { uk: 'Маркетолог', ru: 'Маркетолог', en: 'Marketer' },
  accountant: { uk: 'Бухгалтер', ru: 'Бухгалтер', en: 'Accountant' },
  it: { uk: 'IT', ru: 'IT', en: 'IT' },
  analyst: { uk: 'Аналітик', ru: 'Аналитик', en: 'Analyst' },
  investment_analyst: { uk: 'Аналітик інвестицій', ru: 'Аналитик инвестиций', en: 'Investment analyst' },
  employee: { uk: 'Співробітник', ru: 'Сотрудник', en: 'Employee' },
}

export type SidebarSection =
  | 'dashboard' | 'pos' | 'clients' | 'inventory' | 'team'
  | 'booking' | 'orders' | 'chats' | 'analytics' | 'finance' | 'settings'
  | 'products' | 'delivery' | 'calls' | 'packaging' | 'saleSources' | 'statuses' | 'modules'
  | 'suppliers' | 'workspace' | 'instructions' | 'inventory_transfer' | 'inventory_stocktaking'

const ALL_SECTIONS: SidebarSection[] = [
  'dashboard', 'pos', 'clients', 'inventory', 'team', 'booking', 'orders', 'chats', 'analytics', 'finance', 'settings',
  'products', 'delivery', 'calls', 'packaging', 'saleSources', 'statuses', 'modules', 'workspace', 'instructions',
  'suppliers',
]

/** `suppliers` — прайси, закупівельні ціни й журнал «що закінчилось у
 *  постачальника». Є тільки у власника та `director`: менеджер бачить
 *  наявність у «Складі», але не джерела й не собівартість. RLS міграції
 *  048 стереже те саме на рівні бази.
 *
 *  Sidebar sections visible to each role. `director` (and the business
 *  owner, handled separately) always gets everything. `analytics` and
 *  `finance` are intentionally withheld from every other role by default —
 *  they show revenue/financial figures, and the owner asked that nobody
 *  else see those. Add them back to a specific role here if that ever
 *  changes; the database (migration 039) enforces the real restriction
 *  either way, this list only controls what shows in the menu.
 *
 *  `inventory` («Склад») відкрито директору і менеджерам з продажів:
 *  саме вони щодня дивляться, чи є товар у постачальника, перш ніж
 *  підтвердити замовлення. Закупівельні ціни там усе одно лишаються за
 *  owner/director — це стережуть RLS-політики міграції 047, а не цей файл.
 *
 *  `products`, `delivery`, `calls`, `packaging`, `saleSources` and
 *  `statuses` are day-to-day operational sections (no financial data),
 *  so sales-facing roles get them alongside `orders`. `modules` toggles
 *  paid feature add-ons and stays limited to `director`/`it`, same as
 *  `settings`. */
export const ROLE_SECTIONS: Record<RoleSlug, SidebarSection[]> = {
  director:      ALL_SECTIONS,
  sales_director: ['dashboard', 'clients', 'orders', 'chats', 'inventory', 'delivery', 'analytics', 'workspace'],
  services_director: ['dashboard', 'clients', 'booking', 'orders', 'chats', 'analytics', 'saleSources', 'workspace'],
  marketing_director: ['dashboard', 'orders', 'chats', 'analytics', 'saleSources', 'workspace'],
  it_director: ['dashboard', 'chats', 'settings', 'modules', 'workspace'],
  analytics_director: ['dashboard', 'orders', 'analytics', 'chats', 'workspace'],
  hr:            ['dashboard', 'team', 'settings', 'workspace'],
  legal:         ['dashboard', 'orders', 'chats', 'workspace'],
  security:      ['dashboard', 'team', 'chats', 'workspace'],
  sales_manager: ['dashboard', 'pos', 'clients', 'booking', 'orders', 'chats', 'products', 'inventory', 'inventory_transfer', 'inventory_stocktaking', 'delivery', 'calls', 'packaging', 'saleSources', 'statuses', 'workspace'],
  // Online-store sales: orders, customers, chats, stock and Nova Poshta only.
  sales_manager_store: ['dashboard', 'clients', 'orders', 'chats', 'inventory', 'delivery', 'workspace', 'instructions'],
  sales_manager_services: ['dashboard', 'clients', 'booking', 'orders', 'chats', 'saleSources', 'workspace'],
  marketer:      ['dashboard', 'orders', 'chats', 'saleSources', 'workspace'],
  accountant:    ['dashboard', 'finance', 'orders', 'workspace'],
  it:            ['dashboard', 'orders', 'chats', 'settings', 'modules', 'workspace'],
  analyst:       ['dashboard', 'orders', 'analytics', 'workspace'],
  investment_analyst: ['dashboard', 'orders', 'analytics', 'workspace'],
  employee:      ['dashboard', 'pos', 'booking', 'clients', 'orders', 'chats', 'delivery', 'calls', 'packaging', 'workspace'],
}

/** Which Settings tabs each role may see, once they have the 'settings'
 *  section at all (see ROLE_SECTIONS). Owner/director always get all tabs. */
export const ROLE_SETTINGS_TABS: Partial<Record<RoleSlug, string[]>> = {
  hr: ['employees', 'account'],
  it: ['notifications', 'modules', 'account', 'general'],
}

export function sectionsForRole(role: string | null | undefined, isOwner: boolean): SidebarSection[] {
  if (isOwner) return ALL_SECTIONS
  const slug = (role ?? '') as RoleSlug
  // Unknown or legacy values must never grant owner-level access.
  return ROLE_SECTIONS[slug] ?? ROLE_SECTIONS.employee
}

export function settingsTabsForRole(role: string | null | undefined, isOwner: boolean): string[] | null {
  if (isOwner) return null // null = no restriction, show all tabs
  const slug = (role ?? '') as RoleSlug
  if (slug === 'director') return null
  return ROLE_SETTINGS_TABS[slug] ?? null
}
