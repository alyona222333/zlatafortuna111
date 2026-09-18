# Netlify environment variables

В Netlify → Site configuration → Environment variables установите точно:

```text
NEXT_PUBLIC_APP_URL=https://zlatafortuna111.lelakrimska.workers.dev
NEXT_PUBLIC_SITE_URL=https://zlatafortuna111.lelakrimska.workers.dev
```

Не вставляйте кавычки, пробелы, `****` или старый домен. Значения Supabase должны быть реальными значениями из проекта Supabase:

```text
NEXT_PUBLIC_SUPABASE_URL=https://ВАШ-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_anon_key
SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_key
```

После сохранения переменных запустите **Deploys → Trigger deploy → Deploy site**.
