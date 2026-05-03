"use client";

import Link from "next/link";

/**
 * Footer для главной страницы.
 * Содержит ссылки на /pricing, /about, /terms, /privacy.
 * Это требование модерации ЮKassa: с главной должны быть видны цены,
 * реквизиты самозанятого, оферта и политика конфиденциальности.
 *
 * Импортировать в app/page.tsx и поместить ВНЕ блока с lessonId
 * (то есть показывать всегда, и на лендинге, и в активном уроке —
 * иначе модератор не увидит ссылки).
 */
export default function SiteFooter() {
  return (
    <footer className="bg-white/90 backdrop-blur-md border-t border-stone-100 px-4 sm:px-6 py-4">
      <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/pricing" className="hover:text-amber-700 transition-colors">
            Тарифы
          </Link>
          <Link href="/about" className="hover:text-amber-700 transition-colors">
            Реквизиты
          </Link>
          <Link href="/terms" className="hover:text-amber-700 transition-colors">
            Оферта
          </Link>
          <Link href="/privacy" className="hover:text-amber-700 transition-colors">
            Политика
          </Link>
        </div>
        <div className="text-stone-400">
          ИНН 540447003201 · Самозанятый
        </div>
      </div>
    </footer>
  );
}
