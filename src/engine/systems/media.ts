import type { Ctx } from '../ctx';
import type { StoryKind } from '../types';

function name(x: Ctx): string {
  return `${x.c.firstName} ${x.c.lastName}`;
}

/**
 * Yearly media coverage. Famous (or infamous) characters attract stories;
 * secrets leak at a rate set by the era's media; cancel culture arrives with
 * social media.
 */
export function mediaTick(x: Ctx): void {
  const c = x.c;
  const M = c.media;
  const fame = x.stat('fame');
  const media = x.media;
  // Fame decays unless maintained.
  const famous = fame >= 30 || x.stat('infamy') >= 40;
  x.mod('fame', fame > 10 ? -1.2 : -0.3);
  x.mod('infamy', -0.6);
  // Public image tracks karma and recent coverage.
  x.mod('publicImage', (x.stat('karma') / 40 + (50 - x.stat('publicImage')) / 20) * (famous ? 1 : 0.4));
  if (M.prFirm) {
    if (!x.spend(60000)) M.prFirm = false;
    else x.mod('publicImage', 3);
  }
  if (x.year >= 2006 && fame > 15) M.followers = Math.round(M.followers * x.float(0.95, 1.25) + fame * fame * 40);

  // Coverage.
  if (famous) {
    const volume = Math.round((fame / 35) * media.spread * x.float(0.5, 1.5));
    for (let i = 0; i < Math.min(3, volume); i++) {
      const kind: StoryKind = x.weighted<StoryKind>(['puff', 'gossip', 'profile', 'expose', 'humanitarian', 'threat'], (k) =>
        k === 'puff' ? 2 + x.stat('publicImage') / 30 : k === 'gossip' ? 2 : k === 'profile' ? 1 : k === 'expose' ? (x.stat('karma') < 0 ? 2 : 0.4) + x.stat('infamy') / 30 : k === 'humanitarian' ? (x.stat('karma') > 40 ? 1.5 : 0.2) : x.stat('infamy') > 50 ? 0.6 : 0.1,
      )!;
      const headline = headlineFor(x, kind);
      const sentiment = kind === 'puff' || kind === 'humanitarian' || kind === 'profile' ? 20 : kind === 'gossip' ? 0 : -25;
      x.story(kind, headline, sentiment);
      if (kind === 'expose') x.mods({ publicImage: -6, heat: 4 });
      else if (kind === 'puff' || kind === 'humanitarian') x.mods({ publicImage: 3, fame: 1 });
      else if (kind === 'threat') {
        x.mods({ anxiety: 6, paranoia: 5 });
        x.log('📰 Death threats are being covered in the press.', 'bad');
      }
    }
  }

  // Secrets leak.
  for (const sec of M.secrets) {
    if (sec.exposed) continue;
    const ownsMedia = c.assets.some((a) => a.typeId === 'mediaCompany');
    const leakP = 0.015 * (1 + fame / 25) * media.spread * (M.prFirm ? 0.6 : 1) * (ownsMedia ? 0.5 : 1) * (x.w.policies.includes('censorship') ? 0.3 : 1);
    if (x.chance(leakP)) {
      sec.exposed = true;
      x.story('scandal', `EXPOSED: ${sec.text}`, -40 - sec.severity * 3);
      x.mods({ publicImage: -sec.severity * 4, infamy: sec.severity * 2, professionalRep: -sec.severity * 2, politicalApproval: -sec.severity * 4 });
      x.log(`📰 Scandal! The press exposed: ${sec.text.toLowerCase()}.`, 'bad');
      x.remember('scandal', `Exposed: ${sec.text}`, 30 + sec.severity * 3);
      if (x.year >= 2012 && fame >= 35 && !M.cancelled) {
        const yearsAgo = x.age - sec.age;
        const severity = Math.min(10, Math.round(sec.severity * (fame / 50) * (yearsAgo > 15 ? 0.6 : 1)));
        if (severity >= 3) {
          M.cancelled = { severity, years: 0 };
          x.queue('cancelled', { severity });
        }
      }
    }
  }
  if (M.cancelled) {
    M.cancelled.years++;
    x.mods({ fame: -2, happiness: -3, anxiety: 3 });
    if (c.career && x.chance(M.cancelled.severity / 25)) {
      c.career.performance = Math.max(0, c.career.performance - 20);
    }
    if (M.cancelled.years >= 3) {
      M.cancelled = null;
      c.flags.survivedCancel = true;
      x.log('The internet has moved on to someone else. Your cancellation is over.', 'good');
    }
  }
}

