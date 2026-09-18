import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const form = await request.formData()
  const businessId = String(form.get('businessId') ?? '')
  const channelId = String(form.get('channelId') ?? '') || null
  const recipientId = String(form.get('recipientId') ?? '') || null
  const text = String(form.get('body') ?? '').trim()
  const fileValue = form.get('file')
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null
  if (!businessId || (!channelId && !recipientId) || (!text && !file)) return NextResponse.json({ error: 'Message, recipient or file is required' }, { status: 400 })
  if (file && file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File is too large (maximum 10 MB)' }, { status: 400 })
  let attachmentUrl: string | null = null
  let attachmentName: string | null = null
  let attachmentType: string | null = null
  if (file) {
    const admin = createServiceClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${businessId}/internal/${crypto.randomUUID()}-${safeName}`
    const uploaded = await admin.storage.from('chat-attachments').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 })
    attachmentUrl = admin.storage.from('chat-attachments').getPublicUrl(path).data.publicUrl
    attachmentName = file.name
    attachmentType = file.type || null
  }
  const db = supabase as any
  const { data, error } = await db.from('internal_messages').insert({ business_id: businessId, channel_id: channelId, recipient_id: recipientId, sender_id: user.id, body: text, attachment_url: attachmentUrl, attachment_name: attachmentName, attachment_type: attachmentType }).select('id, body, sender_id, recipient_id, channel_id, attachment_url, attachment_name, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const payload = await request.json().catch(() => ({}))
  const messageId = String(payload.id ?? '')
  if (!messageId) return NextResponse.json({ error: 'Message id is required' }, { status: 400 })
  const { error } = await (supabase as any).from('internal_messages').delete().eq('id', messageId)
  if (error) return NextResponse.json({ error: 'Only the General Director can delete messages' }, { status: 403 })
  return NextResponse.json({ ok: true, id: messageId })
}
