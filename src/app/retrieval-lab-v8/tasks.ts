import type { CueType, Phase } from '../retrieval-lab-v7/domain'

export type Target={id:string;name:string;topic:string;form:string;meaning:string;level:string;promise:string;repair:string}
export type Task={id:string;targetId:string;phase:Phase;cueType:CueType;title:string;context:string;intent:string;dialogue?:string;model:string}
type Row=[string,string,string,string,string?]
const phases:Phase[]=['hidden','visible','visible','compact','minimal','varied','varied','hidden','hidden']
export const targets:Target[]=[
{id:'used_to',name:'Как было раньше',topic:'Past habits & states · used to',form:'used to + verb',meaning:'Привычка или состояние в прошлом, которых больше нет.',level:'A2–B1',promise:'Быстро рассказывать, что раньше было иначе.',repair:'После used to нужен глагол в начальной форме: used to live, used to work.'},
{id:'present_perfect_experience',name:'Что уже случилось',topic:'Present Perfect · experience & result',form:'have / has + V3',meaning:'Опыт, результат или действие, важное сейчас.',level:'B1',promise:'Связывать прошлое с настоящим без долгого выбора времени.',repair:'Сначала подлежащее, затем have/has и третья форма глагола.'},
{id:'present_perfect_continuous',name:'Что длится до сих пор',topic:'Present Perfect Continuous · duration',form:'have / has been + -ing',meaning:'Действие началось раньше и продолжается сейчас или только что закончилось.',level:'B1–B2',promise:'Естественно говорить о длительности и текущем результате.',repair:'Нужна цепочка have/has been + глагол с -ing.'},
{id:'should_have',name:'Что стоило сделать',topic:'Past modal · should have',form:'should have + V3',meaning:'Оценка прошлого решения: лучше было поступить иначе.',level:'B1',promise:'Быстро формулировать совет и сожаление о прошлом.',repair:'После should have нужна третья форма: should have checked, should have gone.'},
{id:'wish_past',name:'О чём жалеешь',topic:'Past regret · wish + had + V3',form:'wish + had + V3',meaning:'Желание изменить то, что уже произошло.',level:'B1–B2',promise:'Выражать сильное сожаление без перевода в голове.',repair:'После wish нужен Past Perfect: I wish I had gone / had not said.'},
{id:'mixed_conditional',name:'Если бы тогда — сейчас было бы иначе',topic:'Mixed Conditionals · past cause → present result',form:'If + had + V3 → would + verb',meaning:'Воображаемое изменение прошлого и его результат сейчас.',level:'B2',promise:'Связывать прошлую причину с нынешним результатом.',repair:'В if-части — had + V3; результат относится к настоящему: would/could + verb.'},
]
export const library=targets
export const targetById=Object.fromEntries(targets.map(t=>[t.id,t])) as Record<string,Target>

