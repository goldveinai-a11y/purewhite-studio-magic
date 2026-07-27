Проверил код: в `StudioWorkspace` счётчик уже обёрнут в `tier === "free"`, но в блоке настроек на главной странице всё ещё всегда показывается строка `Free tier: {credits}/3 credits`.

План правки:
1. В `src/routes/index.tsx` подключить `useTierLimits()` в компоненте `Hero`.
2. Показывать строку `Free tier: {credits}/3 credits · Batches over 3 photos require Pro` только если `tier === "free"`.
3. Ничего не менять в checkout, pricing, Stripe/payment methods, paywall UI и бизнес-логике.
4. Проверить поиском, что других видимых счётчиков кредитов для Pro/Lifetime в студии не осталось.