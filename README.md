# notre-cinema

Совместный трекер фильмов и сериалов. Этот репозиторий — только фронтенд
(Next.js): у него нет ни доступа к базе, ни ключей почты, push и внешних API.
Всё это — в Go-сервисах:

- [`../notrecinema-api`](../notrecinema-api) — HTTP API: сессии, семьи,
  сериалы, 2FA, приглашения, настройки уведомлений, метрики;
- [`../notrecinema-worker`](../notrecinema-worker) — письма и web push;
- [`../notrecinema-schema`](../notrecinema-schema) — схема БД (единственный
  источник истины, миграции);
- [`../notrecinema-infra`](../notrecinema-infra) — развёртывание на сервере.

## Как фронтенд общается с API

Браузер ходит на `/api/v1/*` **своего же домена**, а Next.js проксирует эти
запросы на Go API (`rewrites()` в `next.config.ts`). Поэтому cookie сессии
остаётся first-party, CORS не нужен, а логин, регистрация, 2FA, смена
пароля, сессии, настройки уведомлений, отписка, приглашения, импорт, загрузка
картинок и экспорт данных вызываются из браузера напрямую.

Серверные компоненты и server actions обращаются к API изнутри
(`src/shared/api/go/server.ts`): пробрасывают cookie запроса и исходные
`Host`/`X-Forwarded-*`. Ответы API (camelCase) переводятся в типы
интерфейса мапперами `src/shared/api/go/dto.ts`.

Что осталось на стороне Next.js: страницы, тонкие BFF-роуты
`/api/family/*` и `/api/series/*` (собирают данные для диалогов через
`src/shared/api/go/queries.ts`), `/api/family/switch` (cookie активной
семьи) и `/api/legal/*`.

## Настройка

Скопируйте `.env.example` в `.env`. Обязательна одна переменная — `API_URL`,
адрес Go API **с точки зрения сервера фронтенда**. Она вшивается в сборку
(`rewrites()` вычисляются при `next build`), поэтому в Dockerfile это
build-аргумент: при смене адреса образ нужно пересобрать.

Остальные настройки (база, почта, VAPID, ключи OMDb/Кинопоиск/Trakt/TMDB,
хранилище, GitHub OAuth) — в `.env` API и воркера. Из них фронтенду нужны
только `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (публичная половина той же пары, что у
воркера) и `STORAGE_PUBLIC_URL` (чтобы `next/image` грузил постеры).

GitHub OAuth: callback теперь обрабатывает Go API, поэтому в настройках
OAuth-приложения GitHub нужен адрес
`https://<домен фронтенда>/api/v1/auth/github/callback` (раньше
`/auth/callback`).

## Запуск локально

Поднимите Postgres, NATS, API и воркер (см. README и `.env.example` API),
затем:

```bash
pnpm install
pnpm start          # next dev, API_URL берётся из .env
```

На путях с кириллицей Turbopack падает — используйте
`pnpm exec next dev --webpack`.

## Тесты

Юнит/компонентные тесты (Vitest + Testing Library, без БД и без API):

```bash
pnpm test        # разовый запуск
pnpm test:watch  # watch-режим
```

End-to-end (Playwright) прогоняют **весь стек**: фронтенд, настоящие Go API
и воркер, Postgres, NATS. Подменяется только почтовый провайдер: воркер
отправляет письма на `e2e/support/fake-resend.mjs`, а тесты читают их оттуда
и переходят по ссылкам (подтверждение email, сброс пароля, приглашение,
отписка). Покрыто: регистрация и подтверждение email, сброс и смена пароля,
2FA и резервные коды, список сессий и их отзыв, настройки уведомлений,
отписка, приглашение в семью по email, вход в семью по коду, добавление
сериалов.

Нужны заранее поднятые Postgres и NATS и переменные окружения:

```bash
docker run -d --name nc-e2e-db -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=notrecinema_e2e \
  -e APP_DB_PASSWORD=app_pw --tmpfs /var/lib/postgresql/data \
  -v "$PWD/../notrecinema-schema/init.sh:/docker-entrypoint-initdb.d/01-init.sh:ro" \
  postgres:16-alpine
docker run -d --name nc-e2e-nats -p 4222:4222 nats:2.10-alpine

export MIGRATE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notrecinema_e2e
export DATABASE_URL=postgresql://app_user:app_pw@localhost:5432/notrecinema_e2e
export NATS_URL=nats://localhost:4222

pnpm exec playwright install chromium   # один раз
pnpm test:e2e
```

Playwright сам запускает fake Resend, `go run ./cmd/api`,
`go run ./cmd/worker` и `next dev` (порты: `E2E_PORT` 3399, `E2E_API_PORT`
18080, воркер 8081, почта `FAKE_RESEND_PORT` 18025), а `e2e/global-setup.ts`
сбрасывает таблицу лимитов запросов (миграции накатываются командой запуска API). Репозитории
`notrecinema-api`, `notrecinema-worker` и `notrecinema-schema` должны лежать
рядом с этим. В CI это делает job `e2e` (`.github/workflows/ci.yml`); ему
нужен секрет `E2E_CHECKOUT_TOKEN` — токен с правом чтения остальных
репозиториев.

## База данных

Схема — отдельный пакет [`../notrecinema-schema`](../notrecinema-schema),
фронтенд к ней не обращается. Новая миграция — новый файл
`notrecinema-schema/migrations/NNNN_slug.sql` (идемпотентный: `IF NOT
EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY` и т.д.). Применить:

```bash
pnpm migrate     # npm --prefix ../notrecinema-schema run migrate
```