const rows:Record<string,Row[]>={
used_to:[
['Дом у моря','Ты показываешь другу дом у моря, где жил в детстве. Сейчас живёшь в городе.','Скажи, что раньше жил здесь.','I used to live here.'],
['Дорога на работу','Раньше ты ездил на работу на велосипеде. Теперь ездишь на автобусе.','Скажи, как раньше добирался на работу.','I used to cycle to work.'],
['Ночная работа','Раньше ты регулярно работал ночью. Сейчас работаешь днём.','Ответь за B: скажи, что раньше работал по ночам.','No, I used to work nights.','A: Have you always worked during the day?\nB: …'],
['Школьные годы','В школе твой брат носил очки. Сейчас они ему не нужны.','Скажи, что раньше он носил очки.','He used to wear glasses.'],
['Пятницы','Несколько лет назад вы встречались с друзьями каждую пятницу. Теперь нет.','Скажи, что раньше вы встречались каждую пятницу.','We used to meet every Friday.'],
['Старая фотография','На старой фотографии у сестры длинные волосы. Сейчас короткая стрижка.','Скажи, что раньше у неё были длинные волосы.','She used to have long hair.'],
['Вечера дома','Раньше вы смотрели телевизор каждый вечер. Теперь обычно читаете.','Ответь за B: скажи, что раньше смотрели телевизор каждый вечер.','We used to watch TV every evening.','A: Do you still watch TV every evening?\nB: …'],
['До переезда','Раньше ты жил один. Теперь живёшь с другом.','Скажи, что раньше жил один.','I used to live alone.'],
['Старое кафе','Вы проходите мимо кафе, куда раньше часто ходили, но давно перестали.','Ответь за B: скажи, что раньше часто здесь ели.','We used to eat here a lot.','A: Do you still come here?\nB: …'],
],
present_perfect_experience:[
['Бизнес-класс','Ты много летал, но всегда экономом. Сегодня впервые летишь бизнес-классом.','Скажи, что никогда раньше не летал бизнес-классом.',"I've never flown business class."],
['Отчёт Майи','Майя всё ещё работает над отчётом. Он пока не готов.','Ответь за B: скажи, что Майя ещё не закончила отчёт.',"She hasn't finished it yet.",'A: Is Maya ready to send her report?\nB: …'],
['Потерянный ключ','Ты стоишь у двери и понимаешь, что потерял ключ от дома.','Скажи другу, что потерял ключ.',"I've lost my house key."],
['Заявка','Срок подачи заявки скоро заканчивается. Ты хочешь узнать, закончил ли друг.','Ответь за B: спроси, закончил ли он заявку.','Have you finished it yet?','A: The application closes soon.\nB: …'],
['Знакомство с Алексом','Тебя знакомят с Алексом, но вы уже несколько раз встречались.','Скажи, что вы уже несколько раз встречались.',"We've met several times before."],
['Спектакль','Тебе предлагают спектакль, который ты уже видел два раза.','Ответь за B: скажи, что уже видел его дважды.',"I've already seen it twice.",'A: Would you like to see this play?\nB: …'],
['Исландия','Вы говорите о путешествиях. Хочешь узнать об опыте собеседника.','Спроси, был ли он когда-нибудь в Исландии.','Have you ever been to Iceland?'],
['Суши','Друг предлагает суши. Ты никогда их не пробовал.','Ответь за B: скажи, что никогда не пробовал суши.',"I've never tried sushi.",'A: What about trying sushi?\nB: …'],
['Готовый отчёт','Ты только что закончил важный отчёт и можешь отправить его.','Скажи, что уже закончил отчёт.',"I've finished the report."],
],
present_perfect_continuous:[
['Французский','Начал учить французский шесть месяцев назад и всё ещё занимаешься.','Ответь за B: скажи, что учишь его уже шесть месяцев.',"I've been learning French for six months.",'A: When did you start learning French?\nB: …'],
['Обсуждение','Команда начала обсуждать проблему утром и всё ещё обсуждает.','Скажи, что обсуждаете её всё утро.',"We've been discussing this all morning."],
['Краска на руках','У тебя руки в краске: всё утро красил кухню.','Ответь за B: скажи, что всё утро красил кухню.',"I've been painting the kitchen all morning.",'A: Why are your hands covered in paint?\nB: …'],
['Автобус','Пришёл на остановку двадцать минут назад. Автобуса всё нет.','Скажи, что ждёшь автобус уже двадцать минут.',"I've been waiting for the bus for twenty minutes."],
['Принтер','Ты уже час пытаешься починить принтер и ещё не закончил.','Ответь за B: скажи, что пытаешься починить его уже час.',"I've been trying to fix it for an hour.",'A: Is the printer fixed?\nB: …'],
['Пианино','Майя начала играть в полдень и всё ещё играет.','Скажи, что Майя играет с полудня.','Maya has been practising the piano since noon.'],
['После пробежки','Ты бегал последний час и только что остановился.','Ответь за B: скажи, что бегал уже час.',"I've been running for an hour.",'A: Why are you so tired?\nB: …'],
['Крыша','Вы начали ремонтировать крышу три дня назад и ещё не закончили.','Скажи, что ремонтируете её уже три дня.',"We've been repairing the roof for three days."],
['Из дома','Последние несколько недель ты почти каждый день работаешь из дома.','Ответь за B: скажи, что работаешь из дома уже несколько недель.',"I've been working from home for the last few weeks.",'A: You are hardly ever in the office now.\nB: …'],
],
should_have:[
['Без зонта','Ты не взял зонт и промок.','Скажи, что тебе стоило взять зонт.','I should have taken an umbrella.'],
['Сообщение','Друг неделю игнорировал сообщение, и теперь человек на него обижен.','Ответь за B: скажи, что ему стоило ответить сразу.','You should have replied straight away.','A: I ignored her message for a week. Now she is upset.\nB: …'],
['Закрытая дорога','Майя знала, что дорога закрыта, но не сказала группе.','Скажи, что ей стоило вас предупредить.','She should have warned us.'],
['Прогноз','Вы промокли под дождём и понимаете, что не посмотрели прогноз.','Ответь за B: скажи, что стоило проверить прогноз.','We should have checked the forecast.','A: We got soaked. We never checked the forecast.\nB: …'],
['Секрет','Друг рассказал Тому личную информацию и теперь жалеет.','Скажи, что ему не стоило рассказывать это Тому.',"You shouldn't have told Tom that."],
['Холодный суп','Друг оставил суп на столе на час, и теперь он холодный.','Ответь за B: скажи, что ему стоило съесть его раньше.','You should have eaten it sooner.','A: My soup is cold.\nB: …'],
['Окна','Перед бурей ты оставил окна открытыми, и дождь попал в комнату.','Скажи, что стоило закрыть окна.','I should have closed the windows.'],
['Неверный адрес','Друг отправил письмо, не проверив адрес, и оно ушло не туда.','Ответь за B: скажи, что ему стоило проверить адрес.','You should have checked the address.','A: I sent the email to the wrong person.\nB: …'],
['Телефон','Перед поездкой забыл зарядить телефон, и он выключился в дороге.','Скажи, что стоило зарядить телефон заранее.','I should have charged my phone before the trip.'],
],
wish_past:[
['Упущенная работа','Ты отказался от интересной работы и теперь сильно жалеешь.','Скажи, что жалеешь, что не принял эту работу.','I wish I had accepted that job.'],
['Зонт','Ты вышел без зонта и промок.','Ответь за B: вырази сожаление, что не взял зонт.','I wish I had brought my umbrella.','A: You are soaked!\nB: …'],
['Велосипед','В прошлом году продал любимый велосипед и теперь жалеешь.','Скажи, что жалеешь о продаже велосипеда.',"I wish I hadn't sold my bike."],
['Камера','На свадьбе не сделал фото, потому что забыл камеру.','Ответь за B: вырази сожаление, что не взял камеру.','I wish I had brought my camera.','A: Did you get any photos of the wedding?\nB: …'],
['Машина','Поспешил купить дорогую машину и теперь жалеешь.','Скажи, что жалеешь о покупке машины.',"I wish I hadn't bought that car."],
['Концерт','Вчера был концерт любимой группы, но ты не пошёл.','Ответь за B: скажи, что жалеешь, что не пошёл.','I wish I had gone to the concert.','A: Did you enjoy the concert?\nB: …'],
['Фотография','Удалил важную фотографию и хотел бы её вернуть.','Скажи, что жалеешь, что удалил её.',"I wish I hadn't deleted that photo."],
['Совет','Друг дал хороший совет, но ты не послушал. Теперь жалеешь.','Ответь за B: скажи, что жалеешь, что не послушал его.','I wish I had listened to you.','A: I told you that might happen.\nB: …'],
['Английский','Думаешь, что сейчас говорил бы увереннее, если бы начал раньше.','Скажи, что жалеешь, что не начал учить английский раньше.','I wish I had started learning English earlier.'],
],
mixed_conditional:[
['Пропущенный поезд','Ты опоздал на поезд и всё ещё на вокзале. Если бы успел, сейчас уже был бы дома.','Скажи, что сейчас был бы дома, если бы не пропустил поезд.',"If I hadn't missed the train, I would be home now."],
['Ноутбук','Вчера уронил ноутбук, и сейчас он не работает.','Ответь за B: скажи, что сейчас он работал бы, если бы ты его не уронил.',"If I hadn't dropped it yesterday, it would be working now.",'A: Why is your laptop broken now?\nB: …'],
['Рим','В прошлом году отказался от работы в Риме и сейчас живёшь в другом месте.','Скажи, что сейчас жил бы в Риме, если бы тогда принял работу.',"If I'd accepted that job, I'd be living in Rome now."],
['Телефон','Не зарядил телефон вечером, и сейчас он разряжен.','Ответь за B: скажи, что сейчас он работал бы, если бы ты зарядил его вчера.',"If I'd charged it last night, it would be working now.",'A: Why is your phone dead now?\nB: …'],
['Вождение','Не сдал экзамен в прошлом году и сейчас не можешь ездить один.','Скажи, что сейчас мог бы ездить один, если бы тогда сдал экзамен.','If I had passed my driving test, I could drive alone now.'],
['Мало сна','Вчера лёг очень поздно и сейчас сильно устал.','Ответь за B: скажи, что сейчас не был бы таким уставшим, если бы лёг раньше.',"If I had gone to bed earlier, I wouldn't be so tired now.",'A: You look exhausted.\nB: …'],
['Медицина','Ты не учился на врача. Если бы выбрал медицину, сейчас был бы врачом.','Скажи, что сейчас был бы врачом, если бы тогда изучал медицину.','If I had studied medicine, I would be a doctor now.'],
['Ключи','Забыл ключи дома и сейчас стоишь снаружи.','Ответь за B: скажи, что сейчас был бы внутри, если бы не забыл ключи.',"If I hadn't forgotten my keys, I would be inside now.",'A: Why are you waiting outside?\nB: …'],
['Лондон','Несколько лет назад не переехал в Лондон. Если бы переехал, сейчас жил бы там.','Скажи, что сейчас жил бы в Лондоне, если бы тогда переехал.',"If I had moved to London, I'd be living there now."],
],
}

