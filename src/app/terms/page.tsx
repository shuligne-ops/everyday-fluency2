"use client";

import Link from "next/link";

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-stone-800 mb-3">
          Публичная оферта на оказание услуг
        </h1>
        <p className="text-stone-500 text-sm mb-10">
          Действует с 3 мая 2026 года
        </p>

        <section className="prose prose-stone max-w-none text-stone-700 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">1. Общие положения</h2>
            <p className="mb-2">
              1.1. Настоящий документ является публичной офертой (далее — «Оферта»)
              самозанятого Мешалкина Александра Викторовича, ИНН 540447003201
              (далее — «Исполнитель»), и содержит все существенные условия оказания услуг
              сервиса Everyday Fluency (далее — «Сервис»).
            </p>
            <p className="mb-2">
              1.2. В соответствии со статьёй 437 Гражданского кодекса Российской Федерации
              данная Оферта является официальным предложением Исполнителя любому
              физическому лицу (далее — «Пользователь») заключить договор оказания услуг
              на изложенных ниже условиях.
            </p>
            <p>
              1.3. Акцептом Оферты является оплата услуг Пользователем. С момента акцепта
              договор между Исполнителем и Пользователем считается заключённым.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">2. Предмет договора</h2>
            <p className="mb-2">
              2.1. Исполнитель предоставляет Пользователю доступ к программному сервису
              Everyday Fluency, размещённому по адресу{" "}
              <span className="font-mono text-sm">
                https://everyday-fluency2.vercel.app
              </span>
              .
            </p>
            <p className="mb-2">
              2.2. Сервис представляет собой набор интерактивных уроков разговорного
              английского языка с использованием технологии искусственного интеллекта.
              Уроки сгруппированы по уровням сложности от A1 до C2 по шкале CEFR.
            </p>
            <p>
              2.3. Уроки уровня A1 предоставляются Пользователю бесплатно. Доступ к
              урокам уровней A2, B1, B2, C1, C2 предоставляется на возмездной основе по
              условиям выбранного тарифа.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">3. Тарифы и порядок оплаты</h2>
            <p className="mb-2">
              3.1. Действующие тарифы публикуются на странице{" "}
              <Link href="/pricing" className="text-amber-700 hover:text-amber-900">
                /pricing
              </Link>{" "}
              сайта Сервиса.
            </p>
            <p className="mb-2">
              3.2. Оплата производится в российских рублях через платёжный сервис
              ЮKassa с использованием банковской карты, СБП, ЮMoney, SberPay и других
              доступных способов.
            </p>
            <p className="mb-2">
              3.3. Доступ к выбранному уровню активируется автоматически в течение 5 минут
              после поступления оплаты на счёт Исполнителя.
            </p>
            <p>
              3.4. После каждой оплаты Пользователю на указанный email направляется чек
              в соответствии с требованиями налогового законодательства Российской Федерации
              для самозанятых.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">4. Срок действия услуг</h2>
            <p className="mb-2">
              4.1. При оформлении тарифа «Месяц» доступ предоставляется на 30 календарных
              дней с момента оплаты.
            </p>
            <p className="mb-2">
              4.2. При оформлении тарифа «Год» доступ предоставляется на 365 календарных
              дней с момента оплаты.
            </p>
            <p>
              4.3. При оформлении тарифа «Навсегда» доступ предоставляется бессрочно при
              условии работоспособности Сервиса.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">5. Возврат денежных средств</h2>
            <p className="mb-2">
              5.1. Пользователь вправе отказаться от услуг и потребовать возврата уплаченных
              средств в течение 14 (четырнадцати) календарных дней с момента оплаты при
              условии, что им пройдено не более 5 (пяти) уроков на оплаченных уровнях.
            </p>
            <p className="mb-2">
              5.2. Для оформления возврата Пользователь направляет заявление на электронную
              почту{" "}
              <a
                href="mailto:shuligne@gmail.com"
                className="text-amber-700 hover:text-amber-900"
              >
                shuligne@gmail.com
              </a>{" "}
              с указанием email учётной записи и реквизитов для возврата.
            </p>
            <p>
              5.3. Возврат производится в течение 10 рабочих дней с момента получения
              заявления тем же способом, которым была произведена оплата.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">6. Права и обязанности сторон</h2>
            <p className="mb-2">
              6.1. Исполнитель обязуется обеспечивать работоспособность Сервиса в режиме
              24/7, за исключением технических работ, о которых Пользователи уведомляются
              заранее.
            </p>
            <p className="mb-2">
              6.2. Исполнитель вправе изменять состав уроков, добавлять новый материал и
              корректировать существующий с целью улучшения качества Сервиса.
            </p>
            <p className="mb-2">
              6.3. Пользователь обязуется не передавать данные своей учётной записи третьим
              лицам и использовать Сервис только в личных некоммерческих целях.
            </p>
            <p>
              6.4. Пользователь подтверждает, что понимает: преподаватель Sophie является
              программой на базе искусственного интеллекта, а не живым человеком.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">7. Ответственность сторон</h2>
            <p className="mb-2">
              7.1. Стороны несут ответственность в соответствии с законодательством
              Российской Федерации.
            </p>
            <p className="mb-2">
              7.2. Исполнитель не несёт ответственности за временную недоступность Сервиса,
              вызванную техническими сбоями у сторонних провайдеров (Vercel, Supabase,
              Anthropic, ElevenLabs).
            </p>
            <p>
              7.3. Сервис предоставляется «как есть». Исполнитель не гарантирует
              достижение Пользователем какого-либо конкретного уровня владения языком —
              результат зависит от усилий и регулярности занятий самого Пользователя.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">8. Заключительные положения</h2>
            <p className="mb-2">
              8.1. Все споры решаются путём переговоров. При недостижении согласия —
              в порядке, установленном законодательством Российской Федерации.
            </p>
            <p className="mb-2">
              8.2. Исполнитель вправе вносить изменения в настоящую Оферту. Актуальная
              редакция всегда публикуется по адресу{" "}
              <span className="font-mono text-sm">/terms</span>.
            </p>
            <p>
              8.3. Обработка персональных данных регулируется отдельным документом —{" "}
              <Link href="/privacy" className="text-amber-700 hover:text-amber-900">
                Политикой конфиденциальности
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Footer links */}
        <div className="border-t border-stone-200 pt-6 mt-12 text-sm text-stone-500 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/pricing" className="hover:text-amber-700">
            Тарифы
          </Link>
          <Link href="/about" className="hover:text-amber-700">
            Реквизиты
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
