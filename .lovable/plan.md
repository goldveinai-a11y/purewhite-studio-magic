## План — вернуть то состояние, где всё работало

Судья QC уже удалён (нет `qcJudge`, нет вызовов Anthropic — проверил в предыдущих правках). Единственное, что отличается от того «хорошего» момента, когда ты сказал «ушли брызги» — я только что включил `aggressiveDebris: true` и агрессивный порог в debris-фильтре. Это, судя по твоему сравнению, только ухудшило кадр.

### Что делаю

1. `src/components/studio-workspace.tsx` — вернуть `aggressiveDebris: false` в вызове `postProcess`.
2. `src/lib/canvas-processing.ts` — убрать флаг `opts.aggressiveDebris` из вызова `removeDisconnectedDebris`, вернуть жёстко `false` (как было в тот вечер).
3. Больше ничего не трогаю: `runJob` = rembg (primary) → birefnet (fallback), никакого судьи, никаких HD-кнопок.

Это буквально возврат к состоянию из сообщения «Переключил на Photoroom-модель».
