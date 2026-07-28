В навбаре главной страницы (`src/routes/index.tsx`, компонент `Navbar`) добавить видимое состояние для залогиненного пользователя, чтобы кнопка не "исчезала".

Правки только в `Navbar`:
1. Когда `isAuthed === false` — как сейчас: ссылка **Sign in** → `/auth`.
2. Когда `isAuthed === true` — вместо пустоты показать простое меню:
   - Кнопка-триггер с email пользователя (или первой буквой в круглом аватаре, если email длинный).
   - Dropdown с одним пунктом **Log out** → `supabase.auth.signOut()` + `navigate({ to: "/auth", replace: true })` (используем существующий `DropdownMenu` из shadcn).
3. Заодно скрыть бейдж **"3 Free Credits"** для платных тиров: подключить `useTierLimits()` и обернуть `<Badge>` в `{tier === "free" && ...}`.

Ничего больше не трогаем: layout, spacing, Launch Studio, остальные страницы — без изменений. Мобилка 375px остаётся: email в триггере обрезаем через `max-w-[120px] truncate`, чтобы Launch Studio не сжимался.