import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTelegramDocument, sendTelegramMessage } from '@/lib/telegram'
import { sendViberMessage } from '@/lib/viber'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''
  let businessId = ''; let clientId = ''; let channel = ''; let body = ''; let file: File | null = null
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    businessId = String(form.get('businessId') ?? ''); clientId = String(form.get('clientId') ?? ''); channel = String(form.get('channel') ?? 'telegram'); body = String(form.get('body') ?? '')
    const candidate = form.get('file'); if (candidate instanceof File && candidate.size > 0) file = candidate
  } else {
    const json = await request.json().catch(() => ({})); businessId = json.businessId ?? ''; clientId = json.clientId ?? ''; channel = json.channel ?? ''; body = json.body ?? ''
  }
  if (!businessId || !clientId || !channel || (!body.trim() && !file)) return NextResponse.json({ error: 'businessId, clientId and message or file required' }, { status: 400 })
  if (file && file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File is too large (maximum 10 MB)' }, { status: 400 })

  const [{ data: business }, { data: client }] = await Promise.all([
    supabase.from('businesses').select('telegram_bot_token, viber_bot_token').eq('id', businessId).maybeSingle(),
    supabase.from('clients').select('telegram_id, viber_user_id').eq('id', clientId).maybeSingle(),
  ])
  if (!business || !client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let attachmentUrl: string | null = null; let attachmentName: string | null = null; let attachmentType: string | null = null
  if (file) {
    const admin = createServiceClient(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${businessId}/${clientId}/${crypto.randomUUID()}-${safeName}`
    const uploaded = await admin.storage.from('chat-attachments').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 })
    attachmentUrl = admin.storage.from('chat-attachments').getPublicUrl(path).data.publicUrl; attachmentName = file.name; attachmentType = file.type || null
  }

  let ok = false
  if (channel === 'telegram') {
    if (!business.telegram_bot_token || !client.telegram_id) return NextResponse.json({ error: 'Telegram не підключено для цього клієнта' }, { status: 400 })
    ok = file ? await sendTelegramDocument(business.telegram_bot_token, client.telegram_id, attachmentUrl!, body || attachmentName || '') : await sendTelegramMessage(business.telegram_bot_token, client.telegram_id, body)
  } else if (channel === 'viber') {
    if (!business.viber_bot_token || !client.viber_user_id) return NextResponse.json({ error: 'Viber не підключено для цього клієнта' }, { status: 400 })
    ok = await sendViberMessage(business.viber_bot_token, client.viber_user_id, [body, attachmentUrl].filter(Boolean).join('\n\n'))
  } else return NextResponse.json({ error: 'Unsupported channel' }, { status: 400 })
  if (!ok) return NextResponse.json({ error: 'Не вдалося надіслати повідомлення' }, { status: 502 })

  const { data: saved, error } = await supabase.from('messages').insert({ business_id: businessId, client_id: clientId, channel, direction: 'out', body: body || attachmentName || '', attachment_url: attachmentUrl, attachment_name: attachmentName, attachment_type: attachmentType } as never).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(saved)
}
