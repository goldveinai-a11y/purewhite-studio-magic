
## Что делаем

Только `Navbar` в `src/routes/index.tsx` + расширение таблицы `entitlements` + запись новых полей в webhook. Больше ничего.

## 1. БД (миграция)

Добавить в `public.entitlements`:
- `subscription_status text` (active / trialing / past_due / unpaid / canceled / null)
- `current_period_end timestamptz`
- `cancel_at_period_end boolean not null default false`

Никаких новых таблиц, RLS/GRANT остаются как есть.

## 2. Webhook — минимальная правка

`src/routes/api/public/payments/webhook.ts`, только `handleSubscriptionUpsert` и `handleSubscriptionDeleted`:
- upsert записывает `subscription_status = subscription.status`, `cancel_at_period_end`, `current_period_end` (из `items.data[0].current_period_end` с fallback на `subscription.current_period_end`).
- deleted пишет `subscription_status = 'canceled'`, обнуляет `current_period_end`.

Логика тира (`active|trialing → pro`, иначе `free`) не трогается — `past_due` остаётся `tier=pro` (доступ сохраняется), это как раз состояние D.

## 3. Сервер: расширяем `getEntitlements`

В `src/lib/payments.functions.ts` в `getEntitlements` добавить в SELECT новые три поля + `stripe_customer_id`. Тип `Entitlements` расширяется. Ничего больше не меняем — `createPortalSession` уже существует и подходит для всех состояний B/C/D/E.

## 4. Хедер — новый компонент `AccountMenu`

В `src/routes/index.tsx` заменяем текущий блок с `email` (строки ~303–316) на `<AccountMenu email={email} />`. `Sign in` для анонимов и `Launch Studio` не трогаем.

### Триггер (аватар)
- `button` фиксированного размера `h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-semibold`, показывает первые 2 буквы email в верхнем регистре.
- Никакого email в строке хедера ни на каком брейкпоинте. Ширина хедера больше не зависит от длины email → mobile-регрессия исключена by construction.

### Панель (`DropdownMenuContent`)
- `align="end"`, `sideOffset={8}`, `className="w-[280px] max-w-[calc(100vw-32px)] p-3"` — правый inset 16px обеспечивает `max-w-[calc(100vw-32px)]` + `align="end"` радикс-логикой (uses collision padding по умолчанию).
- Порядок: email (truncate) → Badge → detail-строка `text-sm text-muted-foreground` → `<DropdownMenuSeparator/>` → primary action (полноширинный `Button`) → `Contact support` (mailto — вытащу адрес из футера: `hi@purewhitebg.com`, проверю в `src/routes/index.tsx` футере) → `Log out`.
- Esc / outside click — уже в Radix `DropdownMenu`.

### 6 состояний (в компоненте `AccountMenu`)

Хук `useAccountPlan()` внутри файла: `useQuery`-like через `useEffect` + локальный state (следуем существующему стилю файла — там уже так делают в `useTierLimits`). Возвращает `{ status: 'loading' | 'error' | 'ready', data? }`.

- **F Loading** — email виден, badge/detail/кнопка — скелетоны (`bg-muted animate-pulse` блоки). Никогда не показываем «Free» до ответа сервера.
- **error** — «Couldn't load plan details» + `Manage subscription` (портал). Никогда не гадаем.
- **A Free** (`tier==='free'`) — Badge `Free` (variant `outline`), detail «X of 3 free credits left» (X из `usePersistedCredits`), кнопка `Upgrade to Pro` → `location.hash = '#pricing'`.
- **B Pro active** (`tier==='pro'`, status `active|trialing`, `cancel_at_period_end===false`) — Badge `Pro` (кастомный класс с указанными цветами), detail `Unlimited photos · renews {formatDate(current_period_end)}`, кнопка `Manage subscription` (outline + `CreditCard` icon) → портал.
- **C Pro ending** (`tier==='pro'`, `cancel_at_period_end===true`) — Badge `Pro · ending` (amber), detail `Access until {date} · won't renew`, кнопка `Manage subscription` (outline) → портал. Слова `renews`/`Free` не появляются.
- **D Past due** (`subscription_status==='past_due' || 'unpaid'`) — Badge `Past due` (красный), detail `Payment failed — update your card` в `text-destructive`, кнопка `Update payment method` (filled destructive) → портал.
- **E Lifetime** (`tier==='lifetime'`) — Badge `Lifetime` (teal), detail `Unlimited · no renewal, ever`, кнопка `Billing and invoices` (outline + `FileText` icon) → портал. Слово `subscription` не используется.

Приоритет состояний при выборе: D > C > B > E > A > loading/error.

Портал: клик → `createPortalSession({ data:{ returnUrl: window.location.origin, environment: getStripeEnvironment() }})` → `window.location.href = url`. Если `stripe_customer_id` нет — primary кнопку не рендерим (только в B/C/D/E; для A это `Upgrade to Pro` и всегда доступно).

Цвета бейджей — inline-классы Tailwind с произвольными значениями (`bg-[#EEEDFE] text-[#3C3489]` и т.д.), так как это разовое использование и в дизайн-системе токенов под них нет.

## 5. Проверка адаптива (обязательный шаг перед завершением)

Playwright на `http://localhost:8080/` в двух вариантах (аноним и залогинен через injected сессию), на 360 / 390 / 414 / 768 / 1280:
- `document.documentElement.scrollWidth === window.innerWidth`
- скриншот хедера
Если хоть где-то не совпало — сжимаем `gap`/`px` пока не сойдётся; в остальном верстка не тронута, так что регрессии как в прошлый раз не будет (аватар — фиксированные 32px, email из строки убран).

## Технические детали

- Никаких новых зависимостей. Используем существующие `DropdownMenu`, `Button`, `Badge`, иконки `lucide-react` (`CreditCard`, `FileText`, `LifeBuoy`, `LogOut`).
- `getEntitlements` уже дергается в `useTierLimits` — `AccountMenu` делает свой независимый вызов (проще, не связывает компоненты); один лишний запрос в сессию.
- Форматирование даты: `new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' })`.
- Файлы, которые редактируем: `src/routes/index.tsx`, `src/lib/payments.functions.ts`, `src/routes/api/public/payments/webhook.ts`, одна миграция БД. Больше — ничего.
