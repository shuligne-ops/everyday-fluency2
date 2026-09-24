import { ALL_PATTERNS } from '../retrieval-lab-v5/contrastSets'
import type { CueType, Phase } from './domain'

// Existing catalog IDs; only these eight have a hand-edited mixed-cue course.
export const curatedIds = ['used_to', 'present_perfect_experience', 'present_perfect_continuous', 'should_have', 'wish_past', 'mixed_conditional', 'would_rather', 'supposed_to']
export const catalog = ALL_PATTERNS
export const library = curatedIds.map(id => catalog.find(p => p.id === id)!)
export type Task = { id: string; targetId: string; phase: Phase; cueType: CueType; cue: string; meaning: string; model: string }
type Cue = [CueType, string, string]
// Indices 2, 4, 6, 7 replace translation cues; other steps reuse existing catalog content.
const varied: Record<string, Cue[]> = {
  used_to: [
    ['dialogue', 'A: Do you still cycle to work?\nB: No, but… Complete your reply about your old habit.', 'No, but I used to cycle to work.'],
    ['situation', 'Your friends met every Friday years ago. That routine has stopped. Describe it.', 'We used to meet every Friday.'],
    ['dialogue', 'A: Have you always worked during the day?\nB: No… Explain that you regularly worked nights in the past.', 'No, I used to work nights.'],
    ['situation', 'Your brother wore glasses as a child. He no longer needs them. Describe the change.', 'He used to wear glasses.'],
  ],
  present_perfect_experience: [
    ['dialogue', 'A: Is Maya ready to send her report?\nB: … Explain that it is still unfinished.', "She hasn't finished it yet."],
    ['situation', 'You have travelled a lot, always in economy. Say that business class is a new experience for you.', "I've never flown business class."],
    ['dialogue', 'A: The application closes soon.\nB: … Ask whether your friend has completed it by now.', 'Have you done it yet?'],
    ['situation', 'Someone introduces you to Alex. You recognise him from several previous meetings. Explain.', "We've met several times."],
  ],
  present_perfect_continuous: [
    ['dialogue', 'A: When did you start learning French?\nB: … Say you started six months ago and are still learning.', "I've been learning French for six months."],
    ['situation', 'Your team started discussing this issue this morning. The discussion is still going. Describe it.', "We've been discussing this all morning."],
    ['dialogue', 'A: Why are your hands covered in paint?\nB: … Explain that painting the kitchen has kept you busy all morning.', "I've been painting the kitchen all morning."],
    ['situation', 'You started waiting for a bus twenty minutes ago. It has not arrived. Describe your wait.', "I've been waiting for the bus for twenty minutes."],
  ],
  should_have: [
    ['dialogue', 'A: I ignored her message for a week. Now she is upset.\nB: … Tell your friend that replying immediately was the better choice.', 'You should have replied straight away.'],
    ['situation', 'Maya knew the road was closed but did not tell your group. Say what she ought to have done.', 'She should have warned us.'],
    ['dialogue', 'A: We got soaked. We never looked at the weather forecast.\nB: … Say what your group ought to have done.', 'We should have checked the forecast.'],
    ['situation', 'Your friend revealed a private fact to Tom. Explain that telling him was a mistake.', "You shouldn't have told him that."],
  ],
  wish_past: [
    ['dialogue', 'A: You are soaked!\nB: … You left your umbrella at home this morning. Express regret about not bringing it.', 'I wish I had brought my umbrella.'],
    ['situation', 'You sold a bike you loved last year. You regret selling it. Say so.', "I wish I hadn't sold my bike."],
    ['dialogue', 'A: Did you get any photos of the wedding?\nB: … You forgot your camera. Express regret.', 'I wish I had brought my camera.'],
    ['situation', 'You rushed into buying an expensive car. You now regret buying it. Express that regret.', "I wish I hadn't bought that car."],
  ],
  mixed_conditional: [
    ['dialogue', 'A: Why is your laptop broken now?\nB: … You dropped it yesterday. Imagine not dropping it and its present condition.', "If I hadn't dropped it yesterday, it would be working now."],
    ['situation', 'You did not accept a job in Rome last year, so you live elsewhere now. Imagine the opposite past decision and its present result.', "If I'd accepted that job, I'd be living in Rome now."],
    ['dialogue', 'A: Why is your phone dead now?\nB: … You forgot to charge it last night. Imagine the opposite and its present result.', "If I'd charged it last night, it would be working now."],
    ['situation', 'You failed your driving test last year, so you cannot drive alone now. Imagine passing the test and its present result.', 'If I had passed my driving test, I could drive alone now.'],
  ],
  would_rather: [
    ['dialogue', 'A: Shall we drive or take the train?\nB: … Your group prefers the train.', "We'd rather take the train."],
    ['situation', 'Maya can work at the office or at home. Her preference is home. Describe it.', "She'd rather work from home."],
    ['dialogue', 'A: Should we leave now or wait?\nB: … Your group prefers waiting.', "We'd rather wait."],
    ['situation', 'Tom can travel with the group, but his preference is travelling alone. Explain.', "He'd rather travel alone."],
  ],
  supposed_to: [
    ['dialogue', 'A: Can I send this file to someone outside the company?\nB: … Explain that sharing it is against your rules.', "We're not supposed to share this file."],
    ['situation', 'Your friend agreed to phone you yesterday but never did. Remind them of the arrangement.', 'You were supposed to call me yesterday.'],
    ['dialogue', 'A: Can we leave the car here?\nB: … The rules do not allow parking here.', "We're not supposed to park here."],
    ['situation', 'The meeting is scheduled to end at five. Tell your colleague the planned finishing time.', 'The meeting is supposed to finish by five.'],
  ],
}
const reviews: Record<string, Cue[]> = {
  used_to: [
    ['dialogue', 'A: Do you still play tennis on Sundays?\nB: … Say it was your regular habit, but you stopped.', 'I used to play tennis on Sundays.'],
    ['situation', 'Your old flat had a balcony. Your current one does not. Describe your old home.', 'My old flat used to have a balcony.'],
    ['ru', 'Раньше я каждый день покупал газету, а теперь нет.', 'I used to buy a newspaper every day.'],
    ['dialogue', 'A: Is that building still a bakery?\nB: … It was a bakery years ago, but it is a library now.', 'It used to be a bakery.'],
  ],
  present_perfect_experience: [
    ['dialogue', 'A: What about trying sushi?\nB: … Explain that you have no experience of eating it.', "I've never tried sushi."],
    ['situation', 'You cannot get into your house because your key is missing. Tell your friend what has happened.', "I've lost my house key."],
    ['ru', 'Ты когда-нибудь ездил в Исландию?', 'Have you ever been to Iceland?'],
    ['dialogue', 'A: Would you like to see this play?\nB: … Tell them you have already seen it twice.', "I've already seen it twice."],
  ],
  present_perfect_continuous: [
    ['dialogue', 'A: Why are you so tired?\nB: … You started running an hour ago and have just stopped.', "I've been running for an hour."],
    ['situation', 'Maya began practising the piano at noon and is still practising. Explain.', 'She has been practising the piano since noon.'],
    ['ru', 'Мы ремонтируем крышу уже три дня и ещё не закончили.', 'We have been repairing the roof for three days.'],
    ['dialogue', 'A: Is the printer fixed?\nB: … You started trying to fix it an hour ago and are still trying.', "I've been trying to fix it for an hour."],
  ],
  should_have: [
    ['dialogue', 'A: My soup is cold. I left it on the table for an hour.\nB: … Say that eating it sooner was the better choice.', 'You should have eaten it sooner.'],
    ['situation', 'You left the windows open before a storm. Say that closing them would have been wiser.', 'I should have closed the windows.'],
    ['ru', 'Нам надо было взять с собой тёплые куртки.', 'We should have brought warm jackets.'],
    ['dialogue', 'A: I sent the email without checking the address. It went to the wrong person.\nB: … Say what would have been wiser.', 'You should have checked the address.'],
  ],
  wish_past: [
    ['dialogue', 'A: Did you enjoy the concert?\nB: … You did not go. Express regret about missing it.', 'I wish I had gone to the concert.'],
    ['situation', 'You threw away a useful receipt. Express regret about throwing it away.', "I wish I hadn't thrown away the receipt."],
    ['ru', 'Жаль, что я не записал её адрес.', 'I wish I had written down her address.'],
    ['dialogue', 'A: How was your holiday?\nB: … It was too short. Express regret about not staying longer.', 'I wish I had stayed longer.'],
  ],
  mixed_conditional: [
    ['dialogue', 'A: Can you speak Italian now?\nB: … You did not study it at school. Imagine studying it then and being able to speak it now.', 'If I had studied Italian at school, I could speak it now.'],
    ['situation', 'You missed your flight yesterday, so you are at home today. Imagine catching it and being in Paris now.', 'If I had caught my flight, I would be in Paris now.'],
    ['ru', 'Если бы я тогда купил этот дом, сейчас жил бы у моря.', 'If I had bought that house, I would be living by the sea now.'],
    ['dialogue', 'A: Why is the garden dry now?\nB: … Nobody watered it yesterday. Imagine the opposite past action and present result.', "If we had watered it yesterday, it wouldn't be dry now."],
  ],
  would_rather: [
    ['dialogue', 'A: Tea or coffee?\nB: … Say that you prefer tea right now.', "I'd rather have tea."],
    ['situation', 'You can walk or take a taxi. Today you prefer walking. Say so.', "I'd rather walk."],
    ['ru', 'Я бы предпочёл не открывать окно.', "I'd rather not open the window."],
    ['dialogue', 'A: Shall we eat inside or outside?\nB: … You prefer eating outside.', "I'd rather eat outside."],
  ],
  supposed_to: [
    ['dialogue', 'A: When will the parcel arrive?\nB: … The promised delivery time is tomorrow.', 'It is supposed to arrive tomorrow.'],
    ['situation', 'The museum rules prohibit touching the paintings. Explain the rule to your friend.', "You're not supposed to touch the paintings."],
    ['ru', 'По договорённости мы должны встретиться у входа в семь.', 'We are supposed to meet at the entrance at seven.'],
    ['dialogue', 'A: Why did you buy this lamp?\nB: … The advertised function is to help you sleep.', 'It is supposed to help me sleep.'],
  ],
}
const phases: Phase[] = ['hidden', 'visible', 'visible', 'compact', 'minimal', 'varied', 'varied', 'hidden', 'hidden']
export function sessionTasks(targetId: string): Task[] {
  const p = catalog.find(p => p.id === targetId)
  if (!p) return []
  return p.drills.slice(0, 9).map((d, i) => {
    const override = varied[targetId]?.[[2, 4, 6, 7].indexOf(i)]
    const [cueType, cue, model] = override || ['ru', d.cue, d.models[0]]
    return { id: `${targetId}:s:${i}`, targetId, phase: phases[i], cueType, cue, meaning: cue, model }
  })
}
export function reviewTask(targetId: string, round: number): Task | undefined {
  const c = reviews[targetId]?.[round % 4]
  if (!c) return undefined
  return { id: `${targetId}:r:${round % 4}`, targetId, phase: 'review', cueType: c[0], cue: c[1], meaning: c[1], model: c[2] }
}
export function findTask(id: string): Task | undefined {
  const [targetId, mode, index] = id.split(':')
  if (mode === 's') return sessionTasks(targetId).find(t => t.id === id)
  if (mode === 'r' && /^[0-3]$/.test(index)) return reviewTask(targetId, Number(index))
}
