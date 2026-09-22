'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type PatternId =
  | 'wish_past' | 'should_have' | 'mixed_conditional' | 'present_perfect_continuous'
  | 'used_to' | 'about_to' | 'end_up' | 'might_as_well' | 'no_point_in'
  | 'would_rather' | 'supposed_to' | 'managed_to'

type Drill = { cue: string; note?: string; models: string[] }
type Pattern = {
  id: PatternId
  name: string
  category: 'Времена и aspect' | 'Модальность' | 'Разговорные конструкции'
  level: string
  form: string
  meaning: string
  repair: string
  drills: Drill[]
}
type Attempt = { transcript: string; latencyMs: number; score: 0 | 1 | 2 }
type Progress = { sessions: number; strength: number; medianLatencyMs: number | null; nextDueAt: string }
type ProgressMap = Partial<Record<PatternId, Progress>>

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onspeechstart: (() => void) | null
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

const COLORS = {
  navy: '#0f1b3d', amber: '#f59e0b', pale: '#fff8ed', ink: '#17213f', muted: '#667085',
  green: '#15803d', red: '#b42318', line: '#eadfce', bluePale: '#eef4ff',
}
const STORAGE_KEY = 'ef_language_retrieval_deep_v1'
const SESSION_SIZE = 10

const PATTERNS: Pattern[] = [
  {
    id: 'wish_past', name: 'Сожаление о прошлом', category: 'Времена и aspect', level: 'B1–B2',
    form: 'wish + had + V3', meaning: 'Сожаление о прошлом действии или решении.',
    repair: 'После wish отодвинь прошлое ещё на шаг назад: had + V3.',
    drills: [
      { cue: 'Жаль, что я тогда не принял ту работу.', models: ["I wish I'd taken that job.", 'I wish I had accepted that job.'] },
      { cue: 'Жаль, что я вчера не лёг раньше.', models: ["I wish I'd gone to bed earlier.", 'I wish I had gone to bed earlier.'] },
      { cue: 'Жаль, что мы купили более дешёвый вариант.', models: ["I wish we hadn't bought the cheaper one.", "I wish we'd bought the better one."] },
      { cue: 'Жаль, что я не забронировал столик заранее.', models: ["I wish I'd booked in advance.", "I wish I'd made a reservation earlier."] },
      { cue: 'Жаль, что я ей тогда не позвонил.', models: ["I wish I'd called her then.", 'I wish I had phoned her.'] },
      { cue: 'Жаль, что я это сказал.', models: ["I wish I hadn't said that.", "I wish I'd kept quiet."] },
      { cue: 'Жаль, что мы не взяли такси.', models: ["I wish we'd taken a taxi.", "I wish we hadn't walked all the way."] },
      { cue: 'Жаль, что я продал старую машину.', models: ["I wish I hadn't sold my old car.", "I wish I'd kept my old car."] },
      { cue: 'Жаль, что я не учил французский раньше.', models: ["I wish I'd learned French earlier.", "I wish I'd studied French at school."] },
      { cue: 'Жаль, что я не перепроверил адрес.', models: ["I wish I'd checked the address.", 'I wish I had double-checked the address.'] },
    ],
  },
  {
    id: 'should_have', name: 'Надо было сделать', category: 'Модальность', level: 'B1–B2',
    form: 'should have + V3', meaning: 'Правильное действие в прошлом, которое не произошло.',
    repair: 'Оцениваешь прошлое задним числом: should have + V3.',
    drills: [
      { cue: 'Надо было зарядить телефон вчера.', models: ['I should have charged my phone yesterday.', "I should've charged it yesterday."] },
      { cue: 'Нам надо было выехать раньше.', models: ['We should have left earlier.', "We should've set off earlier."] },
      { cue: 'Тебе надо было ответить сразу.', models: ['You should have replied straight away.', "You should've answered immediately."] },
      { cue: 'Мне надо было купить билет раньше.', models: ['I should have bought the ticket earlier.', "I should've booked it sooner."] },
      { cue: 'Ей надо было предупредить нас.', models: ['She should have warned us.', "She should've let us know."] },
      { cue: 'Нам не надо было соглашаться так быстро.', models: ["We shouldn't have agreed so quickly.", 'We should not have said yes that fast.'] },
      { cue: 'Мне надо было проверить прогноз.', models: ['I should have checked the forecast.', "I should've looked at the weather first."] },
      { cue: 'Тебе не надо было ему это говорить.', models: ["You shouldn't have told him that.", 'You should not have said that to him.'] },
      { cue: 'Нам надо было взять карту.', models: ['We should have taken a map.', "We should've brought a map with us."] },
      { cue: 'Мне надо было сохранить копию файла.', models: ['I should have saved a copy of the file.', "I should've kept a backup."] },
    ],
  },
  {
    id: 'mixed_conditional', name: 'Прошлое → результат сейчас', category: 'Времена и aspect', level: 'B2',
    form: 'If + had + V3, would/could + V now', meaning: 'Нереальная причина в прошлом и её результат сейчас.',
    repair: 'Причина была в прошлом: if + past perfect. Результат относится к сейчас: would/could + глагол.',
    drills: [
      { cue: 'Если бы я лёг раньше, я бы сейчас не был таким уставшим.', models: ["If I'd gone to bed earlier, I wouldn't be so tired now.", 'If I had gone to bed earlier, I would feel better now.'] },
      { cue: 'Если бы она учила французский, она могла бы сейчас говорить с клиентом.', models: ["If she'd learned French, she could talk to the client now.", 'If she had studied French, she could speak to the client now.'] },
      { cue: 'Если бы я принял ту работу, я бы сейчас здесь не работал.', models: ["If I'd taken that job, I wouldn't be working here now.", 'If I had accepted that job, I would not be here now.'] },
      { cue: 'Если бы мы купили новую машину, мы бы сейчас не ремонтировали эту каждую неделю.', models: ["If we'd bought a new car, we wouldn't be fixing this one every week now.", 'If we had bought a new car, we would not have this problem now.'] },
      { cue: 'Если бы он сохранил деньги, ему бы сейчас не пришлось брать кредит.', models: ["If he'd saved the money, he wouldn't need a loan now.", 'If he had saved more, he would not have to borrow money now.'] },
      { cue: 'Если бы я не пропустил поезд, я бы сейчас уже был дома.', models: ["If I hadn't missed the train, I'd be home by now.", 'If I had caught the train, I would be home now.'] },
      { cue: 'Если бы мы переехали тогда, дети сейчас ходили бы в другую школу.', models: ["If we'd moved then, the kids would be at a different school now.", 'If we had moved, the children would go to another school now.'] },
      { cue: 'Если бы она послушала врача, ей бы сейчас было лучше.', models: ["If she'd listened to the doctor, she'd feel better now.", 'If she had followed the doctor’s advice, she would be better now.'] },
      { cue: 'Если бы я не потратил всё, у меня сейчас были бы деньги на поездку.', models: ["If I hadn't spent it all, I'd have money for the trip now.", 'If I had saved some of it, I could afford the trip now.'] },
      { cue: 'Если бы мы начали раньше, сейчас бы не спешили.', models: ["If we'd started earlier, we wouldn't be rushing now.", 'If we had begun earlier, we would not be in a hurry now.'] },
    ],
  },
  {
    id: 'present_perfect_continuous', name: 'Длится до настоящего момента', category: 'Времена и aspect', level: 'B1–B2',
    form: 'have/has been + -ing', meaning: 'Процесс начался раньше и продолжается до сейчас или только что закончился.',
    repair: 'Если важен продолжающийся процесс до настоящего момента: have/has been + -ing.',
    drills: [
      { cue: 'Я работаю над этим отчётом с восьми утра.', models: ["I've been working on this report since eight.", 'I have been working on this report since 8 a.m.'] },
      { cue: 'Дождь идёт уже три часа.', models: ["It's been raining for three hours.", 'It has been raining for the last three hours.'] },
      { cue: 'Я учу французский последние полгода.', models: ["I've been learning French for the last six months.", 'I have been studying French for six months.'] },
      { cue: 'Она ждёт врача уже сорок минут.', models: ["She's been waiting for the doctor for forty minutes.", 'She has been waiting for forty minutes.'] },
      { cue: 'Мы обсуждаем это с самого утра.', models: ["We've been discussing this all morning.", 'We have been talking about this since this morning.'] },
      { cue: 'Он весь день пытается тебе дозвониться.', models: ["He's been trying to call you all day.", 'He has been trying to reach you all day.'] },
      { cue: 'Я ищу ключи уже двадцать минут.', models: ["I've been looking for my keys for twenty minutes.", 'I have been searching for my keys for twenty minutes.'] },
      { cue: 'Они строят этот дом уже два года.', models: ["They've been building this house for two years.", 'They have been working on this house for two years.'] },
      { cue: 'Ты слишком долго сидишь за компьютером.', models: ["You've been sitting at the computer for too long.", 'You have been working at the computer too long.'] },
      { cue: 'Мы пытаемся решить эту проблему уже несколько недель.', models: ["We've been trying to solve this problem for weeks.", 'We have been working on this problem for several weeks.'] },
    ],
  },
  {
    id: 'used_to', name: 'Раньше было регулярно', category: 'Времена и aspect', level: 'B1',
    form: 'used to + verb', meaning: 'Прошлая привычка или состояние, которых сейчас уже нет.',
    repair: 'Регулярное прошлое, которое изменилось: used to + начальная форма.',
    drills: [
      { cue: 'Я раньше курил.', models: ['I used to smoke.', 'I used to be a smoker.'] },
      { cue: 'Они раньше жили у моря.', models: ['They used to live by the sea.', 'They used to live near the coast.'] },
      { cue: 'Я раньше ездил на работу на велосипеде.', models: ['I used to cycle to work.', 'I used to ride my bike to work.'] },
      { cue: 'Здесь раньше был кинотеатр.', models: ['There used to be a cinema here.', 'There used to be a movie theatre here.'] },
      { cue: 'Мы раньше часто встречались по пятницам.', models: ['We used to meet on Fridays.', 'We used to get together every Friday.'] },
      { cue: 'Она раньше боялась летать.', models: ['She used to be afraid of flying.', 'She used to hate flying.'] },
      { cue: 'Я раньше работал по ночам.', models: ['I used to work nights.', 'I used to work at night.'] },
      { cue: 'Он раньше носил очки.', models: ['He used to wear glasses.', 'He used to have to wear glasses.'] },
      { cue: 'Мы раньше не заказывали еду домой.', models: ["We didn't use to order food in.", "We didn't use to get food delivered."] },
      { cue: 'Ты раньше часто сюда приходил?', models: ['Did you use to come here often?', 'Did you use to come here a lot?'] },
    ],
  },
  {
    id: 'about_to', name: 'Вот-вот собираюсь', category: 'Разговорные конструкции', level: 'B1',
    form: 'be about to + verb', meaning: 'Действие должно произойти буквально сейчас.',
    repair: 'Для «вот-вот / уже собирался»: be about to + глагол.',
    drills: [
      { cue: 'Я как раз собирался выходить.', models: ['I was just about to leave.', 'I was about to head out.'] },
      { cue: 'Я как раз собирался тебе звонить.', models: ['I was just about to call you.', 'I was about to give you a call.'] },
      { cue: 'Поезд вот-вот отправится.', models: ['The train is about to leave.', 'The train is just about to depart.'] },
      { cue: 'Мы вот-вот начнём.', models: ["We're about to start.", "We're just about to begin."] },
      { cue: 'Фильм вот-вот начнётся.', models: ['The film is about to start.', 'The movie is just about to begin.'] },
      { cue: 'Я уже собирался отправить письмо.', models: ['I was about to send the email.', 'I was just about to send it.'] },
      { cue: 'Она вот-вот расплачется.', models: ["She's about to cry.", "She looks like she's about to cry."] },
      { cue: 'Самолёт вот-вот приземлится.', models: ['The plane is about to land.', 'The plane is just about to touch down.'] },
      { cue: 'Мы уже собирались уходить, когда он пришёл.', models: ['We were about to leave when he arrived.', 'We were just about to go when he turned up.'] },
      { cue: 'Я хотел сказать то же самое.', models: ['I was about to say the same thing.', 'I was just about to say that.'] },
    ],
  },
  {
    id: 'end_up', name: 'В итоге получилось', category: 'Разговорные конструкции', level: 'B1–B2',
    form: 'end up + -ing', meaning: 'Конечный, часто неожиданный результат.',
    repair: 'Для «в итоге» после end up обычно идёт -ing.',
    drills: [
      { cue: 'В итоге я остался там на весь вечер.', models: ['I ended up staying there all evening.', 'I ended up spending the whole evening there.'] },
      { cue: 'В итоге мы поехали поездом.', models: ['We ended up taking the train.', 'We ended up going by train.'] },
      { cue: 'В итоге она купила машину.', models: ['She ended up buying a car.', 'She ended up getting a car.'] },
      { cue: 'В итоге я посмотрел весь сезон.', models: ['I ended up watching the whole season.', 'I ended up binge-watching the whole season.'] },
      { cue: 'В итоге мы потратили гораздо больше.', models: ['We ended up spending much more.', 'We ended up paying a lot more.'] },
      { cue: 'В итоге он работал там десять лет.', models: ['He ended up working there for ten years.', 'He ended up staying with the company for ten years.'] },
      { cue: 'В итоге я сам всё сделал.', models: ['I ended up doing everything myself.', 'I ended up handling it all myself.'] },
      { cue: 'В итоге они отменили поездку.', models: ['They ended up cancelling the trip.', 'They ended up calling the trip off.'] },
      { cue: 'В итоге мы говорили до двух ночи.', models: ['We ended up talking until two in the morning.', 'We ended up chatting until 2 a.m.'] },
      { cue: 'В итоге он согласился.', models: ['He ended up agreeing.', 'He ended up saying yes.'] },
    ],
  },
  {
    id: 'might_as_well', name: 'Раз уж так — можно и…', category: 'Модальность', level: 'B2',
    form: 'might as well + verb', meaning: 'Практичный выбор, когда альтернативы не лучше.',
    repair: 'Когда «раз уж всё равно…»: might as well + глагол.',
    drills: [
      { cue: 'Автобус ушёл. Раз уж ждать сорок минут, можно пойти пешком.', models: ['We might as well walk.', 'We might as well go on foot.'] },
      { cue: 'Мы уже здесь. Можно заодно зайти в магазин.', models: ['We might as well go into the shop.', 'We might as well stop by the shop.'] },
      { cue: 'Раз уж всё равно включил компьютер, можно проверить почту.', models: ['I might as well check my email.', 'I might as well have a look at my email.'] },
      { cue: 'Если поезд отменили, можно остаться ещё на ночь.', models: ['We might as well stay another night.', 'We might as well stay here one more night.'] },
      { cue: 'Раз всё равно готовишь, приготовь на двоих.', models: ['You might as well cook for two.', 'You might as well make enough for two.'] },
      { cue: 'Раз уж начали, давай закончим.', models: ['We might as well finish it.', 'We might as well see it through.'] },
      { cue: 'Раз уж дождь не прекращается, можно посмотреть фильм.', models: ['We might as well watch a film.', 'We might as well put a movie on.'] },
      { cue: 'Раз уж он всё равно знает, можно сказать ему правду.', models: ['We might as well tell him the truth.', 'We might as well be honest with him.'] },
      { cue: 'Раз уж приехали рано, можно выпить кофе.', models: ['We might as well get a coffee.', 'We might as well have a coffee.'] },
      { cue: 'Раз уж больше нечего делать, можно начать сейчас.', models: ['We might as well start now.', 'We might as well get started now.'] },
    ],
  },
  {
    id: 'no_point_in', name: 'Нет смысла', category: 'Разговорные конструкции', level: 'B1–B2',
    form: "there's no point in + -ing", meaning: 'Действие бессмысленно или ничего не изменит.',
    repair: 'После no point in используй -ing.',
    drills: [
      { cue: 'Нет смысла спорить об этом сейчас.', models: ["There's no point in arguing about it now.", 'There is no point in discussing it right now.'] },
      { cue: 'Нет смысла ждать ещё час.', models: ["There's no point in waiting another hour.", 'There is no point in staying here for another hour.'] },
      { cue: 'Нет смысла ему звонить — он за рулём.', models: ["There's no point in calling him; he's driving.", 'There is no point in phoning him now.'] },
      { cue: 'Нет смысла покупать новый, если этот работает.', models: ["There's no point in buying a new one if this one works.", 'There is no point in replacing it if it still works.'] },
      { cue: 'Нет смысла волноваться заранее.', models: ["There's no point in worrying in advance.", 'There is no point in worrying about it yet.'] },
      { cue: 'Нет смысла начинать всё сначала.', models: ["There's no point in starting all over again.", 'There is no point in starting from scratch.'] },
      { cue: 'Нет смысла скрывать это от неё.', models: ["There's no point in hiding it from her.", 'There is no point in keeping it from her.'] },
      { cue: 'Нет смысла брать такси — мы почти пришли.', models: ["There's no point in taking a taxi; we're almost there.", 'There is no point in getting a cab now.'] },
      { cue: 'Нет смысла пытаться его переубедить.', models: ["There's no point in trying to change his mind.", 'There is no point in trying to convince him.'] },
      { cue: 'Нет смысла делать это дважды.', models: ["There's no point in doing it twice.", 'There is no point in doing the same thing twice.'] },
    ],
  },
  {
    id: 'would_rather', name: 'Я бы предпочёл', category: 'Модальность', level: 'B1–B2',
    form: "I'd rather + verb", meaning: 'Предпочтение между вариантами.',
    repair: 'После would rather идёт начальная форма без to.',
    drills: [
      { cue: 'Я бы лучше остался дома сегодня.', models: ["I'd rather stay home tonight.", 'I would rather stay in tonight.'] },
      { cue: 'Я бы предпочёл поговорить завтра.', models: ["I'd rather talk tomorrow.", 'I would rather discuss it tomorrow.'] },
      { cue: 'Мы бы лучше поехали поездом.', models: ["We'd rather take the train.", 'We would rather go by train.'] },
      { cue: 'Я бы лучше не обсуждал это сейчас.', models: ["I'd rather not discuss it now.", 'I would rather not talk about it right now.'] },
      { cue: 'Она бы предпочла работать из дома.', models: ["She'd rather work from home.", 'She would rather work at home.'] },
      { cue: 'Я бы лучше заплатил немного больше.', models: ["I'd rather pay a little more.", 'I would rather spend a bit more.'] },
      { cue: 'Мы бы предпочли подождать.', models: ["We'd rather wait.", 'We would rather wait a little longer.'] },
      { cue: 'Он бы лучше поехал один.', models: ["He'd rather go alone.", 'He would rather travel by himself.'] },
      { cue: 'Я бы лучше сделал это сам.', models: ["I'd rather do it myself.", 'I would rather handle it myself.'] },
      { cue: 'Ты бы предпочёл остаться или уйти?', models: ['Would you rather stay or leave?', 'Would you rather stay here or go?'] },
    ],
  },
  {
    id: 'supposed_to', name: 'По идее / по правилам', category: 'Модальность', level: 'B1–B2',
    form: 'be supposed to + verb', meaning: 'План, ожидание, правило или договорённость.',
    repair: 'Для «по идее / согласно плану / по правилам»: be supposed to.',
    drills: [
      { cue: 'Он должен был приехать к шести.', models: ['He was supposed to be here by six.', 'He was supposed to arrive by six.'] },
      { cue: 'Мы должны начать в девять, верно?', models: ["We're supposed to start at nine, right?", 'We are supposed to begin at nine, aren’t we?'] },
      { cue: 'Мы не должны делиться этим файлом.', models: ["We're not supposed to share this file.", 'We are not supposed to send this file outside.'] },
      { cue: 'Поезд по расписанию должен прийти в 18:20.', models: ['The train is supposed to arrive at 6:20.', 'The train is supposed to get in at 6:20.'] },
      { cue: 'Ты должен был позвонить мне вчера.', models: ['You were supposed to call me yesterday.', 'You were supposed to phone me yesterday.'] },
      { cue: 'Эта кнопка должна открыть меню.', models: ['This button is supposed to open the menu.', 'This button is supposed to bring up the menu.'] },
      { cue: 'Нам нельзя парковаться здесь.', models: ["We're not supposed to park here.", 'We are not supposed to leave the car here.'] },
      { cue: 'Встреча должна закончиться к пяти.', models: ['The meeting is supposed to finish by five.', 'The meeting is supposed to be over by five.'] },
      { cue: 'Он должен сейчас быть в отпуске.', models: ["He's supposed to be on holiday now.", 'He is supposed to be on vacation at the moment.'] },
      { cue: 'Что я должен здесь делать?', models: ['What am I supposed to do here?', 'What exactly am I supposed to do?'] },
    ],
  },
  {
    id: 'managed_to', name: 'Всё-таки удалось', category: 'Разговорные конструкции', level: 'B1–B2',
    form: 'manage to + verb', meaning: 'Удалось сделать что-то несмотря на трудность.',
    repair: 'Когда важны трудность и успешный результат: manage to + глагол.',
    drills: [
      { cue: 'Мне всё-таки удалось успеть на поезд.', models: ['I managed to catch the train.', 'I managed to make the train.'] },
      { cue: 'Нам удалось закончить это сегодня.', models: ['We managed to finish it today.', 'We managed to get it done today.'] },
      { cue: 'Ей удалось найти билет на пятницу.', models: ['She managed to find a ticket for Friday.', 'She managed to get a ticket for Friday.'] },
      { cue: 'Мне удалось найти дом без карты.', models: ['I managed to find the house without a map.', 'I managed to get there without a map.'] },
      { cue: 'Он всё-таки смог открыть дверь.', models: ['He managed to open the door.', 'He managed to get the door open.'] },
      { cue: 'Мы смогли договориться о цене.', models: ['We managed to agree on a price.', 'We managed to reach an agreement on the price.'] },
      { cue: 'Мне удалось поспать пару часов.', models: ['I managed to get a couple of hours of sleep.', 'I managed to sleep for a couple of hours.'] },
      { cue: 'Она всё-таки связалась с ним.', models: ['She managed to contact him.', 'She managed to get hold of him.'] },
      { cue: 'Нам удалось избежать пробки.', models: ['We managed to avoid the traffic.', 'We managed to miss the worst of the traffic.'] },
      { cue: 'Я всё-таки починил это сам.', models: ['I managed to fix it myself.', 'I managed to repair it on my own.'] },
    ],
  },
]

