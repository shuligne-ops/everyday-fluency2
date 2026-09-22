import type { Drill, Pattern, Phase } from '../retrieval-lab-v2/types'

const d = (id: string, phase: Phase, scenario: string, prompt: string, models: string[], meaningGroups: string[][], meaningHint: string): Drill => ({ id, phase, scenario, prompt, models, meaningGroups, meaningHint })

export const FR_PATTERNS: Pattern[] = [
  {
    id: 'obligation', level: 'A2', name: 'Нужно / не обязательно', form: 'il faut / devoir / ne pas avoir besoin de',
    meaning: 'Обязанность и отсутствие необходимости.',
    starterHint: 'Сначала реши: это обязанность или просто необязательно?',
    formHint: 'Для необходимости: il faut / devoir. Для «не обязательно»: ne pas avoir besoin de / ne pas être obligé de.',
    targetFull: /\b(il faut|je dois|tu dois|il doit|elle doit|on doit|nous devons|vous devez|ils doivent|elles doivent|pas besoin de|pas oblige de|pas obligee de|pas obliges de|pas obligees de)\b/i,
    targetPartial: /\b(faut|dois|doit|devons|devez|doivent|besoin|oblige|obligee|obliges|obligees)\b/i,
    drills: [
      d('o1','cold','L’ascenseur est en panne et ton bureau est au douzième étage.','Dis à ton collègue qu’il faut prendre l’escalier.',['Il faut prendre l’escalier.','On doit prendre l’escalier aujourd’hui.'],[['escalier'],['faut','doit','devons']],'Передай, что другого варианта нет: нужно идти по лестнице.'),
      d('o2','runway','Demain, c’est férié et le bureau est fermé.','Dis à ton collègue qu’il n’est pas nécessaire de venir.',["Tu n’as pas besoin de venir demain.","Tu n’es pas obligé de venir demain."],[['demain'],['venir'],['besoin','oblige']],'Это не запрет: приходить просто не нужно.'),
      d('o3','varied','Ton train part à 6 h 10 demain matin.','Explique que tu dois te lever tôt.',['Je dois me lever tôt demain.','Il faut que je me lève tôt demain.'],[['lever'],['tot'],['dois','faut']],'Передай необходимость раннего подъёма.'),
      d('o4','contrast','Au restaurant, la veste est facultative.','Dis à ton ami qu’il n’est pas obligé de porter une veste.',["Tu n’es pas obligé de porter une veste.","Tu n’as pas besoin de mettre une veste."],[['veste'],['porter','mettre'],['besoin','oblige']],'Не перепутай «не обязательно» и «нельзя».'),
      d('o5','transfer','Tu as promis d’envoyer les documents avant midi.','Dis que tu dois les envoyer ce matin.',['Je dois envoyer les documents ce matin.','Il faut que je les envoie avant midi.'],[['envoyer'],['documents'],['matin','midi']],'Передай обязанность по времени.'),
      d('o6','delayed','L’entrée du musée est gratuite et la réservation est facultative.','Dis à ton ami qu’il n’est pas nécessaire de réserver.',["On n’a pas besoin de réserver.","On n’est pas obligés de réserver à l’avance."],[['reserver','reservation'],['besoin','obliges']],'Скажи именно «не обязательно бронировать».'),
    ],
    freePrompt: 'Parle de deux choses que tu dois faire cette semaine et d’une chose que tu n’es pas obligé de faire.'
  },
  {
    id: 'venir_de', level: 'A2', name: 'Только что сделал', form: 'venir de + infinitif',
    meaning: 'Действие произошло совсем недавно.',
    starterHint: 'Событие произошло буквально только что.',
    formHint: 'Используй venir de + infinitif.',
    targetFull: /\b(viens|vient|venons|venez|viennent)\s+(de|d')\s*\w+/i,
    targetPartial: /\b(viens|vient|venons|venez|viennent)\b/i,
    drills: [
      d('v1','cold','Ton collègue demande si le rapport est prêt. Tu l’as fini il y a une minute.','Réponds naturellement.',["Je viens de finir le rapport.","Je viens de le terminer."],[['finir','termine','rapport'],['viens']],'Передай: ты закончил буквально минуту назад.'),
      d('v2','runway','Tu arrives au bureau avec un café. Un ami te propose d’en acheter un.','Dis que tu en as acheté un il y a un instant.',["Je viens d’en acheter un.","Je viens de prendre un café."],[['acheter','prendre'],['cafe','un'],['viens']],'Скажи «я только что купил/взял».'),
      d('v3','varied','Quelqu’un t’appelle au moment où tu sors de la gare.','Dis que le train vient d’arriver.',['Le train vient d’arriver.','Il vient juste d’arriver.'],[['train','il'],['arriver'],['vient']],'Очень недавнее событие.'),
      d('v4','contrast','Ton ami demande si Anna connaît la nouvelle. Tu viens de lui dire.','Réponds naturellement.',["Je viens de lui dire.","Je viens de le dire à Anna."],[['dire','dit'],['anna','lui'],['viens']],'Подчеркни «только что».'),
      d('v5','transfer','Tu es en visio. La batterie de ton ordinateur est maintenant pleine.','Dis que tu viens de le recharger.',["Je viens de le recharger.","Je viens de finir de charger l’ordinateur."],[['charger','recharger'],['ordinateur','le'],['viens']],'Передай свежий результат.'),
      d('v6','delayed','Ton colocataire demande pourquoi ça sent bon dans la cuisine.','Dis que tu viens de préparer le dîner.',["Je viens de préparer le dîner.","Je viens de faire à manger."],[['diner','manger','preparer'],['viens']],'Скажи, что это произошло совсем недавно.'),
    ],
    freePrompt: 'Dis trois choses que tu viens de faire aujourd’hui ou pendant la dernière heure.'
  },
  {
    id: 'en_train_de', level: 'B1', name: 'Прямо сейчас в процессе', form: 'être en train de + infinitif',
    meaning: 'Действие происходит именно сейчас и находится в процессе.',
    starterHint: 'Подчеркни, что действие идёт прямо сейчас.',
    formHint: 'Используй être en train de + infinitif.',
    targetFull: /\b(suis|es|est|sommes|etes|sont)\s+en train de\s+\w+/i,
    targetPartial: /\ben train de\b/i,
    drills: [
      d('e1','cold','Un ami t’appelle pendant que tu cuisines.','Dis ce que tu fais exactement maintenant.',["Je suis en train de cuisiner.","Je suis en train de préparer le dîner."],[['cuisiner','preparer','diner'],['suis','train']],'Подчеркни процесс прямо сейчас.'),
      d('e2','runway','Tu ne peux pas répondre tout de suite parce que tu conduis.','Explique pourquoi.',["Je suis en train de conduire.","Je suis en train de conduire, je te rappelle."],[['conduire'],['suis','train']],'Сейчас действие уже идёт.'),
      d('e3','varied','Tu entres dans une pièce et Paul parle au téléphone.','Explique à quelqu’un ce qu’il fait.',['Paul est en train de téléphoner.','Il est en train de parler au téléphone.'],[['paul','il'],['telephone','telephoner'],['est','train']],'Опиши текущий процесс.'),
      d('e4','contrast','Marie a commencé un rapport et elle travaille dessus maintenant.','Dis ce qu’elle fait.',["Elle est en train d’écrire un rapport.","Marie est en train de travailler sur le rapport."],[['rapport'],['ecrire','travailler'],['est','train']],'Не просто привычка, а текущий процесс.'),
      d('e5','transfer','Tu vois des ouvriers devant la maison. Les travaux sont en cours.','Explique ce qui se passe.',['Ils sont en train de réparer la maison.','Ils sont en train de faire des travaux.'],[['reparer','travaux'],['maison'],['sont','train']],'Передай процесс в данный момент.'),
      d('e6','delayed','Ton frère ne répond pas. Tu sais qu’il passe un examen en ce moment.','Explique pourquoi il ne répond pas.',["Il est en train de passer un examen.","Il est en train de faire son examen."],[['examen'],['passer','faire'],['est','train']],'Скажи, что экзамен идёт сейчас.'),
    ],
    freePrompt: 'Décris trois choses que des gens autour de toi sont en train de faire maintenant.'
  },
  {
    id: 'allais_mais', level: 'B1', name: 'Собирался, но…', form: 'aller à l’imparfait + infinitif, mais…',
    meaning: 'План или намерение в прошлом, которое изменилось или не осуществилось.',
    starterHint: 'Сначала был план, потом что-то его изменило.',
    formHint: 'Используй j’allais / on allait / nous allions + infinitif, mais…',
    targetFull: /\b(allais|allait|allions|alliez|allaient)\b.*\bmais\b/i,
    targetPartial: /\b(allais|allait|allions|alliez|allaient)\b/i,
    drills: [
      d('a1','cold','Tu avais prévu d’appeler Tom hier soir, mais tu t’es endormi.','Explique ce qui s’est passé.',["J’allais appeler Tom, mais je me suis endormi.","J’allais lui téléphoner, mais je me suis endormi."],[['appeler','telephoner'],['tom','lui'],['endormi'],['allais','mais']],'Передай первоначальный план и то, почему он не случился.'),
      d('a2','runway','Tu avais prévu de cuisiner, mais tes amis t’ont invité au restaurant.','Explique le changement de plan.',["J’allais cuisiner, mais mes amis m’ont invité au restaurant.","J’allais préparer le dîner, mais finalement on est sortis."],[['cuisiner','diner'],['amis','restaurant','sortis'],['allais']],'Сначала план, затем изменение.'),
      d('a3','varied','Tu avais prévu de prendre le train, mais il a été annulé.','Explique ton plan initial.',["J’allais prendre le train, mais il a été annulé.","J’allais partir en train, mais il a été supprimé."],[['train'],['annule','supprime'],['allais','mais']],'Покажи несостоявшееся намерение.'),
      d('a4','contrast','Tu étais sur le point d’envoyer un mail énervé, puis tu as décidé d’attendre.','Explique ce que tu comptais faire.',["J’allais envoyer le mail, mais j’ai décidé d’attendre.","J’allais répondre, mais j’ai préféré attendre."],[['mail','repondre'],['attendre'],['allais','mais']],'Не «я сделал», а «я собирался сделать».'),
      d('a5','transfer','Tu avais prévu d’acheter un nouveau téléphone, mais tu as réparé l’ancien.','Explique ce qui a changé.',["J’allais acheter un nouveau téléphone, mais j’ai réparé l’ancien.","J’allais changer de téléphone, mais j’ai fait réparer l’ancien."],[['telephone'],['acheter','changer'],['repare'],['allais']],'Передай отменённый план.'),
      d('a6','delayed','Tu avais prévu de partir tôt, mais la réunion a fini tard.','Explique pourquoi tu es resté.',["J’allais partir tôt, mais la réunion a fini tard.","J’allais partir plus tôt, mais la réunion s’est terminée tard."],[['partir'],['tot'],['reunion','tard'],['allais','mais']],'Скажи про план, который не реализовался.'),
    ],
    freePrompt: 'Raconte deux projets récents que tu avais, mais qui ont changé au dernier moment.'
  },
  {
    id: 'aurais_du', level: 'B1', name: 'Надо было сделать', form: 'j’aurais dû + infinitif',
    meaning: 'Оценка прошлого: правильнее было поступить иначе.',
    starterHint: 'Ты оцениваешь прошлое задним числом.',
    formHint: 'Для «надо было»: conditionnel passé de devoir — j’aurais dû + infinitif.',
    targetFull: /\b(aurais|aurait|aurions|auriez|auraient)\b.*\bdu\b\s+\w+/i,
    targetPartial: /\b(aurais|aurait|aurions|auriez|auraient)\b.*\bdu\b/i,
    drills: [
      d('d1','cold','Ton téléphone s’est éteint pendant le voyage parce que tu ne l’avais pas chargé.','Dis ce que tu aurais mieux fait de faire.',["J’aurais dû charger mon téléphone hier.","J’aurais dû le recharger avant de partir."],[['charger','recharger'],['telephone'],['aurais','du']],'Оцени прошлое: что следовало сделать?'),
      d('d2','runway','Vous avez raté le train parce que vous êtes partis trop tard.','Dis ce que vous auriez dû faire.',["On aurait dû partir plus tôt.","Nous aurions dû partir plus tôt."],[['partir'],['tot'],['aurait','aurions','du']],'Передай совет задним числом.'),
      d('d3','varied','Tu as acheté un billet très cher au dernier moment.','Dis ce que tu aurais dû faire.',["J’aurais dû acheter le billet plus tôt.","J’aurais dû réserver plus tôt."],[['acheter','reserver'],['billet'],['aurais','du']],'Что было бы разумнее сделать раньше?'),
      d('d4','contrast','Tu as dit quelque chose de blessant à un ami.','Regrette cette décision.',["Je n’aurais pas dû dire ça.","Je n’aurais pas dû lui parler comme ça."],[['dire','parler'],['pas'],['aurais','du']],'Здесь нужно «не надо было».'),
      d('d5','transfer','Vous êtes trempés parce que personne n’a regardé la météo.','Dis ce que vous auriez dû faire.',["On aurait dû regarder la météo.","Nous aurions dû vérifier la météo avant de partir."],[['meteo'],['regarder','verifier'],['aurait','aurions','du']],'Оцени прошлое решение.'),
      d('d6','delayed','Tu as perdu tes modifications parce que tu n’avais pas fait de copie.','Dis ce que tu aurais dû faire.',["J’aurais dû faire une sauvegarde.","J’aurais dû enregistrer une copie."],[['sauvegarde','copie'],['faire','enregistrer'],['aurais','du']],'Скажи, что стоило сделать заранее.'),
    ],
    freePrompt: 'Parle de deux petites choses cette semaine que tu aurais dû faire autrement.'
  },
  {
    id: 'si_pqp_cond', level: 'B2', name: 'Прошлое → результат сейчас', form: 'si + plus-que-parfait, conditionnel présent',
    meaning: 'Нереальная причина в прошлом и её результат сейчас.',
    starterHint: 'Причина относится к прошлому, результат — к настоящему.',
    formHint: 'После si: plus-que-parfait. В результате сейчас: conditionnel présent.',
    targetFull: /\bsi\b.*\b(avais|avait|avions|aviez|avaient|etais|etait|etions|etiez|etaient)\b.*\b\w+(rais|rait|rions|riez|raient)\b/i,
    targetPartial: /\bsi\b.*\b(avais|avait|avions|aviez|avaient|etais|etait|etions|etiez|etaient)\b/i,
    drills: [
      d('s1','cold','Tu t’es couché à deux heures du matin et maintenant tu es épuisé.','Explique le lien entre ta décision d’hier et ton état actuel.',["Si je m’étais couché plus tôt, je ne serais pas aussi fatigué maintenant.","Si j’avais dormi davantage, je me sentirais mieux maintenant."],[['couche','dormi'],['tot','davantage'],['fatigue','mieux'],['si']],'Причина была в прошлом, результат виден сейчас.'),
      d('s2','runway','Elle n’a jamais appris le français. Aujourd’hui, elle ne peut pas parler avec le client.','Explique la conséquence actuelle.',["Si elle avait appris le français, elle pourrait parler avec le client maintenant.","Si elle avait étudié le français, elle pourrait lui parler aujourd’hui."],[['francais'],['client','lui'],['pourrait'],['si']],'Прошлая причина → нынешняя возможность.'),
      d('s3','varied','Tu as refusé un emploi l’an dernier. Aujourd’hui, tu travailles toujours ici.','Imagine la situation contraire.',["Si j’avais accepté cet emploi, je ne travaillerais pas ici aujourd’hui.","Si j’avais pris ce poste, je serais ailleurs maintenant."],[['emploi','poste'],['ici','ailleurs'],['si']],'Свяжи прошлое решение с настоящим.'),
      d('s4','contrast','Vous n’avez pas acheté une nouvelle voiture. Maintenant, vous réparez l’ancienne chaque semaine.','Explique ce que serait la situation aujourd’hui avec une autre décision.',["Si on avait acheté une nouvelle voiture, on ne réparerait pas celle-ci chaque semaine.","Si nous avions changé de voiture, nous n’aurions pas ce problème aujourd’hui."],[['voiture'],['reparer','probleme'],['si']],'Не условие о будущем: причина уже в прошлом.'),
      d('s5','transfer','Il n’a pas économisé. Aujourd’hui, il doit emprunter de l’argent.','Imagine le résultat actuel s’il avait économisé.',["S’il avait économisé, il n’aurait pas besoin d’emprunter maintenant.","S’il avait mis de l’argent de côté, il pourrait payer aujourd’hui."],[['economise','argent'],['emprunter','payer'],['si']],'Прошлая финансовая причина → результат сейчас.'),
      d('s6','delayed','Tu as dépensé toutes tes économies. Maintenant, tu ne peux pas partir en voyage.','Exprime la situation contraire.',["Si je n’avais pas tout dépensé, je pourrais partir en voyage maintenant.","Si j’avais gardé mes économies, j’aurais de quoi voyager aujourd’hui."],[['depense','economies'],['voyage','voyager'],['pourrais','aurais'],['si']],'Проверь, всплывает ли схема без подсказки.'),
    ],
    freePrompt: 'Parle pendant 20–30 secondes d’une décision passée qui aurait pu changer ta situation actuelle.'
  },
]
