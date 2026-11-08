// Test v prehliadači nad zostaveným public/: otvorí menu a každý stroj, zlyhá pri chybe v konzole,
// výnimke na stránke, zlyhanej požiadavke alebo porušení CSP. Potom prejde CNC program na Hermle
// (vrátane zámku dverí), jeden ohyb na Bystronic, štart a dotykové HMI elektroerózie, sústruženie a frézovanie
// cez sprievodcu krok za krokom, zvar MMA, BOZP v úlohe a úzku scénu (mobil).
// Spustenie: npm run build && npm run test:e2e   (prehliadač: npx playwright install chromium)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('../public/', import.meta.url).pathname;
const CSP = (readFileSync(new URL('../static/_headers', import.meta.url), 'utf8').match(
  /Content-Security-Policy: (.*)/,
) || [])[1];
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};
// identifikátory strojov priamo z App.jsx – nový stroj sa do testu dostane automaticky
const MACHINES = [
  ...readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').matchAll(/\{\s*id:\s*'([a-z]+)'/g),
].map((m) => m[1]);
// poistka: po preformátovaní App.jsx výraz raz nenašiel žiadny stroj a test „všetky stroje“ prešiel naprázdno
if (MACHINES.length < 15) {
  console.error(`Test nenašiel stroje v App.jsx (${MACHINES.length}) – skontroluj regulárny výraz.`);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const failures = [];
const fail = (where, what) => {
  failures.push(`${where}: ${what}`);
  console.log(`  ✗ ${where}: ${what}`);
};

async function open(route, { debug = false, viewport = { width: 1280, height: 800 } } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await ctx.newPage(),
    problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 240)}`);
  });
  page.on('pageerror', (e) => problems.push(`výnimka: ${e.message.slice(0, 240)}`));
  page.on('requestfailed', (r) => problems.push(`požiadavka: ${r.url()} ${r.failure()?.errorText || ''}`));
  await page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP ${e.violatedDirective} ${e.blockedURI}`),
    ),
  );
  await page.goto(`${BASE}${debug ? '?debug' : ''}#${route}`);
  return { page, ctx, problems };
}
const until = async (page, fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 250 });

