import type { Drill, Pattern, Phase } from './types'

const d = (id: string, phase: Phase, scenario: string, prompt: string, models: string[], meaningGroups: string[][], meaningHint: string): Drill => ({ id, phase, scenario, prompt, models, meaningGroups, meaningHint })

export const V2_PATTERNS: Pattern[] = [
  {
    id: 'have_to', level: 'A2', name: 'Нужно / не обязательно', form: 'have to / don’t have to + verb',
    meaning: 'Обязанность и отсутствие необходимости — не запрет.',
    starterHint: 'Подумай: это обязанность или просто необязательно?',
    formHint: 'Для обязанности: have to. Для «не обязательно»: don’t have to.',
    targetFull: /\b(have|has|had) to\b|\b(don't|doesn't|didn't|do not|does not|did not) have to\b/i,
    targetPartial: /\bhave to\b|\bhas to\b|\bhad to\b/i,
    drills: [
      d('h1','cold','Your office is on the 12th floor. The lift is broken today.','Tell a colleague that using the stairs is necessary.',['We have to take the stairs today.','We’ll have to use the stairs today.'],[['stairs'],['have','need','must']],'Скажи, что другого варианта нет и нужно идти по лестнице.'),
      d('h2','runway','Tomorrow is a public holiday. The office is closed.','Tell a colleague that coming in is not necessary.',["You don't have to come in tomorrow.","You don't need to come in tomorrow."],[['tomorrow'],['come','office','work']],'Важно: это не запрет. Просто приходить не требуется.'),
      d('h3','varied','Your train leaves at 6:10 a.m.','Tell your friend that waking up early is necessary.',['I have to get up early tomorrow.','I need to get up early tomorrow.'],[['early'],['get up','wake']],'Передай необходимость раннего подъёма.'),
      d('h4','contrast','The restaurant says jackets are optional.','Tell your friend that wearing a jacket is not necessary.',["You don't have to wear a jacket.","You don't need to wear a jacket."],[['jacket'],['wear']],'Не перепутай «не обязательно» с «нельзя».'),
      d('h5','transfer','You promised to send the documents before lunch.','Tell someone that sending them this morning is necessary.',['I have to send the documents this morning.','I need to send the documents before lunch.'],[['send'],['documents','files'],['morning','lunch']],'Передай обязательство по времени.'),
      d('h6','delayed','The museum entry is free today. Booking online is optional.','Tell a friend that booking is not necessary.',["We don't have to book in advance.","We don't need to book online."],[['book','booking'],['online','advance']],'Скажи именно «не обязательно бронировать».'),
    ],
    freePrompt: 'Tell me about two things you have to do this week and one thing you don’t have to do.'
  },
  {
    id: 'ive_just', level: 'A2', name: 'Только что сделал', form: 'have/has just + V3',
    meaning: 'Очень недавнее завершённое действие с результатом сейчас.',
    starterHint: 'Событие произошло буквально только что.',
    formHint: 'Используй have/has + just + V3.',
    targetFull: /\b(have|has|'ve|'s)\s+just\s+\w+(ed|en|ne|nt|t|d)?\b/i,
    targetPartial: /\bjust\b/i,
    drills: [
      d('j1','cold','Your colleague asks if the report is ready. You finished it one minute ago.','Answer naturally.',["I've just finished the report.","I've just finished it."],[['finish','finished','done'],['report','it']],'Смысл: работа завершилась буквально минуту назад.'),
      d('j2','runway','You walk into the office carrying coffee. A friend asks, “Want a coffee?”','Tell them you bought one a moment ago.',["I've just bought one.","I've just got a coffee."],[['coffee','one'],['bought','got']],'Передай «я только что купил».'),
      d('j3','varied','Someone calls while you are leaving the station.','Say that the train arrived a moment ago.',['The train has just arrived.','It’s just arrived.'],[['train','it'],['arrived','come']],'Событие очень недавнее и важно сейчас.'),
      d('j4','contrast','Your friend asks whether Anna knows the news. You told her seconds ago.','Answer naturally.',["I've just told her.","I’ve just told Anna."],[['told','said'],['her','anna']],'Не просто Past Simple: подчеркни «только что».'),
      d('j5','transfer','You are on a video call. Your laptop battery is now full.','Say that you finished charging it moments ago.',["I've just charged it.","I've just finished charging the laptop."],[['charged','charging'],['laptop','it']],'Передай свежий результат.'),
      d('j6','delayed','Your flatmate asks why the kitchen smells nice.','Say that you made dinner a moment ago.',["I've just made dinner.","I've just cooked dinner."],[['dinner'],['made','cooked']],'Скажи, что это произошло совсем недавно.'),
    ],
    freePrompt: 'Tell me three things you have just done today or in the last hour.'
  },
  {
    id: 'used_to', level: 'B1', name: 'Раньше было, теперь нет', form: 'used to + verb',
    meaning: 'Прошлая привычка или состояние, которое изменилось.',
    starterHint: 'Сравни прошлую привычку с настоящим.',
    formHint: 'Для регулярного прошлого, которого больше нет: used to + verb.',
    targetFull: /\bused to\s+\w+\b/i,
    targetPartial: /\bused to\b/i,
    drills: [
      d('u1','cold','You quit smoking five years ago. A new friend thinks you have never smoked.','Correct them naturally.',['I used to smoke.','I used to smoke, but I quit years ago.'],[['smoke','smoked'],['used','quit','years']],'Важно передать: раньше это было регулярно, сейчас уже нет.'),
      d('u2','runway','You live in the city now, but as a child you lived near the sea.','Tell a friend about that past situation.',['I used to live by the sea.','I used to live near the coast.'],[['live','lived'],['sea','coast']],'Это прошлое состояние, которое изменилось.'),
      d('u3','varied','These days you drive to work. Years ago you went by bike every day.','Describe the old routine.',['I used to cycle to work.','I used to ride my bike to work.'],[['bike','cycle'],['work']],'Подчеркни старую привычку.'),
      d('u4','contrast','There is a supermarket here now. Ten years ago this building was a cinema.','Explain the change.',['There used to be a cinema here.','This used to be a cinema.'],[['cinema','movie'],['here','building']],'Нужно прошлое состояние места, которого больше нет.'),
      d('u5','transfer','You sleep well now. In your twenties you often worked at night.','Describe the old habit.',['I used to work nights.','I used to work at night a lot.'],[['work'],['night','nights']],'Передай прежнюю регулярную привычку.'),
      d('u6','delayed','Your friend asks if you have always worn contact lenses. You wore glasses before.','Answer naturally.',['I used to wear glasses.','I used to wear glasses before I got contacts.'],[['glasses'],['wear','wore']],'Сравни прошлое с нынешним.'),
    ],
    freePrompt: 'Talk for 20–30 seconds about two things you used to do and one thing that is different now.'
  },
  {
    id: 'was_going_to', level: 'B1', name: 'Собирался, но…', form: 'was/were going to + verb, but…',
    meaning: 'План или намерение в прошлом, которое изменилось или не осуществилось.',
    starterHint: 'Сначала был план, потом что-то его изменило.',
    formHint: 'Используй was/were going to + verb, but…',
    targetFull: /\b(was|were)\s+going to\s+\w+\b/i,
    targetPartial: /\bgoing to\b/i,
    drills: [
      d('g1','cold','You planned to call Tom last night, but you fell asleep.','Explain what happened.',['I was going to call Tom, but I fell asleep.','I was going to phone him, but I fell asleep.'],[['call','phone'],['tom','him'],['sleep','asleep']],'Передай первоначальный план и то, почему он не случился.'),
      d('g2','runway','You planned to cook, but your friends invited you out.','Explain the change of plan.',['I was going to cook, but my friends invited me out.','I was going to make dinner, but we went out instead.'],[['cook','dinner'],['friends','out']],'Сначала план, затем изменение.'),
      d('g3','varied','You planned to take the train, but it was cancelled.','Tell someone what your original plan was.',['I was going to take the train, but it was cancelled.','I was going to go by train, but it got cancelled.'],[['train'],['cancelled','canceled']],'Покажи несостоявшееся намерение.'),
      d('g4','contrast','You nearly sent an angry email, but decided to wait.','Explain the plan you changed.',['I was going to send the email, but I decided to wait.','I was going to reply, but I thought better of it.'],[['email','reply'],['wait','decided']],'Не «я сделал», а «я собирался сделать».'),
      d('g5','transfer','You planned to buy a new phone, but repaired the old one.','Explain what changed.',['I was going to buy a new phone, but I fixed the old one.','I was going to replace my phone, but I had it repaired.'],[['phone'],['buy','replace'],['repair','fixed']],'Передай отменённый план.'),
      d('g6','delayed','You planned to leave early, but the meeting finished late.','Explain why you stayed.',['I was going to leave early, but the meeting ran late.','I was going to go early, but the meeting finished late.'],[['leave','go'],['early'],['meeting','late']],'Скажи про план, который не реализовался.'),
    ],
    freePrompt: 'Tell me about two plans you had recently that changed at the last minute.'
  },
  {
    id: 'should_have', level: 'B1', name: 'Надо было сделать', form: 'should have + V3',
    meaning: 'Оценка прошлого действия: правильнее было поступить иначе.',
    starterHint: 'Ты оцениваешь прошлое задним числом.',
    formHint: 'Для «надо было»: should have + V3.',
    targetFull: /\bshould(n't| not)?\s+(have|'ve)\s+\w+/i,
    targetPartial: /\bshould\b|\bshouldn't\b/i,
    drills: [
      d('s1','cold','Your phone died during a trip because you forgot to charge it.','Say what you now think you should have done.',['I should have charged my phone before the trip.','I should’ve charged it before I left.'],[['charge','charged'],['phone','it']],'Оцени прошлое действие, которое было правильнее сделать.'),
      d('s2','runway','You arrived late because you left home too late.','Say what would have been better.',['I should have left earlier.','I should’ve left home earlier.'],[['left','leave'],['earlier','early']],'Что следовало сделать раньше?'),
      d('s3','varied','You bought the cheapest laptop and now regret the decision.','Say what you think you should have done.',['I should have bought the better one.','I should’ve spent a bit more.'],[['bought','spent'],['better','more']],'Оцени прошлое решение.'),
      d('s4','contrast','You told a private story to someone who repeated it.','Say what you now think was a mistake.',["I shouldn't have told him.","I shouldn't have said anything."],[['told','said'],['him','anything']],'Здесь нужен отрицательный вариант: этого делать не стоило.'),
      d('s5','transfer','You got soaked because you ignored the weather forecast.','Say what would have been better.',['I should have checked the forecast.','I should’ve taken an umbrella.'],[['forecast','umbrella','weather'],['checked','taken']],'Вырази правильное действие задним числом.'),
      d('s6','delayed','You lost changes because you never saved a backup.','Say what you should have done.',['I should have saved a backup.','I should’ve made a copy.'],[['backup','copy'],['saved','made']],'Что следовало сделать раньше?'),
    ],
    freePrompt: 'Tell me about one small mistake this week and what you should have done differently.'
  },
  {
    id: 'wish_past', level: 'B2', name: 'Сожаление о прошлом', form: 'wish + had + V3',
    meaning: 'Личное сожаление о завершённом прошлом событии.',
    starterHint: 'Вырази именно личное сожаление о прошлом. Начни с “I wish…”.',
    formHint: 'После wish для прошлого: had + V3.',
    targetFull: /\bwish\b.*\b(had|hadn't|had not|'d)\b.*\w+/i,
    targetPartial: /\bwish\b/i,
    drills: [
      d('w1','cold','You stayed up until 2 a.m., overslept and missed an interview. A friend asks, “Any regrets?”','Answer naturally.',["I wish I'd gone to bed earlier.","I wish I hadn't stayed up so late."],[['bed','sleep','stayed'],['earlier','late']],'Смысл: ты лично сожалеешь о своём прошлом решении.'),
      d('w2','runway','You turned down a good job last year and now regret it.','Express that regret.',["I wish I'd taken that job.","I wish I had accepted the offer."],[['job','offer'],['taken','accepted']],'Вырази сожаление о решении в прошлом.'),
      d('w3','varied','You sold your old car and now miss it.','Express the regret.',["I wish I hadn't sold my old car.","I wish I'd kept my old car."],[['car'],['sold','kept']],'Событие завершено, но сожаление сейчас.'),
      d('w4','contrast','You said something rude in an argument and now regret it.','Express the regret.',["I wish I hadn't said that.","I wish I'd kept quiet."],[['said','quiet'],['wish','regret']],'Нужно именно сожаление о прошлом, не совет самому себе.'),
      d('w5','transfer','You never learned French at school and now need it for work.','Express the regret.',["I wish I'd learned French at school.","I wish I had studied French earlier."],[['french'],['learned','studied'],['school','earlier']],'Личное сожаление о том, чего не сделал раньше.'),
      d('w6','delayed','You walked home in heavy rain because you did not take a taxi.','Express the regret.',["I wish we'd taken a taxi.","I wish I hadn't walked home in the rain."],[['taxi','walked'],['rain','home']],'Скажи, что теперь жалеешь о прошлом выборе.'),
    ],
    freePrompt: 'Talk for 20–30 seconds about one decision from the past you genuinely wish you had handled differently.'
  },
]