function normalize(text: string) {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreTarget(id: PatternId, raw: string): 0 | 1 | 2 {
  const t = normalize(raw)
  const tests: Record<PatternId, { full: RegExp; partial: RegExp }> = {
    wish_past: { full: /\bwish\b.*\b(had|hadn't|had not|'d)\b/, partial: /\bwish\b/ },
    should_have: { full: /\bshould\s+(have|'ve)\b|\bshouldn't\s+(have|'ve)\b/, partial: /\bshould\b|\bshouldn't\b/ },
    mixed_conditional: { full: /\bif\b.*\b(had|hadn't|had not|'d)\b.*\b(would|wouldn't|would not|could|'d)\b/, partial: /\bif\b.*\b(would|could)\b/ },
    present_perfect_continuous: { full: /\b(have|has|'ve|'s)\s+been\s+[a-z]+ing\b/, partial: /\bbeen\s+[a-z]+ing\b/ },
    used_to: { full: /\bused to\b|\bdidn't use to\b|\bdid you use to\b/, partial: /\bused\b|\buse to\b/ },
    about_to: { full: /\b(am|is|are|was|were|'m|'s|'re)\s+(just\s+)?about to\b/, partial: /\babout to\b/ },
    end_up: { full: /\b(end|ended|ends|ending)\s+up\s+[a-z]+ing\b/, partial: /\bend(ed|s|ing)?\s+up\b/ },
    might_as_well: { full: /\bmight as well\b/, partial: /\bmight\b.*\bwell\b/ },
    no_point_in: { full: /\b(no point in|there's no point in|there is no point in)\b.*\b[a-z]+ing\b/, partial: /\bno point\b/ },
    would_rather: { full: /\b(would rather|'d rather)\b/, partial: /\brather\b/ },
    supposed_to: { full: /\b(am|is|are|was|were|'m|'s|'re)\s+(not\s+)?supposed to\b/, partial: /\bsupposed to\b/ },
    managed_to: { full: /\b(manage|managed|manages)\s+to\b/, partial: /\bmanage(d|s)?\b/ },
  }
  if (tests[id].full.test(t)) return 2
  if (tests[id].partial.test(t)) return 1
  return 0
}

function median(values: number[]) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function dueLabel(progress?: Progress) {
  if (!progress) return 'Новый'
  const due = new Date(progress.nextDueAt).getTime()
  if (due <= Date.now()) return 'Пора повторить'
  return `Через ${Math.max(1, Math.ceil((due - Date.now()) / 86400000))} дн.`
}

export default function DeepPractice() {
  const [view, setView] = useState<'library' | 'practice' | 'result'>('library')
  const [patternId, setPatternId] = useState<PatternId>('wish_past')
  const [index, setIndex] = useState(0)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [progress, setProgress] = useState<ProgressMap>({})
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const shownAtRef = useRef(Date.now())
  const speechAtRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setProgress(JSON.parse(raw) as ProgressMap) } catch {}
  }, [])

  useEffect(() => {
    shownAtRef.current = Date.now(); speechAtRef.current = null; setTyped(''); setShowTyped(false); setError('')
    try { recognitionRef.current?.abort() } catch {}
    recognitionRef.current = null; setRecording(false)
  }, [index, patternId, view])

  const pattern = useMemo(() => PATTERNS.find((p) => p.id === patternId)!, [patternId])
  const drill = pattern.drills[index]
  const attempt = attempts[index]

  function persist(next: ProgressMap) {
    setProgress(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  function choosePattern(id: PatternId) {
    setPatternId(id); setIndex(0); setAttempts([]); setView('practice')
  }

  function chooseRecommended() {
    const now = Date.now()
    const ranked = [...PATTERNS].sort((a, b) => {
      const pa = progress[a.id], pb = progress[b.id]
      const ad = !pa || new Date(pa.nextDueAt).getTime() <= now ? 0 : 1
      const bd = !pb || new Date(pb.nextDueAt).getTime() <= now ? 0 : 1
      if (ad !== bd) return ad - bd
      return (pa?.strength ?? -1) - (pb?.strength ?? -1)
    })
    choosePattern(ranked[0].id)
  }

  function startVoice() {
    setError('')
    const w = window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) { setError('Голосовой ввод здесь не поддерживается. Используй Chrome или текст.'); setShowTyped(true); return }
    try {
      const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 1
      recognitionRef.current = rec
      rec.onstart = () => setRecording(true)
      rec.onspeechstart = () => { speechAtRef.current = Date.now() }
      rec.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        const transcript = last?.[0]?.transcript?.trim(); setRecording(false)
        if (!transcript) { setError('Не расслышал. Попробуй ещё раз.'); return }
        submitAnswer(transcript, Math.max(0, (speechAtRef.current ?? Date.now()) - shownAtRef.current))
      }
      rec.onerror = () => { setRecording(false); setError('Голосовой ввод не сработал. Можно пройти упражнение текстом.'); setShowTyped(true) }
      rec.onend = () => setRecording(false)
      rec.start()
    } catch { setRecording(false); setShowTyped(true); setError('Не удалось запустить голосовой ввод. Используй текст.') }
  }

  function stopVoice() { try { recognitionRef.current?.stop() } catch {}; setRecording(false) }

  function submitAnswer(transcript: string, latencyMs: number) {
    const next = [...attempts]
    next[index] = { transcript, latencyMs, score: scoreTarget(pattern.id, transcript) }
    setAttempts(next)
  }

  function submitTyped() {
    const text = typed.trim(); if (!text) return
    submitAnswer(text, Math.max(0, Date.now() - shownAtRef.current))
  }

  function finish() {
    const rows = attempts.filter(Boolean)
    const total = rows.reduce((sum, r) => sum + r.score, 0)
    const accuracy = rows.length ? total / (rows.length * 2) : 0
    const lastThree = rows.slice(-3)
    const lastThreeAccuracy = lastThree.length ? lastThree.reduce((s, r) => s + r.score, 0) / (lastThree.length * 2) : 0
    const strength = Math.max(0, Math.min(5, Math.round((accuracy * .45 + lastThreeAccuracy * .55) * 5)))
    const med = median(rows.map((r) => r.latencyMs))
    const days = strength <= 1 ? 1 : strength === 2 ? 2 : strength === 3 ? 3 : strength === 4 ? 7 : 14
    const old = progress[pattern.id]
    persist({
      ...progress,
      [pattern.id]: { sessions: (old?.sessions ?? 0) + 1, strength, medianLatencyMs: med, nextDueAt: new Date(Date.now() + days * 86400000).toISOString() },
    })
    setView('result')
  }

  function nextDrill() {
    if (index < SESSION_SIZE - 1) setIndex(index + 1)
    else finish()
  }

  function resetAll() { try { localStorage.removeItem(STORAGE_KEY) } catch {}; setProgress({}) }

  if (view === 'library') {
    const completed = Object.keys(progress).length
    return <main style={pageStyle}><div style={shellStyle}>
      <p style={kicker}>Everyday Fluency · Language Retrieval Lab</p>
      <h1 style={hero}>Ты это знаешь. Теперь достань это быстро и без подсказки.</h1>
      <p style={lead}>Теперь одна тренировка — это <b>{SESSION_SIZE} разных ситуаций</b> на одну конструкцию. После каждого ответа ты всегда видишь рекомендуемый вариант и ещё один естественный способ сказать то же самое. Резюме появляется только после всей серии.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
        <button onClick={chooseRecommended} style={primaryButton}>Начать рекомендуемый паттерн →</button>
        <button onClick={resetAll} style={ghostButton}>Сбросить прогресс</button>
      </div>
      <p style={{ fontSize: 13, color: COLORS.muted }}>Пройдено паттернов: {completed}/{PATTERNS.length}. Прогресс хранится в этом браузере.</p>
      {(['Времена и aspect', 'Модальность', 'Разговорные конструкции'] as const).map((category) => <section key={category} style={{ marginTop: 30 }}>
        <h2 style={{ color: COLORS.navy, fontSize: 20 }}>{category}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
          {PATTERNS.filter((p) => p.category === category).map((p) => {
            const pr = progress[p.id]
            return <button key={p.id} onClick={() => choosePattern(p.id)} style={patternCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ ...chip, background: pr ? COLORS.bluePale : '#f6f1e9' }}>{dueLabel(pr)}</span><span style={{ fontSize: 12, color: COLORS.muted }}>{p.level}</span></div>
              <strong style={{ display: 'block', fontSize: 17, color: COLORS.navy, marginTop: 12 }}>{p.name}</strong>
              <span style={{ display: 'block', fontSize: 13, color: COLORS.muted, lineHeight: 1.45, marginTop: 6 }}>{p.meaning}</span>
              {pr && <span style={{ display: 'block', marginTop: 12, fontSize: 13, color: COLORS.green }}>Устойчивость {pr.strength}/5 · сессий {pr.sessions}</span>}
            </button>
          })}
        </div>
      </section>)}
    </div></main>
  }

  if (view === 'result') {
    const pr = progress[pattern.id]
    const first = attempts[0], last = attempts[attempts.length - 1]
    return <main style={{ ...pageStyle, background: COLORS.navy, color: 'white' }}><div style={shellStyle}>
      <p style={{ ...kicker, color: '#fbbf24' }}>Серия завершена · {pattern.name}</p>
      <h1 style={{ ...hero, color: 'white' }}>Теперь уже есть материал для вывода.</h1>
      <p style={{ ...lead, color: '#cbd5e1' }}>Ты сделал {attempts.length} отдельных retrieval-попыток на одну конструкцию, а не один короткий тест.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 24 }}>
        <div style={resultCard}><small>Начало</small><strong>{first ? `${first.score}/2` : '—'}</strong></div>
        <div style={resultCard}><small>Последний пример</small><strong>{last ? `${last.score}/2` : '—'}</strong></div>
        <div style={resultCard}><small>Медиана latency</small><strong>{pr?.medianLatencyMs == null ? '—' : `${(pr.medianLatencyMs / 1000).toFixed(1)} с`}</strong></div>
        <div style={resultCard}><small>Устойчивость</small><strong>{pr?.strength ?? 0}/5</strong></div>
      </div>
      <p style={{ color: '#cbd5e1', lineHeight: 1.6, marginTop: 18 }}>Следующий повтор: {pr ? new Date(pr.nextDueAt).toLocaleDateString('ru-RU') : '—'}. Это пока рабочая метрика прототипа, а не «оценка английского».</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
        <button onClick={() => { setAttempts([]); setIndex(0); setView('practice') }} style={{ ...primaryButton, background: COLORS.amber }}>Ещё 10 на эту конструкцию</button>
        <button onClick={() => setView('library')} style={{ ...ghostButton, color: 'white', borderColor: '#64748b' }}>К библиотеке</button>
      </div>
    </div></main>
  }

  const guided = index >= 1 && index <= 3
  const blind = index >= 7
  const phaseLabel = index === 0 ? 'Cold retrieval' : guided ? 'Repair + закрепление' : blind ? 'Blind retrieval' : 'Transfer + вариативность'

  return <main style={pageStyle}><div style={shellStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 20 }}>
      <button onClick={() => setView('library')} style={ghostButton}>← Библиотека</button>
      <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, color: COLORS.navy }}>{pattern.name}</div><div style={{ fontSize: 12, color: COLORS.muted }}>{index + 1}/{SESSION_SIZE}</div></div>
    </div>
    <div style={{ height: 5, background: '#eadfce', borderRadius: 9, overflow: 'hidden', marginBottom: 28 }}><div style={{ width: `${((index + 1) / SESSION_SIZE) * 100}%`, height: '100%', background: COLORS.amber }} /></div>
    <p style={kicker}>{phaseLabel}</p>
    <h1 style={{ ...hero, fontSize: 'clamp(27px,6vw,42px)' }}>{drill.cue}</h1>
    {guided && !attempt && <div style={repairCard}><div style={smallLabel}>Подсказка</div><p style={{ margin: '6px 0 8px' }}>{pattern.repair}</p><div style={formula}>{pattern.form}</div></div>}
    {blind && !attempt && <div style={{ ...notice, background: '#eef4ff' }}>Без формулы. Попробуй вытащить конструкцию из памяти сразу.</div>}

    {!attempt && <section style={{ marginTop: 26 }}>
      <button onClick={recording ? stopVoice : startVoice} style={{ ...primaryButton, minWidth: 220, background: recording ? '#dc2626' : COLORS.navy, color: 'white' }}>{recording ? '■ Остановить' : '🎙 Ответить голосом'}</button>
      {!recording && <button onClick={() => setShowTyped((v) => !v)} style={{ ...ghostButton, marginLeft: 10 }}>{showTyped ? 'Скрыть текст' : 'Или напечатать'}</button>}
      {recording && <p style={{ color: COLORS.green, fontWeight: 700 }}>Слушаю…</p>}
      {showTyped && <div style={{ marginTop: 14 }}><textarea rows={3} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your answer in English…" style={textarea} /><button onClick={submitTyped} disabled={!typed.trim()} style={{ ...primaryButton, marginTop: 9 }}>Проверить</button></div>}
      {error && <p style={{ color: COLORS.red }}>{error}</p>}
    </section>}

    {attempt && <section style={{ marginTop: 28 }}>
      <div style={quoteCard}><div style={smallLabel}>Ты сказал</div><div style={{ marginTop: 6, fontSize: 19 }}>“{attempt.transcript}”</div></div>
      <div style={{ ...card, borderLeft: `5px solid ${attempt.score === 2 ? COLORS.green : attempt.score === 1 ? COLORS.amber : COLORS.red}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{attempt.score === 2 ? 'Целевая конструкция появилась' : attempt.score === 1 ? 'Почти: форма узнаваема' : 'Конструкция не извлеклась'}</strong><strong>{attempt.score}/2</strong></div>
        <p style={{ color: COLORS.muted, margin: '10px 0 0' }}>До начала ответа: {(attempt.latencyMs / 1000).toFixed(1)} с</p>
      </div>
      <div style={answerCard}>
        <div style={smallLabel}>Рекомендуемый вариант</div>
        <p style={{ margin: '8px 0 0', fontSize: 19, fontWeight: 800 }}>“{drill.models[0]}”</p>
        {drill.models.slice(1).map((m, i) => <div key={m} style={{ marginTop: 12 }}><div style={smallLabel}>{i === 0 ? 'Также естественно' : 'Ещё вариант'}</div><p style={{ margin: '6px 0 0', fontSize: 17 }}>“{m}”</p></div>)}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}><span style={smallLabel}>Модель конструкции</span><div style={{ ...formula, marginTop: 6 }}>{pattern.form}</div></div>
      </div>
      <button onClick={nextDrill} style={{ ...primaryButton, marginTop: 18 }}>{index < SESSION_SIZE - 1 ? `Следующий пример · ${index + 2}/${SESSION_SIZE} →` : 'Показать резюме серии →'}</button>
    </section>}
  </div></main>
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: COLORS.pale, color: COLORS.ink, fontFamily: 'system-ui,-apple-system,sans-serif' }
const shellStyle: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '42px 20px 72px' }
const kicker: React.CSSProperties = { margin: 0, textTransform: 'uppercase', letterSpacing: 1.3, color: COLORS.amber, fontSize: 12, fontWeight: 850 }
const hero: React.CSSProperties = { color: COLORS.navy, fontSize: 'clamp(34px,7vw,54px)', lineHeight: 1.08, margin: '10px 0 18px', letterSpacing: '-0.02em' }
const lead: React.CSSProperties = { fontSize: 17, lineHeight: 1.62, margin: '0 0 14px' }
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 10, background: COLORS.amber, color: COLORS.navy, padding: '13px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }
const ghostButton: React.CSSProperties = { border: '1px solid #d6d3d1', borderRadius: 10, background: 'transparent', color: COLORS.muted, padding: '10px 13px', fontWeight: 700, cursor: 'pointer' }
const patternCard: React.CSSProperties = { textAlign: 'left', border: `1px solid ${COLORS.line}`, background: 'white', borderRadius: 14, padding: 16, cursor: 'pointer', fontFamily: 'inherit' }
const chip: React.CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800, color: COLORS.navy }
const smallLabel: React.CSSProperties = { textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted, fontSize: 11, fontWeight: 850 }
const repairCard: React.CSSProperties = { marginTop: 18, background: '#fff7df', border: '1px solid #f5d487', borderRadius: 14, padding: 17, lineHeight: 1.5 }
const notice: React.CSSProperties = { marginTop: 16, border: '1px solid #bfd3ff', borderRadius: 12, padding: '13px 15px', fontSize: 14, lineHeight: 1.5 }
const quoteCard: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 17 }
const card: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 17, marginTop: 12 }
const answerCard: React.CSSProperties = { background: '#fff7df', border: '1px solid #f5d487', borderRadius: 14, padding: 17, marginTop: 12 }
const formula: React.CSSProperties = { fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 800, fontSize: 16 }
const textarea: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d6d3d1', padding: 12, fontSize: 16, fontFamily: 'inherit', resize: 'vertical' }
const resultCard: React.CSSProperties = { background: '#172554', borderRadius: 14, padding: 16, display: 'grid', gap: 8 }
