# CI/CD (GitLab)

Пайплайн описан в [.gitlab-ci.yml](../.gitlab-ci.yml). Коротко:

- **На каждый коммит в любой ветке**: `lint`, `typecheck`, юнит-тесты,
  интеграционные тесты (против настоящего эфемерного Postgres), SAST,
  Secret Detection, Dependency Scanning (встроенные GitLab-шаблоны) и
  сканирование зависимостей/секретов в файловой системе (Trivy).
- **Только на `main`**: сборка и пуш Docker-образов (`app` и `migrate`) в
  GitLab Container Registry через kaniko, сканирование собранного образа
  (Trivy), полный e2e-набор (Playwright), DAST-скан (OWASP ZAP baseline)
  по одноразовому инстансу собранных образов, и **ручной** деплой по SSH.

Деплой сделан ручным (`when: manual`) намеренно — сейчас нет staging-окружения
перед проду, поэтому кнопка человека — единственный предохранитель. Когда
привыкнете к пайплайну, можно поменять на `when: on_success` в
`deploy-production`, чтобы каждый мердж в `main` выкатывался сам.

## Что нужно настроить в GitLab один раз

### 1. Ничего для реестра образов

`CI_REGISTRY`, `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD`, `CI_REGISTRY_IMAGE` —
предопределённые переменные GitLab, подставляются автоматически для каждого
проекта с включённым Container Registry (Settings → Packages and registries →
Container Registry, включён по умолчанию). Ничего добавлять не нужно.

### 2. CI/CD-переменные для деплоя

Settings → CI/CD → Variables → Add variable:

| Переменная        | Значение                                                                 | Флаги                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `SSH_PRIVATE_KEY` | приватный ключ (ed25519) для входа на сервер деплоя                      | Protected, Masked не сработает (многострочный) — оставить только Protected, включить File type или обычный variable с `\|` |
| `SSH_KNOWN_HOSTS` | вывод `ssh-keyscan -H <ваш-сервер>`, снятый один раз локально            | Protected                                                                                                                  |
| `SSH_USER`        | пользователь на сервере (например, `deploy`)                             | Protected                                                                                                                  |
| `SSH_HOST`        | IP/домен сервера                                                         | Protected                                                                                                                  |
| `DEPLOY_PATH`     | путь к клону репозитория на сервере (например, `/opt/co-visionnage-app`) | Protected                                                                                                                  |
| `PRODUCTION_HOST` | домен, на котором крутится прод (только для ссылки в Environments)       | —                                                                                                                          |

Все — со флагом **Protected** (доступны только защищённым веткам/тегам) и
областью **Protect variable: main branch** — убедитесь, что `main` отмечена
как Protected branch (Settings → Repository → Protected branches), иначе
джоба деплоя их не увидит.

Приватный ключ генерируется отдельно под деплой (не переиспользуйте личный):

```bash
ssh-keygen -t ed25519 -C "gitlab-ci-deploy" -f deploy_key -N ""
# deploy_key.pub -> добавить в ~/.ssh/authorized_keys пользователя SSH_USER на сервере
# deploy_key     -> содержимое целиком в переменную SSH_PRIVATE_KEY
ssh-keyscan -H <SSH_HOST>
# вывод -> в переменную SSH_KNOWN_HOSTS
```

### 3. Подготовка сервера (один раз)

```bash
git clone git@gitlab.com:<namespace>/co-visionnage-app.git /opt/co-visionnage-app
cd /opt/co-visionnage-app
cp .env.example .env
# заполнить .env как обычно (см. корневой README) и добавить туда же:
echo "CI_REGISTRY_IMAGE=registry.gitlab.com/<namespace>/co-visionnage-app" >> .env
```

`docker-compose.yml` сам подставит `${CI_REGISTRY_IMAGE}` и `${IMAGE_TAG:-latest}`
в поле `image:` — `IMAGE_TAG` деплой прокидывает через SSH-команду на лету,
в `.env` его хранить не нужно.

Авторизация в registry — **один раз** на сервере, через Deploy Token
(Settings → Repository → Deploy tokens в GitLab; scope `read_registry`), а не
через `CI_REGISTRY_PASSWORD` — так реестровые креды никогда не проходят через
SSH-команду в логах джобы:

```bash
docker login registry.gitlab.com -u <deploy-token-username> -p <deploy-token>
```

После этого `deploy-production` в пайплайне делает только:
`git fetch && git checkout <sha> && docker compose pull && docker compose up -d`.

### 4. Environment в GitLab (опционально, но приятно)

`deploy-production` объявляет `environment: { name: production, url: ... }` —
GitLab сам заведёт запись в Deployments → Environments при первом запуске
джобы, доп. настройка не нужна.

## Бюджет CI-минут (GitLab.com Free)

Free-тариф даёт ограниченное количество минут shared runners в месяц. Тяжёлые
джобы (e2e, сборка образов, DAST) гоняются только на `main`, лёгкие — на
каждый коммит везде, так и задумано пользователем. Если минуты
закончатся — вариант расширить лимит или подключить свой runner (self-hosted,
без лимита) на VPS, где и так планируется крутить прод.

## Честно про DAST-джобу

`dast-zap-baseline` — самая непроверенная часть этого пайплайна: поднимает
`docker-compose.yml` + `docker-compose.ci.yml` внутри docker-in-docker и
запускает ZAP baseline-скан по сети compose. Локально (без GitLab-раннера)
я такое не воспроизвожу 1-в-1, так что в первом реальном прогоне вероятны
мелкие правки (имя сети, тайминг healthcheck). Остальные джобы либо
проверены напрямую (миграции, роль `app_user`, сам `docker-compose.yml`),
либо это самодостаточные официальные образы (kaniko, Trivy, GitLab security
templates).

## Зависимости (Dependabot / Trivy)

`trivy-filesystem-scan` и `container-scan-app` сейчас стоят с
`allow_failure: true` и `--exit-code 0` — репортят, но не блокируют
пайплайн, потому что в проекте уже есть ~100 известных уязвимостей в
зависимостях (то самое предупреждение от GitHub при пуше). Как только
разберётесь с бэклогом — стоит убрать `allow_failure` и/или добавить
`--exit-code 1` хотя бы для CRITICAL, чтобы новые критичные уязвимости
реально блокировали мердж.
