import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.QSWIPE_BROWSER_PACKAGE}/node_modules/playwright`);
const origin = 'http://127.0.0.1:4173';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
let browser;

try {
  for (let i = 0; i < 100; i++) {
    if (await fetch(origin).then(r => r.ok, () => false)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.QSWIPE_CHROME, args: ['--no-sandbox'] });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 780 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.locator('#si-name').fill('Alex Rivera');
    await page.locator('#si-pass').fill('fictional-pass');
    await page.locator('form[data-submit=signin-submit] button[type=submit]').click();
    await page.locator('#ws-name').fill('Orion Team');
    await page.locator('#owner-name').fill('Alex Rivera');
    await page.locator('#owner-level').selectOption('3');
    await page.locator('#create-form button[type=submit]').click();
    await page.locator('.engage-summary').waitFor();
    await page.goto(`${origin}/#/play/type`);
    const button = name => page.getByRole('button', { name, exact: true });
    await button('Multiplayer').click();
    await button('Start the race').waitFor();
    await button('Neon Showdown').click();
    assert.match(await page.locator('.tr-rules').textContent(), /five in a row/);
    await button('Street Clash').click();
    assert.match(await page.locator('.tr-rules').textContent(), /score double/);
    await button('Boxing').click();
    assert.equal(await button('Start the match').isDisabled(), true);
    await page.getByRole('textbox', { name: 'Player name' }).fill('Jamie');
    await button('Add').click();
    await page.getByRole('combobox', { name: 'Character for Alex' }).selectOption('bear');
    await page.getByRole('combobox', { name: 'Character for Jamie' }).selectOption('frog');
    await button('Race').click();
    assert.equal(await page.getByRole('combobox').count(), 1);
    await button('Boxing').click();
    assert.equal(await page.getByRole('combobox', { name: 'Character for Jamie' }).inputValue(), 'frog');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    const startTime = new Date('2026-01-01T10:00:00Z');
    await page.clock.install({ time: startTime });
    await page.clock.pauseAt(new Date(startTime.getTime() + 1000));
    await button('Start the match').click();
    await page.getByRole('heading', { name: 'Pass to Alex' }).waitFor();
    await button('Start').click();
    await page.clock.runFor(3000);
    const prompts = await page.locator('.tr-words .tw').allTextContents();
    const typeWord = async () => {
      assert.equal(await page.locator('#tr-input').evaluate(input => input === document.activeElement), true);
      await page.keyboard.insertText(`${await page.locator('.tw.cur').textContent()} `);
      await page.clock.runFor(50);
    };
    await page.locator('.tr-arena .tr-fighter').first().locator('[fill="#b98257"]').first().waitFor();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.tw.cur').textContent(), prompts[0]);
    await typeWord();
    assert.equal(await page.locator('#tr-points-0').textContent(), '1');
    await page.clock.fastForward(61_000);

    await page.getByRole('heading', { name: 'Pass to Jamie' }).waitFor();
    await button('Start').click();
    await page.clock.runFor(3000);
    assert.deepEqual(await page.locator('.tr-words .tw').allTextContents(), prompts);
    await page.locator('.tr-arena .tr-fighter').last().locator('[fill="#72d06f"]').first().waitFor();
    await page.clock.fastForward(20_000);
    assert.equal(await page.locator('#tr-round').textContent(), 'Round 2 of 3');
    assert.equal(await page.locator('#tr-points-0').textContent(), '1');
    await typeWord();
    assert.equal(await page.locator('#tr-points-1').textContent(), '1');
    await page.clock.fastForward(20_000);
    assert.equal(await page.locator('#tr-round').textContent(), 'Round 3 of 3');
    await typeWord();
    assert.equal(await page.locator('#tr-points-1').textContent(), '2');
    await page.clock.fastForward(21_000);

    await page.locator('.tr-results').waitFor();
    assert.deepEqual(await page.locator('.tr-round-results b').allTextContents(), ['1–0', '0–1', '0–1']);
    assert.equal(await page.locator('.tr-results h2').textContent(), 'Jamie wins');
    await button('Replay match').click();
    await page.clock.runFor(100);
    assert.equal(await page.locator('#tr-points-1').textContent(), '2');
    await button('Rematch').click();
    await page.getByRole('heading', { name: 'Pass to Alex' }).waitFor();
    await button('Setup').click();
    await button('Solo').click();
    await button('Start').click();
    await page.clock.runFor(3000);
    await button('Dash').waitFor();
    await typeWord();
    await typeWord();
    await page.clock.fastForward(61_000);
    await page.getByText('New personal best').waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`Typing fights passed at ${viewport.width}px`);
  }
} finally {
  await browser?.close();
  server.kill();
}
