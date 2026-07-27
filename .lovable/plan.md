## Что настраиваем

3 продукта в Stripe + серверный учёт лимитов вместо localStorage.

| Продукт | Тип | Цена | Что даёт |
|---|---|---|---|
| **Pro** | Subscription monthly | $6.99/мес | tier=`pro`, скрытый лимит 200 фото/мес |
| **Lifetime** | One-time | $29.99 | tier=`lifetime`, скрытый лимит 500 фото всего |
| **Extra Pack** | One-time | $9.99 | +500 фото к балансу (только для pro/lifetime при исчерпании) |

Free — без Stripe, 3 локальных кредита как сейчас.

## UI-правила (по ответам)

- Pricing-страницу **не трогаем вообще** — там уже есть Free / Pro $6.99 / Lifetime $29.99.
- Extra Pack **не показываем** в pricing — только модалка «You've used all photos this month. Buy 500 more for $9.99» при исчерпании лимита.
- Счётчик кредитов в шапке студии **остаётся только для Free** (как сейчас). Для Pro и Lifetime — счётчика нет.
- Нет меню «My plan» — не добавляем.

## Порядок работ

### 1. Включить Stripe
- `recommend_payment_provider` → подтвердить Stripe (цифровой продукт).
- `enable_stripe_payments` (встроенный, не BYOK).
- Tax handling: full compliance (`managed_payments`, +3.5%) — цифровой SaaS, Stripe берёт налоги/споры/поддержку.

### 2. Включить Lovable Cloud + auth
localStorage-хранение tier'а — дыра: юзер обнулит devtools и получит бесконечно. Для платного нужен серверный источник правды.
- Enable Cloud.
- Auth: **email/password + Google** (дефолт).
- Простой `/auth` роут для sign-in/sign-up. `_authenticated/` слой для защищённых серверных вызовов.

### 3. Схема БД (миграция)
```
entitlements(
  user_id uuid PK → auth.users,
  tier text CHECK IN ('free','pro','lifetime') default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  pro_period text,            -- 'YYYY-MM' — сброс pro_used помесячно
  pro_used int default 0,
  lifetime_used int default 0,
  extra_pack_balance int default 0,
  updated_at timestamptz
)

stripe_events_processed(event_id text PK, processed_at timestamptz)
```
+ RLS: SELECT только своей строке; писать — только service_role. GRANT'ы по стандарту.
+ Триггер `on auth.users insert` → создаёт строку `entitlements` с tier=free.

### 4. Создать продукты в Stripe
`batch_create_product` с 3 SKU (Pro monthly recurring, Lifetime one-time, Extra Pack one-time). Tax code для SaaS/цифрового по каталогу Stripe.

### 5. Server functions (аутентифицированные)
- `getEntitlements()` — читает свою строку.
- `createProCheckout()` / `createLifetimeCheckout()` / `createExtraPackCheckout()` — создают Stripe Checkout Session, возвращают URL. Extra Pack доступен только если tier ∈ {pro, lifetime}.
- `reservePhotos(n)` — атомарно (через SQL функцию с транзакцией) списывает: сначала из `extra_pack_balance`, затем из месячного/lifetime лимита. Возвращает `{ ok, needTopUp, remaining }`.

### 6. Webhook
`src/routes/api/public/stripe-webhook.ts`:
- Проверка HMAC подписи Stripe перед обработкой (HIGH priority).
- Идемпотентность через `stripe_events_processed`.
- События:
  - `checkout.session.completed` — по `metadata.product` (`pro` / `lifetime` / `extra_pack`) и `metadata.user_id` обновляет `entitlements`: ставит tier, сохраняет `stripe_customer_id`/`stripe_subscription_id`, для extra_pack `extra_pack_balance += 500`.
  - `customer.subscription.deleted` / `updated` со статусом canceled/unpaid → tier обратно в `free`.
  - `invoice.paid` (renewal) → на всякий случай `pro_period = current month`, `pro_used = 0` при переходе месяца (основной сброс всё равно делается в `reservePhotos` при смене периода).

Webhook secret хранится через `add_secret` (`STRIPE_WEBHOOK_SECRET`).

### 7. Клиентская логика (без изменений UI-раскладки)
- `usePersistedCredits` → оставить **только для tier=free** (не удалять, локальный счётчик 3 фото).
- `useTierLimits` → заменить его внутренности на вызов `getEntitlements` (React Query, `useSuspenseQuery`). Никакого localStorage для pro/lifetime.
- В `studio-workspace.tsx` перед стартом батча — вызвать `reservePhotos(n)`:
  - Free: как сейчас, локальный счётчик.
  - Pro/Lifetime: серверный вызов; если `needTopUp === true` → показать модалку «Buy 500 more photos — $9.99» с одной кнопкой, которая ведёт на `createExtraPackCheckout` → редирект в Stripe.
- Счётчик в шапке студии: рендерим `«X / 3»` только если tier=free. Для pro/lifetime — ничего.

### 8. Success/cancel возврат
- Success URL: `/?checkout=success` — показать toast «Payment received». Webhook уже обновил entitlements до того, как юзер вернулся; на всякий случай `router.invalidate()` + refetch `getEntitlements`.
- Cancel URL: `/?checkout=cancelled` — тихий toast.

## Технические детали

- **Идемпотентность reservePhotos**: одна SQL функция `reserve_photos(n int)` в транзакции: читает строку `FOR UPDATE`, применяет приоритет extra_pack → месячный/lifetime, инкрементит счётчики, возвращает результат. Никаких race conditions при параллельных запросах.
- **Смена месяца для Pro**: внутри `reserve_photos` если `pro_period != current_YYYY_MM` → обнулить `pro_used` и обновить период. Не полагаемся на cron.
- **Extra Pack тратится ПЕРВЫМ**, чтобы юзер не оказался в ситуации «купил пак, а он не тратится, потому что месячный лимит ещё не выбран».
- **Ноды скрытых лимитов** (200 / 500) — единственный источник правды: константы в SQL-функции `reserve_photos`. В клиенте эти числа не появляются вообще.
- **Стек**: server functions под `_authenticated/` для checkout'ов, публичный TSS route для webhook. `supabaseAdmin` в webhook — импорт **внутри** handler'а.
- **Секреты**: `STRIPE_WEBHOOK_SECRET` через `add_secret`. Stripe API key — управляется встроенной интеграцией, руками не трогаем.

## Что удаляем/чистим

- `useTierLimits` внутренности (localStorage keys `pwbg_tier`, `pwbg_pro_period`, `pwbg_pro_used`, `pwbg_lifetime_used`) — на первом заходе после релиза удалить эти ключи из localStorage (одноразовая миграция в хуке).
- Ручное проставление tier через клик на кнопку в pricing (если такое было) — теперь tier ставится **только** через webhook после оплаты.

## Что НЕ входит

- Годовой Pro, промо-коды, скидки.
- Возвраты через UI (пока — из Stripe Dashboard).
- Email-уведомления «осталось N фото».
- Автопополнение (auto top-up).
- Изменение UI pricing-страницы, шапки для pro/lifetime, добавление «My plan».
