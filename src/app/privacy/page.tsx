"use client";

import Link from "next/link";

export default function PrivacyPage() {
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
          Политика конфиденциальности
        </h1>
        <p className="text-stone-500 text-sm mb-10">
          Действует с 3 мая 2026 года
        </p>

        <section className="space-y-6 text-stone-700">
          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">1. Кто обрабатывает данные</h2>
            <p>
              Настоящая Политика конфиденциальности описывает, как самозанятый Мешалкин
              Александр Викторович (ИНН 540447003201, далее — «Оператор») обрабатывает
              персональные данные пользователей сервиса Everyday Fluency (далее — «Сервис»).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">2. Какие данные собираются</h2>
            <p className="mb-2">
              Оператор обрабатывает следующие категории персональных данных:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                адрес электронной почты — для регистрации, авторизации и связи с
                пользователем
              </li>
              <li>
                история чата с виртуальным преподавателем — для сохранения прогресса
                обучения и непрерывности уроков
              </li>
              <li>
                прогресс по урокам и трекер выученных выражений — для отображения
                персонального прогресса в Сервисе
              </li>
              <li>
                сведения о платежах (факт оплаты, тариф, дата) — для предоставления
                подписки и формирования чеков
              </li>
              <li>
                технические данные браузера (тип, версия, IP-адрес сессии) — собираются
                автоматически серверными логами и используются исключительно для
                диагностики работоспособности
              </li>
            </ul>
            <p className="mt-3">
              Оператор не запрашивает паспортные данные, номера банковских карт,
              финансовую или медицинскую информацию.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">3. Цели обработки</h2>
            <p className="mb-2">Персональные данные обрабатываются с целями:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>предоставление доступа к Сервису</li>
              <li>сохранение прогресса обучения пользователя</li>
              <li>обработка платежей и формирование чеков</li>
              <li>связь с пользователем по вопросам поддержки</li>
              <li>исполнение обязательств по договору оферты</li>
              <li>выполнение требований налогового законодательства</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">4. Правовые основания</h2>
            <p>
              Обработка осуществляется на основании Федерального закона № 152-ФЗ
              «О персональных данных», статьи 6 (согласие субъекта персональных данных и
              исполнение договора). Согласие пользователя выражается путём регистрации в
              Сервисе и продолжения его использования.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">5. Кому передаются данные</h2>
            <p className="mb-2">
              Оператор передаёт минимально необходимый объём данных следующим обработчикам:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Supabase</strong> (хостинг базы данных и аутентификации) —
                email, идентификатор пользователя, история чата, прогресс
              </li>
              <li>
                <strong>Vercel</strong> (хостинг сайта) — технические данные сессий
              </li>
              <li>
                <strong>Anthropic</strong> (API языковой модели Claude) — содержимое
                сообщений в рамках урока, без идентификаторов пользователя
              </li>
              <li>
                <strong>ElevenLabs</strong> (синтез речи) — текст для озвучки, без
                идентификаторов пользователя
              </li>
              <li>
                <strong>ЮKassa</strong> (платёжный процессор) — email, сумма платежа,
                реквизиты для формирования чека
              </li>
            </ul>
            <p className="mt-3">
              Оператор не передаёт персональные данные третьим лицам в иных целях, не
              продаёт и не сдаёт их в аренду.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">6. Сроки хранения</h2>
            <p className="mb-2">
              6.1. Данные учётной записи и история чата хранятся всё время, пока учётная
              запись активна.
            </p>
            <p className="mb-2">
              6.2. После удаления учётной записи данные удаляются в течение 30 календарных
              дней, за исключением данных о платежах, которые хранятся 4 года в соответствии
              с требованиями налогового законодательства.
            </p>
            <p>
              6.3. Технические логи сервера хранятся не более 30 дней.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">7. Права пользователя</h2>
            <p className="mb-2">Пользователь имеет право:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>получать информацию об обрабатываемых персональных данных</li>
              <li>требовать уточнения, блокирования или удаления данных</li>
              <li>отозвать согласие на обработку</li>
              <li>обратиться в Роскомнадзор при нарушении его прав</li>
            </ul>
            <p className="mt-3">
              Все запросы направляются на email{" "}
              <a
                href="mailto:shuligne@gmail.com"
                className="text-amber-700 hover:text-amber-900 font-medium"
              >
                shuligne@gmail.com
              </a>{" "}
              и обрабатываются в срок до 30 календарных дней.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">8. Защита данных</h2>
            <p>
              Оператор применяет организационные и технические меры для защиты
              персональных данных: шифрование передачи данных по протоколу HTTPS,
              хранение паролей в зашифрованном виде, ограничение доступа к базе данных,
              регулярный аудит безопасности используемых сервисов.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">9. Файлы cookie</h2>
            <p>
              Сервис использует функциональные файлы cookie, необходимые для поддержания
              сессии пользователя и сохранения настроек интерфейса. Аналитические или
              рекламные cookie не используются.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">10. Изменения политики</h2>
            <p>
              Оператор вправе изменять настоящую Политику. Актуальная редакция всегда
              публикуется по адресу{" "}
              <span className="font-mono text-sm">/privacy</span>. О существенных изменениях
              пользователи уведомляются по электронной почте.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-3">11. Контакты</h2>
            <p>
              По всем вопросам, связанным с обработкой персональных данных, обращайтесь по
              адресу{" "}
              <a
                href="mailto:shuligne@gmail.com"
                className="text-amber-700 hover:text-amber-900 font-medium"
              >
                shuligne@gmail.com
              </a>
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
          <Link href="/terms" className="hover:text-amber-700">
            Условия использования
          </Link>
          <Link href="/" className="hover:text-amber-700">
            На главную
          </Link>
        </div>
      </main>
    </div>
  );
}