// 1) menu a všetky stroje
for (const route of ['', 'moderne', ...MACHINES]) {
  const name = route || 'menu',
    t0 = Date.now();
  const { page, ctx, problems } = await open(route);
  try {
    await page.waitForSelector(['', 'moderne', 'shuangli'].includes(route) ? '.menu-title' : 'canvas', {
      timeout: 60000,
    });
    await page.waitForTimeout(1500);
    if (await page.getByText('Simulátor sa nepodarilo spustiť').count()) fail(name, 'chybová obrazovka simulátora');
  } catch (e) {
    fail(name, e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail(name, p));
  console.log(`  ${problems.length ? '✗' : '✓'} ${name} (${Date.now() - t0} ms)`);
  await ctx.close();
}

// 2) Hermle: zámok dverí a celý program
{
  const { page, ctx, problems } = await open('hermle', { debug: true });
  try {
    await until(page, () => window.__hermle?.ex);
    // dotykový displej TNC: stránka POSITION z klávesnice displeja
    await page.evaluate(() => window.__hermle.api.hmiKey('2'));
    if ((await page.evaluate(() => window.__hermle.c.scrTab)) !== 'position')
      fail('hermle', 'stránka displeja sa neprepla');
    await page.getByRole('button', { name: 'Zatvoriť dvere', exact: true }).click();
    await page
      .getByRole('button', { name: /Štart cyklu/i })
      .first()
      .click();
    const early = await page.evaluate(() => ({ running: window.__hermle.c.running, door: window.__hermle.doorTravel }));
    if (early.running && early.door > 0.01)
      fail('hermle', `program beží pri pootvorených dverách (${early.door.toFixed(2)})`);
    await until(page, () => window.__hermle.c.running, null, 60000); // odložený štart po zatvorení dverí
    await page.getByRole('button', { name: 'Otvoriť dvere', exact: true }).click();
    if (await page.evaluate(() => window.__hermle.c.door)) fail('hermle', 'dvere sa otvorili počas programu');
    await page.getByRole('button', { name: /Rýchlo na koniec/i }).click();
    await until(page, () => window.__hermle.ex.S.done || window.__hermle.ex.S.alarm, null, 240000);
    const r = await page.evaluate(() => ({
      alarm: window.__hermle.ex.S.alarm?.text,
      removed: window.__hermle.ex.S.removed,
      opt: window.__hermle.sceneOpt.stats(),
    }));
    if (r.alarm) fail('hermle', `alarm ${r.alarm}`);
    if (!(r.removed > 5000)) fail('hermle', `malý úber ${r.removed}`);
    console.log(
      `  ✓ hermle: program dokončený, úber ${(r.removed / 1000).toFixed(1)} cm³, zlúčené skupiny ${r.opt.groups}`,
    );
  } catch (e) {
    fail('hermle', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('hermle', p));
  await ctx.close();
}

// 3) Bystronic: jeden ohyb
{
  const { page, ctx, problems } = await open('bystronic', { debug: true });
  try {
    await until(page, () => window.__bystronic?.process);
    await page.waitForTimeout(800);
    if (await page.locator('.work-resume').count()) fail('bystronic', 'lišta rozpracovanej práce bez uloženej práce');
    await page.getByRole('button', { name: '×10', exact: true }).click();
    await page
      .getByRole('button', { name: /Spustiť ohyb/i })
      .first()
      .click();
    await until(page, () => window.__bystronic.process.S.done || window.__bystronic.process.S.alarm, null, 120000);
    const S = await page.evaluate(() => ({ ...window.__bystronic.process.S }));
    if (S.alarm || !S.complete) fail('bystronic', `ohyb nedokončený ${S.alarm || ''}`);
    else console.log(`  ✓ bystronic: ohyb dokončený, sila ${Math.round(S.maxForce)} kN`);
  } catch (e) {
    fail('bystronic', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('bystronic', p));
  await ctx.close();
}

// 4) OSCARMAX: štart s presnou hláškou, potom hĺbenie
{
  const { page, ctx, problems } = await open('oscarmax', { debug: true });
  try {
    await until(page, () => window.__oscar?.process);
    await page
      .getByRole('button', { name: /Štart cyklu/i })
      .first()
      .click();
    const msg = await page.evaluate(() => window.__oscar.process.S.alarm);
    if (!/dvere nádrže/i.test(msg || '')) fail('oscarmax', `nečakaná hláška pri otvorenej nádrži: ${msg}`);
    await page.getByRole('button', { name: /Zatvoriť nádrž/i }).click();
    await until(page, () => !window.__oscar.c.door, null, 5000);
    await page.getByText('Napustiť dielektrikum', { exact: true }).click();
    await page.waitForTimeout(500);
    await until(
      page,
      () => {
        window.__oscar.api.start();
        return window.__oscar.process.S.run || window.__oscar.process.S.removed > 0;
      },
      null,
      60000,
    );
    await until(page, () => window.__oscar.process.S.removed > 0, null, 120000);
    console.log('  ✓ oscarmax: hĺbenie beží');
  } catch (e) {
    fail('oscarmax', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('oscarmax', p));
  await ctx.close();
}

// 4b) OSCARMAX: dotykové HMI cez celé okno – stránky menu, rýchlosť simulácie na displeji, okrúhly STOP
{
  const { page, ctx, problems } = await open('oscarmax', { debug: true });
  try {
    await until(page, () => window.__oscar?.process);
    await page.getByRole('button', { name: 'Ručné ovládanie' }).click();
    await page.getByRole('button', { name: 'HMI cez celé okno' }).click();
    const screen = page.locator('.hmi-touch-screen');
    await screen.waitFor();
    if (await page.locator('#edm-full-speed').count()) fail('oscarmax HMI', 'posuvník rýchlosti mimo displeja');
    const box = await screen.boundingBox(),
      s = Math.min(box.width / 1040, box.height / 650),
      at = (x, y) => [box.x + (box.width - 1040 * s) / 2 + x * s, box.y + (box.height - 650 * s) / 2 + y * s];
    await page.mouse.click(...at(7 + 4 * 172 + 60, 57)); // záložka MONITOR
    const tab = await page.evaluate(() => window.__oscar.c.hmiTab);
    if (tab !== 'monitor') fail('oscarmax HMI', `záložka sa neprepla (${tab})`);
    await page.mouse.move(...at(900, 622));
    await page.mouse.down();
    await page.mouse.move(...at(1012, 622), { steps: 4 });
    await page.mouse.up();
    const speed = await page.evaluate(() => window.__oscar.c.speed);
    if (speed !== 80) fail('oscarmax HMI', `ťahanie posuvníka rýchlosti dalo ×${speed}`);
    const stop = await page.locator('.edm-fullscreen .reference-key.emergency').boundingBox();
    if (Math.abs(stop.width - stop.height) > 0.5)
      fail('oscarmax HMI', `STOP nie je kruh (${stop.width} × ${stop.height})`);
    console.log('  ✓ oscarmax: dotykové HMI, rýchlosť na displeji, okrúhly STOP');
  } catch (e) {
    fail('oscarmax HMI', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('oscarmax HMI', p));
  await ctx.close();
}

// 4c) klasické stroje cez sprievodcu krok za krokom: sústruh, frézka a zváranie MMA
const range = (page, label, v) =>
  page.evaluate(
    ([label, v]) => {
      const inp = document.querySelector(`[data-param="${label}"] input[type=range]`);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, v);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [label, v],
  );
const guideStep = (page, n, ms = 90000) =>
  until(
    page,
    (n) => {
      const t = document.querySelector('.guide-window .sec-title')?.textContent || '';
      return n ? t.startsWith(`Krok ${n} `) : /Hotovo/.test(t);
    },
    n,
    ms,
  );
{
  const { page, ctx, problems } = await open('sustruh');
  try {
    await page.waitForSelector('canvas', { timeout: 60000 });
    await page.getByRole('button', { name: /Sprievodca krok za krokom/ }).click();
    await page.getByRole('button', { name: /Ďalej/ }).click();
    await page.getByRole('button', { name: /Ďalej/ }).click();
    await guideStep(page, 3);
    await page.getByRole('button', { name: /Štart vretena/ }).click();
    await guideStep(page, 4);
    await range(page, 'Priečny posuv X (priemer)', 88);
    await guideStep(page, 5);
    await page.locator('[data-param="Automatický pozdĺžny posuv k skľučovadlu"]').click();
    await guideStep(page, 7, 120000); // 30 mm sústruženia
    await page.locator('[data-param="Automatický pozdĺžny posuv k skľučovadlu"]').click();
    await guideStep(page, 8);
    await page
      .getByRole('button', { name: /Stop vretena/ })
      .first()
      .click();
    await guideStep(page, 9);
    await page.locator('[data-param="Posuvné meradlo na obrobku"]').click();
    await guideStep(page, 0);
    console.log('  ✓ sústruh: sprievodca, sústruženie 30 mm a meranie');
  } catch (e) {
    fail('sústruh', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('sústruh', p));
  await ctx.close();
}
{
  const { page, ctx, problems } = await open('freza');
  try {
    await page.waitForSelector('canvas', { timeout: 60000 });
    await page.getByRole('button', { name: /Sprievodca krok za krokom/ }).click();
    await page.getByRole('button', { name: /Ďalej/ }).click();
    await page.getByRole('button', { name: /Ďalej/ }).click();
    await page.getByRole('button', { name: /Štart vretena/ }).click();
    await guideStep(page, 4);
    await range(page, 'Konzola zvisle Z', 420);
    await guideStep(page, 5);
    await page.locator('[data-param="Konzola zaistená"]').click();
    await guideStep(page, 6);
    await page.locator('[data-param="Posuv stola"] button', { hasText: 'Vpravo' }).click();
    await guideStep(page, 8, 120000); // 40 mm frézovania
    await page.locator('[data-param="Posuv stola"] button', { hasText: 'Stop' }).click();
    await page
      .getByRole('button', { name: /Stop vretena/ })
      .first()
      .click();
    await guideStep(page, 9);
    await page.locator('[data-param="Hĺbkomer na obrobku"]').click();
    await guideStep(page, 0);
    console.log('  ✓ frézka: sprievodca, frézovanie 40 mm a hĺbkomer');
  } catch (e) {
    fail('frézka', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('frézka', p));
  await ctx.close();
}
{
  const { page, ctx, problems } = await open('zvaranie', { debug: true });
  try {
    await until(page, () => window.__weld?.proj);
    await range(page, 'Najvyššia rýchlosť ruky pri zváraní', 20);
    await page.mouse.click(5, 300);
    await page.keyboard.press('h');
    await page.keyboard.press('m');
    await page.waitForTimeout(800);
    const pts = await page.evaluate(() => {
      const P = window.__weld.F.S.path,
        at = (f) => P[Math.floor(f * (P.length - 1))];
      return [0.05, 0.95].map((f) => window.__weld.proj(at(f).x, at(f).z));
    });
    await page.mouse.move(...pts[0]);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(500);
    await page.mouse.down({ button: 'left' });
    await until(page, () => window.__weld.st.arc, null, 10000);
    for (let i = 1; i <= 80; i++) {
      await page.mouse.move(
        pts[0][0] + ((pts[1][0] - pts[0][0]) * i) / 80,
        pts[0][1] + ((pts[1][1] - pts[0][1]) * i) / 80,
      );
      await page.waitForTimeout(150);
    }
    await page.mouse.up({ button: 'left' });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(800);
    const ev = await page.evaluate(() => window.__weld.evalWeld());
    if (!ev || ev.cov < 0.3) fail('zváranie', `krátky zvar (pokrytie ${ev ? Math.round(ev.cov * 100) : 0} %)`);
    else console.log(`  ✓ zváranie: oblúk a zvar pozdĺž spoja (${Math.round(ev.cov * 100)} %)`);
  } catch (e) {
    fail('zváranie', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('zváranie', p));
  await ctx.close();
}

// 5) Bystronic: v úlohe sa ohyb spustí až po potvrdení BOZP
{
  const { page, ctx, problems } = await open('bystronic/uloha=uholnik', { debug: true });
  try {
    await until(page, () => window.__bystronic?.process);
    await page
      .getByRole('button', { name: /Spustiť ohyb/i })
      .first()
      .click();
    const dialog = page.locator('[aria-label="Kontrola BOZP"]');
    if (!(await dialog.count())) fail('bystronic BOZP', 'kontrola BOZP sa neotvorila');
    if (await page.evaluate(() => window.__bystronic.process.S.run))
      fail('bystronic BOZP', 'ohyb sa spustil pred potvrdením');
    for (const cb of await dialog.locator('input[type=checkbox]').all()) await cb.check();
    await page.getByRole('button', { name: 'Potvrdiť a spustiť' }).click();
    await until(page, () => window.__bystronic.process.S.run || window.__bystronic.process.S.done, null, 10000);
    console.log('  ✓ bystronic: kontrola BOZP pred prvým ohybom');
  } catch (e) {
    fail('bystronic BOZP', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('bystronic BOZP', p));
  await ctx.close();
}

// 6) úzka scéna (mobil): jeden riadok tlačidiel, ďalšie pod „⋯“
{
  const { page, ctx, problems } = await open('hermle', { viewport: { width: 390, height: 844 } });
  try {
    await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
    const work = page.getByRole('button', { name: 'Pozrieť obrobok' });
    if (await work.count()) fail('mobil', 'tlačidlo „Pozrieť obrobok“ je viditeľné bez „⋯“');
    await page.getByRole('button', { name: 'Ďalšie tlačidlá scény' }).click();
    if (!(await work.count())) fail('mobil', '„⋯“ neukázalo ďalšie tlačidlá');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) fail('mobil', 'vodorovný posun stránky');
    console.log('  ✓ mobil: tlačidlá scény pod „⋯“');
  } catch (e) {
    fail('mobil', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('mobil', p));
  await ctx.close();
}

// 7) meranie výkonu (?perf): panel so živými údajmi scény
{
  const { page, ctx, problems } = await open('hermle', { debug: false });
  try {
    await page.goto(page.url().replace('/#', '/?perf#'));
    await page.waitForSelector('.perf-overlay', { timeout: 60000 });
    await page.waitForFunction(() => /FPS/.test(document.querySelector('.perf-overlay')?.textContent || ''), null, {
      timeout: 30000,
    });
    console.log('  ✓ meranie výkonu: panel ?perf');
  } catch (e) {
    fail('perf', e.message.split('\n')[0]);
  }
  problems.forEach((p) => fail('perf', p));
  await ctx.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} chýb v teste prehliadača`);
  process.exit(1);
}
console.log('\nTest v prehliadači prešiel.');
