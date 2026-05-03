"use client";

import Link from "next/link";

export default function AboutPage() {
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
        <h1 className="text-3xl font-bold text-stone-800 mb-3">О сервисе</h1>
        <p className="text-stone-600 mb-10">
          Everyday Fluency — образовательная платформа для изучения разговорного английского
          с виртуальным преподавателем на базе искусственного интеллекта.
        </p>

        {/* Реквизиты */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-stone-800 mb-5">Реквизиты</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-stone-500 mb-1">Исполнитель</dt>
              <dd className="text-stone-800 font-medium">
                Мешалкин Александр Викторович
              </dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500 mb-1">Статус</dt>
              <dd className="text-stone-800">
                Самозанятый (плательщик налога на профессиональный доход)
              </dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500 mb-1">ИНН</dt>
              <dd className="text-stone-800 font-mono">540447003201</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500 mb-1">Регион</dt>
              <dd className="text-stone-800">г. Новосибирск, Российская Федерация</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500 mb-1">Email для связи</dt>
              <dd>
                <a
                  href="mailto:shuligne@gmail.com"
                  className="text-amber-700 hover:text-amber-900 font-medium"
                >
                  shuligne@gmail.com
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500 mb-1">Сайт</dt>
              <dd className="text-stone-800">
                https://everyday-fluency2.vercel.app
              </dd>
            </div>
          </dl>
        </div>

        {/* О сервисе */}
        <h2 className="text-2xl font-bold text-stone-800 mb-4">Чем занимается Everyday Fluency</h2>
        <p className="text-stone-700 mb-3">
          Сервис предоставляет интерактивные уроки разговорного английского для русскоязычных
          пользователей. Каждый урок построен вокруг живого диалога между персонажами и
          включает разбор выражений, грамматический фокус и практику речи с озвучкой.
        </p>
        <p className="text-stone-700 mb-3">
          Курс охватывает уровни от A1 до C2 по шкале CEFR — всего 180 уроков. Уровень A1
          доступен бесплатно. Доступ к остальным уровням предоставляется по подписке.
        </p>
        <p className="text-stone-700 mb-10">
          Преподаватель Sophie — это виртуальный персонаж на базе технологии Anthropic Claude.
          Sophie не является живым человеком и не предоставляет услуги репетитора в
          традиционном смысле. Вы получаете доступ к программному сервису, который
          имитирует разговор с носителем языка.
        </p>

        {/* Технологии */}
        <h2 className="text-2xl font-bold text-stone-800 mb-4">Технологии</h2>
        <p className="text-stone-700 mb-3">
          Сервис использует языковую модель Claude от Anthropic для генерации диалогов и
          обратной связи, ElevenLabs для синтеза речи, Supabase для хранения данных
          пользователей. Хостинг — Vercel.
        </p>
        <p className="text-stone-700 mb-10">
          Платежи обрабатывает сервис ЮKassa (АО «Тинькофф Банк» / ООО НКО «ЮMoney»).
        </p>

        {/* Footer links */}
        <div className="border-t border-stone-200 pt-6 text-sm text-stone-500 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/pricing" className="hover:text-amber-700">
            Тарифы
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
