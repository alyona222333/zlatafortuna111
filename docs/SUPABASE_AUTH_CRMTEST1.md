# Настройки Supabase Auth для CRM

В Supabase откройте **Authentication → URL Configuration** и вставьте значения ниже.

## Site URL

```text
https://zlatafortuna111.lelakrimska.workers.dev
```

## Redirect URLs

Добавьте каждую ссылку отдельной строкой:

```text
https://zlatafortuna111.lelakrimska.workers.dev/auth/callback
https://zlatafortuna111.lelakrimska.workers.dev/reset-password
https://zlatafortuna111.lelakrimska.workers.dev/**
```

Нажмите **Save changes**. Старый адрес `https://fastidious-dango-e284f6.netlify.app` можно удалить после перехода на новый домен.

После публикации проекта в Netlify проверьте переменные окружения:

```text
NEXT_PUBLIC_APP_URL=https://zlatafortuna111.lelakrimska.workers.dev
NEXT_PUBLIC_SITE_URL=https://zlatafortuna111.lelakrimska.workers.dev
```
