# Отправка проекта в GitHub из Linux

Команды выполняйте из корня проекта: `cd /path/to/pronto-main`. Перед отправкой проверьте `npm run build`.

## Вариант 1. Новый репозиторий по HTTPS

```bash
cd /path/to/pronto-main
git init
git branch -M main
git add .
git commit -m "Update store manager workflow, return security audit and receipt UI"
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

GitHub запросит имя пользователя и Personal Access Token вместо пароля. Токен не записывайте в файлы и не передавайте в чат.

## Вариант 2. Уже подключённый remote

```bash
cd /path/to/pronto-main
git status
git add app lib supabase/migrations docs package.json package-lock.json
git commit -m "Add COD return monitoring and upsell receipt confirmation"
git push origin main
```

## Вариант 3. SSH

```bash
ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub
# добавьте ключ в GitHub → Settings → SSH and GPG keys
ssh -T git@github.com
cd /path/to/pronto-main
git remote set-url origin git@github.com:USERNAME/REPOSITORY.git
git push -u origin main
```

## Вариант 4. Обновить ветку и отправить отдельную ветку

```bash
git fetch origin
git checkout -b feature/return-security-and-receipts
git add .
git commit -m "Add return security alerts and receipt modal"
git push -u origin feature/return-security-and-receipts
```

После проверки можно объединить ветку в GitHub Pull Request.

## Вариант 5. Синхронизация с Netlify

Netlify обычно собирает production branch автоматически после `git push`. Для ручной проверки: `npm ci`, затем `npm run build`. В Netlify должны быть заданы переменные Supabase, `NEXT_PUBLIC_APP_URL` и платёжные ключи. Миграцию `supabase/migrations/065_return_security_audit.sql` примените в Supabase до проверки уведомлений безопасности.

## Быстрая проверка перед push

```bash
npm ci
npx tsc --noEmit --pretty false
npm run build
git diff --check
git status
```
