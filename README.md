# notre-cinema

Совместный трекер фильмов

## Настройка

Скопируйте `.env.example` в `.env` и заполните переменные — файл разбит на
секции: что обязательно для запуска, что нужно только для загрузки постеров,
и какие интеграции опциональны (соответствующая функция скрывается или
деградирует, а не падает всё приложение, если ключ не задан).

## База данных

Схема живёт в `database/migrations/*.sql` — по одному файлу на изменение,
применяются по имени в алфавитном порядке. Какие файлы уже применены,
отслеживается в таблице `public.schema_migrations` внутри самой БД.

`database/grants.sql` — не миграция: права `app_user` переприменяются при
каждом запуске раннера, а не отслеживаются как разовый шаг.

Запуск миграций:

```bash
pnpm migrate
```

Раннеру нужен доступ с правами суперпользователя Postgres (создаёт таблицы,
политики RLS, выдаёт права) — не тот `DATABASE_URL`, под которым работает
само приложение (`app_user`, ограничен RLS). Задайте `MIGRATE_DATABASE_URL`
явно, либо оставьте `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` (те же,
что использует `database/init.sh` при создании `app_user`) — раннер соберёт
строку подключения сам.

В `docker-compose.yml` это уже увязано: сервис `migrate` ждёт готовности
`postgres`, накатывает миграции, а `app` не стартует, пока `migrate` не
завершится успешно — так что `docker compose up` на уже существующей базе
безопасно подтягивает новые миграции при каждом деплое.

Новая миграция — это просто новый файл `database/migrations/NNNN_slug.sql`
со следующим порядковым номером; писать миграции стоит идемпотентно
(`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY`,
`ADD COLUMN IF NOT EXISTS` и т.д.), как и все существующие.

## Тесты

Юнит/компонентные тесты (Vitest + Testing Library, без БД):

```bash
pnpm test        # разовый запуск
pnpm test:watch  # watch-режим
```

End-to-end (Playwright) требуют настоящий Postgres — сами его не поднимают.
Проще всего временный контейнер:

```bash
docker run -d --name notre-cinema-e2e-db -p 5490:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=notre_cinema \
  --tmpfs /var/lib/postgresql/data postgres:16-alpine
docker exec notre-cinema-e2e-db psql -U postgres -c \
  "CREATE ROLE app_user WITH LOGIN PASSWORD 'app_pw';"
```

Затем `.env` с `DATABASE_URL`/`MIGRATE_DATABASE_URL`, указывающими на этот
контейнер (см. `.env.example`), и:

```bash
pnpm test:e2e
```

Playwright сам поднимает `next dev` на отдельном порту (`E2E_PORT`, по
умолчанию 3399) и накатывает миграции перед прогоном (`e2e/global-setup.ts`).