const reviews:Record<string,Row[]>={
used_to:[['Теннис','Раньше играл в теннис по воскресеньям, но перестал.','Скажи, что раньше играл по воскресеньям.','I used to play tennis on Sundays.'],['Балкон','В старой квартире был балкон, в нынешней нет.','Скажи, что в старой квартире раньше был балкон.','My old flat used to have a balcony.'],['Газета','Раньше покупал газету каждый день, теперь нет.','Скажи об этой старой привычке.','I used to buy a newspaper every day.'],['Пекарня','Здание сейчас библиотека, а раньше было пекарней.','Скажи, чем оно было раньше.','It used to be a bakery.']],
present_perfect_experience:[['Ресторан','Друг предлагает место, где ты никогда не был.','Скажи, что никогда здесь не был.',"I've never been here before."],['Книга','Ты только что дочитал книгу.','Скажи, что уже закончил её.',"I've finished the book."],['Париж','Хочешь узнать опыт собеседника.','Спроси, бывал ли он когда-нибудь в Париже.','Have you ever been to Paris?'],['Телефон','Ты наконец нашёл потерянный телефон.','Скажи, что нашёл его.',"I've found my phone."]],
present_perfect_continuous:[['Сад','Работаешь в саду с самого утра.','Скажи, что работал в саду всё утро.',"I've been working in the garden all morning."],['Дождь','Дождь начался три часа назад и всё ещё идёт.','Скажи, как долго идёт дождь.',"It's been raining for three hours."],['Квартира','Ищете квартиру уже несколько недель.','Скажи, как долго ищете. ',"We've been looking for a flat for several weeks."],['Телефон','Майя разговаривает по телефону почти час.','Скажи, как долго она разговаривает.','Maya has been talking on the phone for almost an hour.']],
should_have:[['Билеты','Друг купил билеты слишком поздно и переплатил.','Скажи, что ему стоило купить их раньше.','You should have bought them earlier.'],['Куртки','На улице оказалось очень холодно.','Скажи, что вам стоило взять тёплые куртки.','We should have brought warm jackets.'],['Навигатор','Друг не слушал навигатор и заблудился.','Скажи, что ему стоило слушать указания.','You should have listened to the directions.'],['Встреча','Ты забыл предупредить коллегу об отмене встречи.','Скажи, что стоило предупредить его.','I should have warned him.']],
wish_past:[['Отпуск','Отпуск был слишком коротким.','Скажи, что жалеешь, что не остался дольше.','I wish I had stayed longer.'],['Квитанция','Выбросил важную квитанцию.','Скажи, что жалеешь, что выбросил её.',"I wish I hadn't thrown away the receipt."],['Адрес','Не записал адрес и теперь не помнишь его.','Скажи, что жалеешь, что не записал адрес.','I wish I had written down her address.'],['Вечеринка','Уехал слишком рано и пропустил самое интересное.','Скажи, что жалеешь, что уехал рано.',"I wish I hadn't left so early."]],
mixed_conditional:[['Итальянский','Не учил итальянский в школе и сейчас не говоришь на нём.','Скажи, что сейчас мог бы говорить, если бы учил его тогда.','If I had studied Italian at school, I could speak it now.'],['Рейс','Вчера пропустил рейс и сегодня дома, а не в Париже.','Скажи, что сейчас был бы в Париже, если бы успел.','If I had caught my flight, I would be in Paris now.'],['Сад','Вчера сад не полили, и сегодня он сухой.','Скажи, что сейчас он не был бы сухим, если бы вы полили его вчера.',"If we had watered it yesterday, it wouldn't be dry now."],['Дом','Не купил дом у моря и сейчас живёшь в другом месте.','Скажи, что сейчас жил бы у моря, если бы тогда купил дом.','If I had bought that house, I would be living by the sea now.']],
}

function make(row:Row,id:string,targetId:string,phase:Phase):Task{const [title,context,intent,model,dialogue]=row;return{id,targetId,phase,cueType:dialogue?'dialogue':'situation',title,context,intent,model,...(dialogue?{dialogue}:{})}}
export function sessionTasks(targetId:string):Task[]{return(rows[targetId]||[]).slice(0,9).map((r,i)=>make(r,`${targetId}:s:${i}`,targetId,phases[i]))}
export function reviewTask(targetId:string,round:number):Task|undefined{const list=reviews[targetId];const r=list?.[round%4];return r?make(r,`${targetId}:r:${round%4}`,targetId,'review'):undefined}
export function findTask(id:string):Task|undefined{const [targetId,mode,index]=id.split(':');const i=Number(index);if(mode==='s'&&Number.isInteger(i))return sessionTasks(targetId)[i];if(mode==='r'&&Number.isInteger(i))return reviewTask(targetId,i)}
