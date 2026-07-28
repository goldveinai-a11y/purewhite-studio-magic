## Цель

Полный responsive-pass главной страницы. На всех mobile и tablet ширинах ничего не обрезается, не выезжает за экран, не накладывается, не ломает кнопки. Десктоп визуально идентичен.

## Что делаю

Правки только в двух файлах: `src/routes/index.tsx` и `src/components/studio-workspace.tsx`. Backend, auth, Stripe, обработка фото — не трогаю.

### 1. Navbar (`Navbar`, index.tsx)

- `px-6` → `px-4 sm:px-6`, `gap-3` → `gap-2 sm:gap-3`.
- Логотип: текст "PureWhite BG" не переносится (`whitespace-nowrap`), размер `text-base sm:text-lg`.
- Email dropdown: `max-w-[120px]` → `max-w-[90px] sm:max-w-[160px]`.
- Sign in: `text-xs sm:text-sm`, `whitespace-nowrap` уже есть.
- Кнопка "Launch Studio": `size="sm"` на мобильном, текст "Studio" на <sm, "Launch Studio" на sm+, стрелка `hidden sm:inline`, `whitespace-nowrap`, `shrink-0`.
- Бейдж "3 Free Credits" уже скрыт на мобильном — оставляю.

### 2. Hero + встроенный workspace (`Hero`, index.tsx)

- Padding: `px-6` → `px-4 sm:px-6`.
- Card: `p-6 md:p-8` → `p-4 sm:p-6 md:p-8`.
- Grid `md:grid-cols-[1.4fr_1fr]` уже валится в один столбец на мобиле — ок.
- H1 `text-4xl md:text-6xl` → `text-3xl sm:text-4xl md:text-6xl`, добавить `break-words`.
- Badge "100% Amazon Compliant …": разрешить перенос — заменить на `flex-wrap`, убрать одну длинную строку, разбить на две компактные строки через `<span className="hidden sm:inline"> • </span>` + перенос, либо сократить на мобильном. Проще: обернуть в контейнер `whitespace-normal text-center leading-snug` и уменьшить шрифт `text-[11px] sm:text-xs`.
- Кнопка "Upload your first photo": уже `w-full` — ок, но обернуть текст `whitespace-normal`.

### 3. TrustBar (`TrustBar`)

- `px-6` → `px-4 sm:px-6`.
- Логотипы: `gap-x-12` слишком широко на мобиле → `gap-x-6 sm:gap-x-12`.

### 4. ValueProps / HowItWorks / UseCases / ComplianceTable / Pricing / FAQ / Footer

- Везде `px-6` → `px-4 sm:px-6`.
- `py-24` → `py-16 sm:py-24` (меньше вертикали на мобиле).
- Заголовки секций `text-3xl md:text-4xl` → `text-2xl sm:text-3xl md:text-4xl`.
- ComplianceTable: `px-6 py-5` → `px-4 sm:px-6 py-4 sm:py-5`; убедиться что 2-колоночный мобильный grid не ломается (при необходимости `min-w-0` + `truncate` на ячейках).
- UseCases `TabsList`: длинные лейблы вроде "Amazon & E-Commerce Sellers" обрезать до короткой версии на мобиле (`<span className="sm:hidden">Sellers</span><span className="hidden sm:inline">Amazon & E-Commerce Sellers</span>`) — иначе на 360px они переносятся некрасиво или вылезают.
- Pricing: карточки уже `md:grid-cols-3` → на мобиле stack, ок; проверить длинные CTA типа "Upgrade to Pro ($6.99/mo)" — добавить `whitespace-normal text-center` в кнопке.
- Footer: языковой dropdown, "Trusted by 250,000+ sellers" — оставить `flex-wrap`, проверить визуально.

### 5. Studio workspace (`studio-workspace.tsx`)

- Drop zone `p-8` → `p-6 sm:p-8`.
- "Add more" bar уже `flex-wrap` — ок.
- Actions grid уже `sm:grid-cols-2` — ок.
- Thumbnails уже `overflow-x-auto` — ок, оставить.
- Убедиться что `ResultPreview` `aspect-square` не вылезает: должен нормально masштабироваться через `w-full`.

### 6. Глобально

- Добавить `overflow-x: hidden` на `body` через `src/styles.css` как safety-net (одна строка в `@layer base`).

## Проверка

Playwright на 360×740, 390×844, 430×932, 768×1024, 820×1180, 1280×1800:

- `document.documentElement.scrollWidth <= window.innerWidth` на всех.
- Скриншоты каждого viewport: navbar, hero, trustbar, use cases, pricing, footer.
- Проверить кликабельность "Launch Studio", "Sign in", "Upload your first photo".

## Что НЕ трогаю

- Логика auth, credits, tier, Stripe, обработка фото.
- Модели, цвета, шрифты бренда.
- Десктопный вид (≥md визуально идентичен).