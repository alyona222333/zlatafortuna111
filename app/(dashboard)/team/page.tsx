import { redirect } from 'next/navigation'

// The team workspace reuses the existing employee management and invitation
// flow, while giving it a clear first-class route in the CRM navigation.
export default function TeamPage() {
  redirect('/settings?tab=employees')
}
