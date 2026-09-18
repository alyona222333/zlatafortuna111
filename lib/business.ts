import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * The current authenticated user's business row, or null if none applies.
 *
 * Despite the name (kept for compatibility with existing call sites across
 * every dashboard page), this now resolves TWO cases:
 *   1. The business owner — original behavior, matched on businesses.owner_id.
 *   2. A logged-in employee (director, HR, sales manager, marketer, IT,
 *      analyst, etc.) whose employees row has been linked via user_id
 *      (see the /invite/[token] flow and migration 037). Before this,
 *      every dashboard page called this helper, got `null` for any
 *      non-owner login, and behaved as if that person had no business at
 *      all — which was the real reason staff accounts couldn't "get in"
 *      even once a login existed. RLS (005_security_fixes.sql,
 *      my_business_ids()) already permits this read for an active linked
 *      employee, so this mirrors that instead of hard-coding owner-only.
 *
 * Always ordered by created_at with .limit(1) on the owner path: an owner
 * is meant to have exactly one business row (migration 036 enforces it),
 * but if a race in signup ever produced two, a bare .maybeSingle() returns
 * NO row for a "multiple rows" result — every dashboard page then reads
 * that as "no business" and renders blank with nothing logged (issue #5).
 * Pinning to the oldest row matches what app/(dashboard)/layout.tsx shows.
 *
 * Memoised per server request (React cache()) so the layout and the page
 * it wraps share one query.
 */
export const getBusinessForOwner = cache(async (userId: string) => {
  const supabase = await createClient()

  const { data: owned } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (owned) return owned

  // Linked active employees are allowed to read their tenant through RLS.
  // Resolve them with the authenticated client so a missing service-role key
  // cannot turn a valid employee login into an onboarding redirect loop.
  const { data: myEmployee } = await supabase
    .from('employees')
    .select('business_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!myEmployee) return null

  const { data: employerBiz } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', myEmployee.business_id)
    .maybeSingle()

  return employerBiz
})

/** The caller's own employee row (role, id, etc.) for the given business,
 *  or null if they are the owner (owners have no employees row) or have
 *  no role assigned yet. Used to decide what a non-owner login may see. */
export const getMyEmployeeRole = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.role ?? null
})