function headlineFor(x: Ctx, kind: StoryKind): string {
  const n = name(x);
  const title = x.c.career ? 'star' : 'personality';
  switch (kind) {
    case 'puff':
      return x.pick([`${n}: the ${title} everyone is talking about`, `Inside the charmed life of ${n}`, `${n} is having the best year of their life`]);
    case 'gossip':
      return x.pick([`Who is ${n} dating now?`, `${n} spotted at a ${x.year < 1950 ? 'society ball' : 'nightclub'} at 3 a.m.`, `${n}'s feud with a rival heats up`]);
    case 'profile':
      return `A long read: how ${n} made it`;
    case 'expose':
      return x.pick([`Investigation: the dark side of ${n}`, `Sources allege ${n} has secrets`, `Questions mount over ${n}'s money`]);
    case 'humanitarian':
      return `${n} quietly funds a shelter for the homeless`;
    case 'threat':
      return `Police guard ${n} after death threats`;
    default:
      return `${n} in the news`;
  }
}

export function plantStory(x: Ctx, aboutRival?: string): string {
  const cost = 25000;
  if (!x.spend(cost)) return `Planting a story costs ${x.fmt(cost)}.`;
  x.mods({ karma: -3, corruption: 2 });
  if (aboutRival) {
    const n = x.npc(aboutRival);
    x.story('expose', `Shocking allegations against ${x.name(n)}`, -30, true);
    if (n) n.fame = Math.max(0, n.fame - 15);
    x.relMod(aboutRival, -20, -20);
    if (x.chance(0.2)) {
      x.secret('plantedStory', 'Planting smear stories about rivals', 4);
      return `The smear against ${x.name(n)} ran — but a journalist is asking who paid for it.`;
    }
    return `The smear against ${x.name(n)} ran everywhere.`;
  }
  x.story('puff', `${name(x)}: a profile in greatness`, 25, true);
  x.mods({ publicImage: 8, fame: 4 });
  return 'A glowing profile of you appeared in the press. Nobody needs to know you paid for it.';
}

export function buryStory(x: Ctx): string {
  const sec = x.c.media.secrets.find((s) => !s.exposed);
  const cost = 40000 + (sec?.severity ?? 1) * 10000;
  if (!x.spend(cost)) return `Bribing editors costs ${x.fmt(cost)}.`;
  x.mods({ corruption: 3, karma: -2 });
  if (!sec) return 'There was nothing to bury, but the editors appreciate the gesture.';
  if (x.chance(0.7)) {
    x.c.media.secrets = x.c.media.secrets.filter((s) => s !== sec);
    return `A journalist's story about "${sec.text.toLowerCase()}" was spiked.`;
  }
  sec.severity++;
  return 'The journalist refused your bribe — and now the bribe is part of the story.';
}

export function giveInterview(x: Ctx): string {
  const ch = x.stat('charisma') + x.skill('publicSpeaking') / 2;
  if (x.chance(ch / 130)) {
    x.mods({ fame: 4, publicImage: 5 });
    x.story('profile', `${name(x)} opens up in a revealing interview`, 20);
    return 'Your interview went brilliantly.';
  }
  x.mods({ fame: 2, publicImage: -5 });
  x.story('gossip', `${name(x)}'s car-crash interview`, -10);
  return 'You said something regrettable on air. Clips are circulating.';
}

export function socialPost(x: Ctx): string {
  if (x.year < 2006) return 'Social media does not exist yet.';
  const viral = x.chance(0.05 + x.skill('socialMediaManipulation') / 300 + x.stat('fame') / 400);
  x.train('socialMediaManipulation', 3);
  if (viral) {
    x.mods({ fame: 6, happiness: 4 });
    x.c.media.followers += x.int(5000, 200000);
    return 'Your post went viral!';
  }
  if (x.chance(0.08)) {
    x.secret('oldPosts', 'Offensive old posts', 3);
    return 'A post aged badly. Someone screenshotted it.';
  }
  x.c.media.followers += x.int(10, 500);
  return 'You posted. A few people liked it.';
}

export function apologize(x: Ctx): string {
  const M = x.c.media;
  if (!M.cancelled) return 'You have nothing to publicly apologize for.';
  const p = 0.35 + x.stat('charisma') / 300 + x.stat('empathy') / 300 - M.cancelled.severity / 20;
  if (x.chance(p)) {
    M.cancelled.years += 2;
    x.mods({ publicImage: 8, karma: 2 });
    return 'Your apology landed. People are starting to forgive.';
  }
  x.mods({ publicImage: -4 });
  return 'Your apology was called "a non-apology". It made things worse.';
}
