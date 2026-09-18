# Инструкция разработчика: роли, кабинеты и права доступа

## 1. Что было причиной одинаковых кабинетов

В приложении видимость разделов строится не по названию, которое отображается в интерфейсе, а по значению `employees.role` для конкретного пользователя. Добавление новых вариантов в `ROLE_LABELS` само по себе не меняет роли уже существующих сотрудников в базе данных.

Дополнительно владелец бизнеса определяется по `businesses.owner_id`. Владелец всегда получает полный доступ независимо от значения `employees.role`. Поэтому при проверке под главным аккаунтом все разделы должны быть видны — это ожидаемое поведение. Проверять ограничения нужно под отдельным аккаунтом сотрудника, который привязан к строке `employees.user_id`.

## 2. Подготовка проекта локально

Распакуйте последний архив и перейдите в каталог проекта:

```bash
cd ~/Downloads
rm -rf pronto-main
unzip -q pronto-zlata-fortuna-copy-clean-fixed.zip
cd pronto-main
```

Проверьте, что проект действительно содержит последние изменения:

```bash
test -f "app/(dashboard)/workspace/workspace-view.tsx" && echo "workspace: OK"
test -f "supabase/migrations/060_private_department_chats.sql" && echo "private chats migration: OK"
test -f "supabase/migrations/061_clean_workspace_copy.sql" && echo "copy cleanup migration: OK"
```

## 3. Публикация в GitHub

```bash
git init
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/alyona222333/zlatafortuna111.git
git add -A
git commit -m "fix: enforce department roles and private workspace access"
git push --force -u origin main
```

Если GitHub сообщает `nothing to commit`, это не ошибка: изменения уже находятся в текущем локальном коммите. В этом случае выполните:

```bash
git push --force -u origin main
```

## 4. Применение миграций Supabase

```bash
npx supabase login
npx supabase link --project-ref obwkpauqdnsbfidayqqt
npx supabase db push --include-all
```

Для этой версии важны миграции:

| Миграция | Назначение |
|---|---|
| `058_client_data_role_access.sql` | Ограничивает клиентскую базу для продаж и руководства |
| `059_internal_workspace.sql` | Создаёт рабочие каналы и сообщения |
| `060_private_department_chats.sql` | Добавляет личные сообщения, получателей и политики приватности |
| `061_clean_workspace_copy.sql` | Исправляет описания каналов |

## 5. Проверка сотрудников и ролей

В Supabase откройте SQL Editor и выполните запрос без изменения данных:

```sql
select
  e.id,
  e.name,
  e.email,
  e.user_id,
  e.role,
  e.is_active,
  e.business_id,
  b.owner_id
from public.employees e
join public.businesses b on b.id = e.business_id
order by e.name;
```

Для каждого сотрудника должны выполняться условия:

- `user_id` заполнен;
- `is_active = true`;
- `role` содержит системный slug, а не произвольный текст;
- `user_id` не совпадает с `businesses.owner_id`, если это обычный сотрудник.

## 6. Рекомендуемые значения ролей

В базе хранятся именно slug-значения:

```text
director
sales_director
sales_manager
sales_manager_store
sales_manager_services
marketer
marketing_director
accountant
hr
legal
security
it
it_director
analyst
analytics_director
investment_analyst
employee
```

Пример назначения менеджера интернет-магазина:

```sql
update public.employees
set role = 'sales_manager_store'
where email = 'EMAIL_СОТРУДНИКА'
  and business_id = 'BUSINESS_UUID';
```

Пример назначения руководителя отдела продаж:

```sql
update public.employees
set role = 'sales_director'
where email = 'EMAIL_РУКОВОДИТЕЛЯ'
  and business_id = 'BUSINESS_UUID';
```

Пример назначения менеджера услуг:

```sql
update public.employees
set role = 'sales_manager_services'
where email = 'EMAIL_СОТРУДНИКА'
  and business_id = 'BUSINESS_UUID';
```

После изменения роли сотрудник должен полностью выйти из CRM и войти снова.

## 7. Кабинет менеджера интернет-магазина

Разрешённые разделы:

- Панель;
- Заказы;
- Дубли заказов;
- Клиенты;
- Корзина;
- Чаты;
- Склад — список, возвраты, история возвратов;
- Доставка — реестры Новой Почты;
- Рабочее пространство.

Недоступны:

- Инвентаризация;
- Перемещения между складами;
- Поставщики;
- Закупка товара;
- Финансы;
- Аналитика;
- Настройки;
- Импорт и экспорт каталога;
- Управление модулями.

Для этого добавлены отдельные права `inventory_transfer` и `inventory_stocktaking`. Ранее все пункты склада были объединены под общим флагом `inventory`, из-за чего инвентаризация отображалась у менеджера магазина.

## 8. Проверка приватных рабочих чатов

После применения миграций проверьте наличие каналов:

```sql
select slug, name, description
from public.internal_channels
where business_id = 'BUSINESS_UUID'
order by created_at;
```

Проверьте наличие новых полей:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'internal_messages'
order by ordinal_position;
```

Должны присутствовать:

```text
recipient_id
attachment_url
attachment_name
attachment_type
```

Функциональная проверка выполняется под двумя тестовыми аккаунтами:

1. Сотрудник A открывает `Рабочее пространство`, выбирает сотрудника B и отправляет личное сообщение.
2. Сотрудник B должен увидеть это сообщение.
3. Третий сотрудник без доступа к этому диалогу не должен его увидеть.
4. Руководитель должен видеть диалог.
5. В канал отдела можно отправить файл до 10 МБ.
6. Файл должен появиться в сообщении ссылкой с исходным именем.

## 9. Как проверить, что пользователь не владелец

Если под учётной записью видны все разделы, сначала проверьте UID:

```sql
select auth.uid();
```

Сопоставьте его с владельцем:

```sql
select owner_id, name
from public.businesses
where id = 'BUSINESS_UUID';
```

Если UID совпадает с `owner_id`, это главный аккаунт и полный доступ является штатным. Для проверки роли нужен отдельный пользователь, приглашённый через команду, с отдельным `auth.users.id` и заполненным `employees.user_id`.

## 10. Контрольная проверка перед публикацией

Локально:

```bash
npx tsc --noEmit --pretty false
node -e "for (const f of ['messages/uk.json','messages/ru.json','messages/en.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('locales ok')"
npm run build
```

В Netlify:

1. Откройте проект `fastidious-dango-e284f6`.
2. Убедитесь, что production branch — `main`.
3. Дождитесь статуса `Published`.
4. Откройте CRM в новой вкладке или очистите cookies старой сессии.
5. Выйдите из аккаунта и войдите заново.

## 11. Минимальный сценарий при ошибке

Если сотрудник снова видит полный кабинет:

1. Не меняйте код сразу.
2. Проверьте `auth.users.id` сотрудника.
3. Найдите этот ID в `employees.user_id`.
4. Проверьте точное значение `employees.role`.
5. Проверьте, что `employees.is_active = true`.
6. Проверьте, что пользователь не является `businesses.owner_id`.
7. Выйдите из CRM и войдите заново.
8. Только после этого проверяйте Netlify deploy.

Если роль записана произвольным текстом, замените её на один из slug из раздела 6.
