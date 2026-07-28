## Цель

Сделать страницу полностью адаптивной для всех недесктопных экранов: mobile и tablet, а не только 360–390px. На телефонах и планшетах ничего не должно обрезаться, выезжать за экран, накладываться друг на друга или ломать кнопки.

## Что исправить

1. **Navbar / header**
   - Перестроить header по правилу: `grid + min-w-0 + shrink-0`, чтобы логотип, auth-блок и `Launch Studio` не давили друг друга.
   - На mobile сделать компактные состояния:
     - логотип без переполнения;
     - email/profile обрезается безопасно или заменяется компактным profile-trigger;
     - `Launch Studio` не переносится и не сжимается;
     - `Sign in` виден только если пользователь не залогинен и тоже не ломает строку.

2. **Hero section**
   - Проверить и исправить крупные заголовки, чтобы они не уходили за край экрана.
   - Уменьшить mobile-типографику через фиксированные breakpoint-классы, без viewport-based font scaling.
   - CTA-кнопки и badges должны переноситься аккуратно, без горизонтального overflow.

3. **Trust / marketplace rule strip**
   - Сейчас длинный текст вроде `100% Amazon Compliant (#FFFFFF) • Auto-resize 1000×1000px` обрезается на mobile.
   - Сделать mobile-вариант: wrap / stacked chips / marquee-free layout, без горизонтального скролла и без clipped text.

4. **Sections below fold**
   - Пройти все основные секции `index.tsx`: how it works, rules, pricing, FAQ, footer, before/after blocks, marketplace cards.
   - Заменить проблемные horizontal layouts на responsive grids/stacks.
   - Добавить `min-w-0`, `shrink-0`, `truncate` только там, где это уместно.
   - Убедиться, что карточки, изображения и таблицеподобные блоки имеют `max-w-full`, стабильные aspect-ratio и не создают overflow.

5. **Studio / embedded workspace first screen**
   - Проверить блок запуска студии на mobile/tablet.
   - Если workspace появляется на главной, убедиться что preview, upload area, queue thumbnails и кнопки не вылезают за экран.
   - Не менять processing logic, модели, кредиты или платежи.

6. **Auth-aware UI**
   - Сохранить текущую логику:
     - logged out: `Sign in`;
     - logged in: profile/email + logout;
     - credits badge только для free, и не ломает mobile.
   - Исправлять только presentation/responsive behavior.

## Технически

- Основной файл: `src/routes/index.tsx`.
- При необходимости проверить `src/components/studio-workspace.tsx`, если именно workspace создаёт overflow.
- Использовать существующие design-system токены и shadcn Button/Badge/Dropdown.
- Не добавлять новые цвета, не менять бренд-стиль, не трогать Stripe/Auth/backend.
- Не делать отдельную мобильную страницу — только нормальная responsive-разметка.

## Проверка

После правок проверить через Playwright:

- mobile: `360×740`, `390×844`, `430×932`;
- tablet: `768×1024`, `820×1180`;
- desktop sanity: `1280×1800`.

Критерии готовности:

- `document.documentElement.scrollWidth <= window.innerWidth` на всех viewport;
- navbar не переносится и не обрезает критичные элементы;
- `Launch Studio` остаётся читаемым и кликабельным;
- hero headline не clipped;
- длинные badges/строки не выезжают за экран;
- нет визуальных наложений в ключевых секциях.