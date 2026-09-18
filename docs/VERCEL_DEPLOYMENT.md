# Перенос CRM с Netlify на Vercel через GitHub

Netlify можно оставить как текущую рабочую копию: уже опубликованный сайт продолжит работать. Для новых сборок подключите репозиторий `alyona222333/zlatafortuna111` к Vercel.

## Шаги

1. Откройте https://vercel.com/new и войдите через GitHub.
2. Нажмите **Continue with GitHub**.
3. Выберите репозиторий `alyona222333/zlatafortuna111`.
4. Нажмите **Import**.
5. Оставьте Framework: **Next.js**.
6. Добавьте переменные окружения для Production, Preview и Development:

```text
NEXT_PUBLIC_APP_URL=https://zlatafortuna111.lelakrimska.workers.dev
NEXT_PUBLIC_SITE_URL=https://zlatafortuna111.lelakrimska.workers.dev
NEXT_PUBLIC_SUPABASE_URL=https://ВАШ-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_anon_key
SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_key
```

Значения Supabase берутся из Supabase → Project Settings → API. Секретный service role key никому не отправляйте.

7. Нажмите **Deploy**.

После этого Vercel выдаст временный адрес вида `*.vercel.app`. Сначала проверьте вход, приглашения, чаты и заказы на этом адресе.

## Подключение собственного домена

В Vercel откройте **Project → Settings → Domains → Add** и введите домен. Vercel покажет точные DNS-записи. Добавьте их у регистратора домена. Используйте именно записи, которые покажет Vercel.

После подключения домена замените в переменных окружения `NEXT_PUBLIC_APP_URL` и `NEXT_PUBLIC_SITE_URL` на новый домен и добавьте новый домен в Supabase → Authentication → URL Configuration:

```text
https://ВАШ-ДОМЕН/auth/callback
https://ВАШ-ДОМЕН/reset-password
https://ВАШ-ДОМЕН/**
```

## Автоматические обновления

После подключения GitHub каждый `git push` запускает новую сборку Vercel. Netlify можно отключить или оставить как резервный сайт. Один домен нельзя одновременно направить и на Netlify, и на Vercel.
