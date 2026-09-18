'use client'

import { useMemo, useState } from 'react'
import { Send, Users, ShieldCheck, Paperclip, UserRound, Trash2 } from 'lucide-react'

type Channel = { id: string; slug: string; name: string; description: string | null }
type Message = { id: string; body: string; sender_id: string; recipient_id: string | null; channel_id: string | null; attachment_url: string | null; attachment_name: string | null; created_at: string }
type Employee = { user_id: string; name: string; role: string; is_active: boolean }

export function WorkspaceView({ businessId, channels, initialMessages, employees, userId, canDelete }: { businessId: string; channels: Channel[]; initialMessages: Message[]; employees: Employee[]; userId: string; canDelete: boolean }) {
  const [mode, setMode] = useState<'channel' | 'private'>('channel')
  const [active, setActive] = useState(channels[0]?.id ?? '')
  const [recipient, setRecipient] = useState(employees[0]?.user_id ?? '')
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const activeMessages = useMemo(() => mode === 'channel' ? messages.filter((m) => m.channel_id === active && !m.recipient_id) : messages.filter((m) => m.channel_id === null && ((m.sender_id === userId && m.recipient_id === recipient) || (m.sender_id === recipient && m.recipient_id === userId))), [messages, active, mode, recipient, userId])
  const activeEmployee = employees.find((employee) => employee.user_id === recipient)

  async function send() {
    if ((!text.trim() && !file) || sending || (mode === 'private' && !recipient)) return
    setSending(true)
    setSendError('')
    const form = new FormData()
    form.append('businessId', businessId)
    form.append('body', text)
    if (mode === 'channel') form.append('channelId', active)
    else form.append('recipientId', recipient)
    if (file) form.append('file', file)
    const response = await fetch('/api/internal-workspace/messages', { method: 'POST', body: form })
    const saved = await response.json()
    if (response.ok) { setMessages((current) => [...current, saved]); setText(''); setFile(null); const input = document.getElementById('workspace-file') as HTMLInputElement | null; if (input) input.value = '' }
    else setSendError(saved.error ?? 'Не вдалося надіслати повідомлення')
    setSending(false)
  }

  async function removeMessage(id: string) {
    if (!canDelete || deleting) return
    setDeleting(id)
    const response = await fetch('/api/internal-workspace/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (response.ok) setMessages((current) => current.filter((message) => message.id !== id))
    else setSendError('Повідомлення не видалено')
    setDeleting(null)
  }

  return <main className="p-6 space-y-5">
    <section className="rounded-2xl bg-gradient-to-br from-[#0d1b2e] via-[#163b49] to-[#146c5b] p-7 text-white"><div className="flex items-start gap-4"><Users className="mt-1 h-7 w-7 text-emerald-200" /><div><h1 className="text-2xl font-semibold">Робочий простір</h1><p className="mt-2 max-w-2xl text-sm text-white/75">Чати відділів і особисті повідомлення співробітників.</p></div></div></section>
    <div className="grid min-h-[600px] gap-5 lg:grid-cols-[290px_1fr]">
      <aside className="rounded-xl border bg-white p-3"><div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Робочі чати</div><button onClick={() => setMode('private')} className={`mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm ${mode === 'private' ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-50'}`}><UserRound className="h-4 w-4" />Особисті повідомлення</button>{channels.map((channel) => <button key={channel.id} onClick={() => { setMode('channel'); setActive(channel.id) }} className={`w-full rounded-lg px-3 py-3 text-left ${mode === 'channel' && active === channel.id ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700 hover:bg-gray-50'}`}><div className="text-sm font-medium">{channel.name}</div><div className="mt-1 text-xs text-gray-400">{channel.description}</div></button>)}</aside>
      <section className="flex min-h-[600px] flex-col rounded-xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div className="flex items-center gap-2 text-gray-900"><ShieldCheck className="h-4 w-4 text-emerald-600" />{mode === 'private' ? `Особисто: ${activeEmployee?.name ?? 'оберіть співробітника'}` : channels.find((c) => c.id === active)?.name ?? 'Оберіть канал'}</div><p className="mt-1 text-xs text-gray-400">{mode === 'private' ? 'Видно відправнику, отримувачу та генеральному директору' : 'Робочий чат відділу'}</p></div>{mode === 'private' && <select value={recipient} onChange={(e) => setRecipient(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">Оберіть співробітника</option>{(() => { const normalize = (value: string) => value.trim().toLowerCase(); const isDirector = (e: Employee) => ['director', 'генеральний директор', 'генеральный директор', 'директор'].includes(normalize(e.role)); const isHead = (e: Employee) => ['sales_director','marketing_director','it_director','services_director','analytics_director','директор відділу продажів','директор отдела продаж','директор відділу маркетингу','директор по маркетингу','керівник відділу постачання','керівник відділу it','керівник відділу'].includes(normalize(e.role)) || /директор|керівник|руководитель/i.test(e.role); const director = employees.filter(isDirector); const heads = employees.filter(e => !isDirector(e) && isHead(e)); const staff = employees.filter(e => !isDirector(e) && !isHead(e)); const group = (label: string, list: Employee[]) => list.length ? <optgroup key={label} label={label}>{list.map(e => <option key={e.user_id} value={e.user_id}>{e.name}</option>)}</optgroup> : null; return <>{group('Генеральний директор', director)}{group('Керівники відділів', heads)}{group('Співробітники', staff)}</> })()}</select>}</div><div className="flex-1 space-y-3 overflow-y-auto p-5">{activeMessages.length ? activeMessages.map((message) => <div key={message.id} className={`group relative max-w-[80%] rounded-xl px-4 py-3 text-sm ${message.sender_id === userId ? 'ml-auto bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{message.body && <div>{message.body}</div>}{message.attachment_url && <a href={message.attachment_url} target="_blank" rel="noreferrer" className="mt-2 block underline">{message.attachment_name ?? 'Відкрити файл'}</a>}<div className="mt-1 flex items-center justify-between gap-3 text-[10px] opacity-60"><span>{new Date(message.created_at).toLocaleString()}</span>{canDelete && <button title="Видалити повідомлення" onClick={() => void removeMessage(message.id)} disabled={deleting === message.id} className="opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>}</div></div>) : <div className="flex h-full items-center justify-center text-sm text-gray-400">Повідомлень поки немає</div>}</div><div className="border-t p-4"><div className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} placeholder="Напишіть повідомлення…" className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-500" /><button onClick={() => void send()} disabled={sending || (!text.trim() && !file) || (mode === 'private' && !recipient)} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button></div>{sendError && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{sendError}</div>}<div className="mt-2 flex items-center gap-3 text-xs text-gray-500"><label htmlFor="workspace-file" className="flex cursor-pointer items-center gap-1 text-blue-600"><Paperclip className="h-3.5 w-3.5" />Прикріпити файл</label><input id="workspace-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />{file && <span className="truncate">{file.name}</span>}</div></div></section>
    </div>
  </main>
}
