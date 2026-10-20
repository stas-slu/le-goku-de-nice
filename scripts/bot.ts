// Headless playtest: a simple bot plays a whole stage against the real simulation.
//   npx tsx scripts/bot.ts boutique|avenue [seeds]
import { World } from '../src/game/world';
import { STAGES } from '../src/game/stage';
import { NO_INTENT, Intent, Fighter } from '../src/game/types';

function botIntent(w: World, tick: number): Intent {
  const h = w.hero;
  const foes = w.fighters.filter((f) => f.team === 'enemy' && !['dead', 'down'].includes(f.state) && f.entered);
  if (!foes.length) {
    // walk right through scrolling sections
    return { ...NO_INTENT, mx: w.director.active ? 0 : 1 };
  }
  if (w.resolve >= 100 && foes.length >= 3) return { ...NO_INTENT, special: true };
  const prio = (f: Fighter) => (f.state === 'steal' || f.state === 'carry' ? -200 : 0) + Math.abs(f.x - h.x) + Math.abs(f.y - h.y) * 2;
  const t = foes.sort((a, b) => prio(a) - prio(b))[0];
  const side = t.x > h.x ? -1 : 1;
  const tx = t.x + side * 20;
  const dx = tx - h.x;
  const dy = t.y - h.y;
  const i: Intent = { ...NO_INTENT };
  if (Math.abs(t.x - h.x) < 30 && Math.abs(dy) < 6) {
    i.mx = t.x > h.x ? 1 : -1;
    if (h.facing !== i.mx) return i;
    i.mx = 0;
    i.attack = tick % 5 === 0;
    return i;
  }
  i.mx = Math.abs(dx) > 3 ? Math.sign(dx) : 0;
  i.my = Math.abs(dy) > 2 ? Math.sign(dy) : 0;
  return i;
}

const key = (process.argv[2] ?? 'boutique') as keyof typeof STAGES;
const seeds = Number(process.argv[3] ?? 5);
for (let s = 1; s <= seeds; s++) {
  const w = new World(STAGES[key], s * 101);
  let deaths = 0;
  let tick = 0;
  let minHp = 100;
  for (; tick < 60 * 60 * 8 && !w.stageClear; tick++) {
    w.step(botIntent(w, tick));
    for (const e of w.events) if (e.type === 'heroDown') deaths++;
    w.events.length = 0;
    minHp = Math.min(minHp, w.hero.hp);
    if (w.gameOver) {
      w.continueGame();
    }
  }
  console.log(`seed ${s}: clear=${w.stageClear} time=${(tick / 60).toFixed(0)}s deaths=${deaths} treasure=${w.treasure.toFixed(0)}% kos=${w.kos} minHp=${minHp} maxCombo=${w.maxCombo} wave=${w.director.wave} seg=${w.director.seg}`);
}
