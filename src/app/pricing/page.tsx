"use client";

import Link from "next/link";

export default function PricingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #fdf8f0 0%, #f5f9f7 100%)" }}
    >
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-stone-100 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <span className="text-white font-bold text-sm tracking-tight">EF</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-800 leading-tight">Everyday Fluency</h1>
              <p className="text-xs text-amber-600/80 leading-tight">English coaching session</p>
            </div>
          </Link>
          <Link
            href="/"
            className="text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            ← На главную
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold text-stone-800 mb-3">Тарифы</h1>
        <p className="text-stone-600 mb-10">
          Уровень A1 (30 уроков) — бесплатно. Чтобы получить доступ к A2, B1, B2, C1 и C2,
          оформите подписку. Всего 180 уроков, разговорный английский с виртуальным
          преподавателем Sophie.
        </p>

        {/* Plans */}
        <div className="grid gap-4 mb-12">
          {/* Monthly */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-xl font-bold text-stone-800">Месяц</h2>
              <div className="text-right">
                <span className="text-3xl font-bold text-stone-800">890 ₽</span>
                <span className="text-sm text-stone-500"> / месяц</span>
              </div>
            </div>
            <p className="text-stone-600 text-sm">
              Полный доступ ко всем уровням A2–C2. Списывается раз в месяц, можно
              отменить в любой момент.
            </p>
          </div>

          {/* Annual */}
          <div className="bg-white rounded-2xl border-2 border-amber-300 p-6 shadow-md relative">
            <div className="absolute -top-3 right-6 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              Выгодно
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-xl font-bold text-stone-800">Год</h2>
              <div className="text-right">
                <span className="text-3xl font-bold text-stone-800">7 990 ₽</span>
                <span className="text-sm text-stone-500"> / год</span>
              </div>
            </div>
            <p className="text-stone-600 text-sm mb-2">
              Полный доступ ко всем уровням A2–C2 на 12 месяцев. Экономия 25 % по
              сравнению с помесячной оплатой.
            </p>
            <p className="text-amber-700 text-sm font-medium">
              Стартовое предложение для первых 50 подписчиков — 4 990 ₽ за год.
            </p>
          </div>

          {/* Lifetime */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-xl font-bold text-stone-800">Навсегда</h2>
              <div className="text-right">
                <span className="text-3xl font-bold text-stone-800">19 990 ₽</span>
                <span className="text-sm text-stone-500"> / разово</span>
              </div>
            </div>
            <p className="text-stone-600 text-sm">
              Доступ к Everyday Fluency и Français au Quotidien навсегда. Один платёж,
              никаких списаний в будущем.
            </p>
          </div>
        </div>

        {/* What's included */}
        <h2 className="text-2xl font-bold text-stone-800 mb-4">Что входит в подписку</h2>
        <ul className="space-y-3 mb-12">
          <li className="flex gap-3 text-stone-700">
            <span className="text-amber-500 font-bold mt-0.5">✓</span>
            <span>180 уроков по уровням A1–C2 (по 30 на каждом уровне)</span>
          </li>
          <li className="flex gap-3 text-stone-700">
            <span className="text-amber-500 font-bold mt-0.5">✓</span>
            <span>Голосовое общение с Sophie — преподавателем на базе ИИ</span>
          </li>
          <li className="flex gap-3 text-stone-700">
            <span className="text-amber-500 font-bold mt-0.5">✓</span>
            <span>Озвучка диалогов носителем (TTS), распознавание речи</span>
          </li>
          <li className="flex gap-3 text-stone-700">
            <span className="text-amber-500 font-bold mt-0.5">✓</span>
            <span>Прогресс по урокам и трекер выученных выражений</span>
          </li>
          <li className="flex gap-3 text-stone-700">
            <span className="text-amber-500 font-bold mt-0.5">✓</span>
            <span>Все будущие обновления и новые уроки</span>
          </li>
        </ul>

        {/* Payment */}
        <h2 className="text-2xl font-bold text-stone-800 mb-4">Оплата</h2>
        <p className="text-stone-700 mb-3">
          Оплата принимается через сервис ЮKassa: банковской картой (МИР, Visa, Mastercard),
          через СБП, ЮMoney, SberPay и другие способы.
        </p>
        <p className="text-stone-700 mb-12">
          После оплаты доступ к выбранному уровню активируется автоматически и сохраняется
          на всё время действия подписки. На электронную почту приходит чек.
        </p>

        {/* Refund */}
        <h2 className="text-2xl font-bold text-stone-800 mb-4">Возврат</h2>
        <p className="text-stone-700 mb-12">
          Возврат возможен в течение 14 дней с момента оплаты, если вы не использовали
          сервис активно (прошли менее 5 уроков). Для возврата напишите на{" "}
          <a
            href="mailto:shuligne@gmail.com"
            className="text-amber-700 hover:text-amber-900 font-medium"
          >
            shuligne@gmail.com
          </a>{" "}
          с темой «Возврат» и укажите email, на который оформлена подписка.
        </p>

        {/* Footer links */}
        <div className="border-t border-stone-200 pt-6 text-sm text-stone-500 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/about" className="hover:text-amber-700">
            Реквизиты
          </Link>
          <Link href="/terms" className="hover:text-amber-700">
            Условия использования
          </Link>
          <Link href="/privacy" className="hover:text-amber-700">
            Политика конфиденциальности
          </Link>
          <Link href="/" className="hover:text-amber-700">
            На главную
          </Link>
        </div>
      </main>
    </div>
  );
}
