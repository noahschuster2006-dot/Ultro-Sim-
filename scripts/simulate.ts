import { autoplay } from './autoplay';

/** Headless balance & stability run: many lives across eras and countries. */
const runs = Number(process.argv[2] ?? 24);
const gens = Number(process.argv[3] ?? 3);
const starts: [number, string | undefined][] = [
  [-100, 'it'], [800, 'gb'], [1347, 'fr'], [1500, 'es'], [1750, 'gb'], [1850, 'us'], [1900, 'de'], [1920, 'us'],
  [1935, 'de'], [1950, 'us'], [1965, 'co'], [1980, 'ru'], [1990, 'us'], [2000, 'jp'], [2010, 'in'], [2025, undefined],
];
let totalYears = 0;
let totalEvents = 0;
let errors = 0;
const ages: number[] = [];
const causes: Record<string, number> = {};
const t0 = Date.now();
for (let i = 0; i < runs; i++) {
  const [year, country] = starts[i % starts.length];
  const r = autoplay(1000 + i * 7919, year, country, gens, i % 3 === 0);
  totalYears += r.years;
  totalEvents += r.events;
  for (const l of r.lives) {
    ages.push(l.age);
    const k = l.cause.replace(/\(.*\)/, '').trim();
    causes[k] = (causes[k] ?? 0) + 1;
  }
  if (r.errors.length) {
    errors += r.errors.length;
    console.log(`run ${i} (${year}, ${country}):`, r.errors.slice(0, 5));
  }
}
ages.sort((a, b) => a - b);
console.log(`runs=${runs} lives=${ages.length} years=${totalYears} events=${totalEvents} errors=${errors} time=${Date.now() - t0}ms`);
console.log(`age at death: median ${ages[Math.floor(ages.length / 2)]}, min ${ages[0]}, max ${ages[ages.length - 1]}`);
console.log('top causes:', Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 10));
if (errors) process.exitCode = 1;
