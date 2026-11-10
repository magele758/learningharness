export function reviewCard(card, grade, now = new Date()) {
  const quality = Number(grade);
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new Error("grade must be an integer from 0 to 5");
  }
  let ease = card.ease ?? 2.5;
  let interval = card.interval ?? 0;
  let reps = card.reps ?? 0;
  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease < 1.3) ease = 1.3;
  }
  const due = new Date(now.getTime() + interval * 86400000).toISOString();
  return { ...card, ease, interval, reps, due, lastGrade: quality };
}

export function isDue(card, now = new Date()) {
  if (!card.due) return true;
  return new Date(card.due).getTime() <= now.getTime();
}
