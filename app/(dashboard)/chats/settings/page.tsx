import { redirect } from 'next/navigation'

// Chat integrations are configured in the working Notifications tab.
// Keep this legacy menu entry useful instead of rendering a dead-end placeholder.
export default function ChatSettingsPage() {
  redirect('/settings?tab=notifications')
}
