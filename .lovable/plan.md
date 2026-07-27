## Что Stripe сейчас хочет от тебя

Live-статус я проверил: первые 2 шага завершены, но **live checkout ещё не включён**, потому что шаг 3 в Payments помечен как **Action required**:

- Connect sandbox to Stripe account — completed
- Complete go-live form — completed
- **Install Lovable app on LIVE Stripe account — action required**
- Create live API keys — locked / not started
- Readiness check — locked / not started

Поэтому сайт всё ещё показывает **TEST MODE**: приложение получает `pk_test_...` токен, а не live-токен. Это не баг в UI — live-ключи ещё не выданы, пока не установлен Lovable app на live Stripe account.

## Что я исправлю в коде после твоего approve

1. **Сделаю checkout понятнее и безопаснее**
   - Добавлю full-width banner на checkout: test mode / live-not-configured / live mode.
   - Если live не готов, покажу нормальное объяснение вместо ощущения, что checkout «сломался».
   - Не буду менять pricing UI и paywall, как ты просил ранее.

2. **Уберу параметр, который конфликтует с full compliance checkout**
   - В `createCheckout` сейчас одновременно включено `managed_payments: { enabled: true }` и для подписки добавлен `customer_update`.
   - Для managed checkout это конфликтующий параметр, его надо убрать.
   - Это также может влиять на доступные методы оплаты.

3. **Улучшу checkout layout**
   - Центрирую embedded checkout аккуратнее.
   - Добавлю понятный заголовок по плану: Pro / Lifetime / Extra Pack.
   - Сохраню Stripe Embedded Checkout — без redirect и без кастомных card forms.

4. **Apple Pay / Amazon Pay**
   - В коде нельзя вручную «включить Apple Pay кнопку» внутри embedded checkout — Stripe сам показывает методы оплаты по условиям.
   - Apple Pay на Mac появится только если: live/test Stripe account поддерживает метод, домен подтверждён Apple Pay, браузер Safari/поддерживаемый, на устройстве есть активная карта в Wallet, и Stripe checkout считает метод доступным.
   - Amazon Pay тоже не управляется этим React-кодом напрямую: он должен быть включён/доступен в Stripe payment methods и поддерживаться текущим checkout режимом/регионом.
   - Я добавлю кодовую часть, которая не блокирует эти методы: уберу конфликтующие параметры и оставлю Stripe самому показывать wallet/payment methods.

## Что тебе нужно сделать вне кода

1. В Payments нажать **Install Lovable app** на шаге 3.
2. Дождаться, пока шаг 4 сам создаст live API keys.
3. Запустить Readiness check.
4. После этого опубликовать/обновить live build, чтобы production получил `pk_live_...`.

<presentation-actions><presentation-open-payments>Go to payments</presentation-open-payments></presentation-actions>

## Проверка после фикса

- В preview checkout будет честно показывать test mode.
- На published domain после завершения go-live и публикации должен исчезнуть test mode.
- Если Apple Pay/Amazon Pay всё ещё не видны после live go-live, это уже настройка Stripe payment methods/domain eligibility, а не проблема checkout-кода.