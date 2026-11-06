/* Optional browser layout audit. Start the static site first; see README. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:8001/';
const cases = [195, 240, 320, 375, 768, 1001, 1024, 1100, 1101, 1280, 1600].map(width => ({ width, zoom: 1 }));
cases.push({ width: 390, zoom: 2 });
const routes = ['', 'train', 'exam', 'mistakes', 'portfolio', 'stats', 'rewards', 'key', 'settings', 'dungeon', 'histology'];

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'],
  });
  const failures = [];
  try {
    for (const { width, zoom } of cases) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      page.on('pageerror', error => failures.push(`${width}px (zoom ${zoom}): ${error.message}`));
      if (zoom !== 1) await page.addInitScript(zoom => {
        document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.zoom = String(zoom); });
      }, zoom);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(BASE_URL);
      async function route(name) {
        await page.evaluate(name => { location.hash = '#/' + name; }, name);
        await page.waitForFunction(name => window.AT && AT.route() === (name || 'dashboard'), name);
        if (name === 'dungeon') await page.waitForSelector('.dg-tabs');
        if (name === 'histology') await page.waitForSelector('.histo-setup');
      }
      async function scan(label) {
        await page.waitForTimeout(100);
        const issues = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth, found = [], seen = new Set();
          if (document.documentElement.scrollWidth > viewport + 1) found.push('страница шире окна');
          for (const el of document.querySelectorAll('body *')) {
            if (el.closest('svg, .germ-squad-flight, .skip-link, .dg-path-line')) continue;
            const style = getComputedStyle(el), rect = el.getBoundingClientRect();
            if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 1 || rect.height < 1) continue;
            // These are deliberately scrollable, or use ellipsis/native input rendering.
            const helpPanel = el.closest('.dg-info-panel');
            if (helpPanel && !helpPanel.closest('details').open) continue;
            if ((helpPanel && el !== helpPanel) || el.closest('.code-hint, .course-toggle__current') || el.tagName === 'INPUT') continue;
            const name = `${el.tagName}.${String(el.className).replace(/\s+/g, '.')}`;
            const sidebar = el.closest('.course-sidebar');
            const sidebarRect = sidebar && sidebar.getBoundingClientRect();
            const clippedBySidebar = sidebar && el !== sidebar && (rect.left < sidebarRect.left - 1 || rect.right > sidebarRect.right + 1);
            if ((rect.left < -1 || rect.right > viewport + 1 || clippedBySidebar) && !seen.has('x' + name)) {
              seen.add('x' + name); found.push(`${name}: за границей экрана`);
            }
            // In the image viewer the stage and its overlay may contain markers that
            // protrude past the picture; the viewport deliberately scrolls/clips them.
            const viewerStage = el.matches('.histo-viewer__stage, .histo-viewer__markers, .histo-structure-image, .histo-markers');
            // Marker numbers intentionally sit outside their rings; page overflow is checked separately.
            if (!viewerStage && !el.classList.contains('histo-marker') && el.clientWidth && el.scrollWidth > el.clientWidth + 2 &&
                style.overflowX !== 'auto' && style.overflowX !== 'scroll' &&
                !['HTML', 'BODY'].includes(el.tagName) && !seen.has('s' + name)) {
              seen.add('s' + name); found.push(`${name}: содержимое шире блока`);
            }
          }
          return found;
        });
        if (issues.length) failures.push(`${width}px (zoom ${zoom}), ${label}: ${issues.join('; ')}`);
      }
      for (const name of routes) {
        await route(name);
        await scan(name || 'dashboard');
        if (name === 'key') {
          await page.locator('.key-advanced').evaluate(el => { el.open = true; });
          await scan('key-import');
        }
        if (name === 'histology') {
          await page.locator('#courseToggle').click();
          await scan('histology-sidebar');
          await page.locator('#courseClose').click();
          await page.locator('[data-histo="start"]').click();
          await page.waitForSelector('.histo-image img');
          await scan('histology-choice');
          await page.locator('.histo-image__open').click();
          await page.waitForSelector('.histo-image-dialog[open]');
          await scan('histology-image-dialog');
          await page.locator('[data-zoom-toggle]').click();
          await page.locator('[data-zoom-close]').click();
          await page.waitForSelector('.histo-image-dialog', {state: 'detached'});
          await page.locator('[data-histo="select"]').first().click();
          await page.locator('[data-histo="check"]').click();
          await scan('histology-feedback');
          if (await page.locator('.histo-review').count()) {
            await page.locator('.histo-review summary').click();
            await scan('histology-annotated');
          }
          await page.locator('[data-histo="setup"]').click();
          await page.locator('[data-histo="mode"][data-value="text"]').click();
          await page.locator('[data-histo="start"]').click();
          await scan('histology-input');
          await page.locator('#histoAnswer').fill('Неоднозначный ответ');
          await page.locator('[data-histo-form] button[type="submit"]').click();
          await scan('histology-self-check');
          await page.locator('[data-histo="setup"]').click();
          for (const tab of ['errors', 'stats', 'atlas', 'structures']) {
            await page.locator(`[data-histo="section"][data-value="${tab}"]`).click();
            await scan('histology-' + tab);
            if (tab === 'atlas') {
              await page.locator('#atlasSearch').fill('трахея');
              await page.locator('[data-atlas-item]:visible > summary').first().click();
              await scan('histology-atlas-open');
              await page.locator('[data-histo="atlas-photo"]:visible').first().click();
              await page.waitForSelector('.histo-image-dialog[open]');
              await scan('histology-atlas-viewer');
              await page.locator('[data-zoom-close]').click();
              await page.waitForSelector('.histo-image-dialog', {state: 'detached'});
            }
          }
          await page.locator('[data-histo="structure-start"]').click();
          await page.waitForSelector('.histo-structure-image img');
          await scan('histology-structure-point');
          await page.locator('[data-histo="structure-zoom"]').click();
          await page.waitForSelector('.histo-image-dialog[open]');
          await scan('histology-structure-viewer');
          await page.locator('[data-zoom-close]').click();
          await page.waitForSelector('.histo-image-dialog', {state: 'detached'});
          await page.locator('.histo-marker-choice').first().click();
          await page.locator('[data-histo="structure-check"]').click();
          await scan('histology-structure-feedback');
          await page.locator('[data-histo="structure-setup"]').click();
          await page.locator('[data-histo="structure-mode"][data-value="name"]').click();
          await page.locator('[data-histo="structure-start"]').click();
          await scan('histology-structure-name');
          await page.locator('[data-histo="structure-option"]').first().click();
          await page.locator('[data-histo="structure-check"]').click();
          await scan('histology-structure-name-feedback');
          await page.locator('[data-histo="section"][data-value="theory"]').click();
          await page.waitForSelector('[data-theory-filter]');
          await scan('histology-theory-setup');
          await page.locator('[data-histo="theory-start"]').click();
          await scan('histology-theory-question');
          await page.locator('[data-histo="theory-select"]').first().click();
          await page.locator('[data-histo="theory-check"]').click();
          await scan('histology-theory-feedback');
        }
        if (name === 'dungeon') {
          for (const tab of ['shop', 'bestiary', 'camp']) {
            await page.locator(`[data-dg="section"][data-id="${tab}"]`).click();
            await scan('dungeon-' + tab);
          }
          await page.locator('.dg-map-heading summary').click();
          await scan('dungeon-map-help');
          await page.locator('.dg-map-heading summary').click();
          await page.locator('[data-dg="start"]').click();
          await page.waitForSelector('.dg-option');
          await scan('dungeon-battle');
          await page.locator('.dg-arsenal-heading summary').click();
          await scan('dungeon-battle-help');
          await page.locator('.dg-arsenal-heading summary').click();
          await page.locator('.dg-monster-trait--compact summary').click();
          await scan('dungeon-monster-help');
        }
      }
      await page.evaluate(() => {
        const questions = AT.dataset.questions;
        const long = questions.filter(q => q.options.join(' ').length > 500).slice(0, 2);
        AT.startSession({ mode: 'train', ids: (long.length ? long : questions.slice(0, 2)).map(q => q.id) });
      });
      await route('run');
      await page.waitForSelector('.option');
      await scan('training-question');
      await page.locator('.option').first().click();
      await page.locator('[data-action="check"]').click();
      await scan('training-feedback');
      await page.evaluate(() => AT.startSession({ mode: 'exam', ids: AT.dataset.questions.slice(0, 20).map(q => q.id) }));
      await route('');
      await route('run');
      await page.waitForSelector('.dot-grid');
      await scan('exam-run');
      await route('');
      await page.locator('#courseToggle').click();
      await page.locator('#courseSidebar').evaluate(panel => { panel.querySelectorAll('.course-sidebar__group').forEach(group => { group.open = true; }); });
      await scan('sidebar');
      const sidebarFits = await page.evaluate(() => {
        const r = document.querySelector('#courseSidebar').getBoundingClientRect();
        const close = document.querySelector('#courseClose').getBoundingClientRect();
        return r.left >= -1 && r.right <= innerWidth + 1 && close.left >= 0 && close.right <= innerWidth;
      });
      if (!sidebarFits) failures.push(`${width}px (zoom ${zoom}): боковая панель или её кнопка закрытия за экраном`);
      await page.locator('#courseClose').click();
      if (width === 1024 && zoom === 1) {
        for (const destination of ['dungeon', 'key', 'settings']) {
          await page.locator('#courseToggle').click();
          await page.locator(`[data-sidebar-route="${destination}"]`).click();
          await page.waitForFunction(name => AT.route() === name, destination);
          const active = await page.locator(`[data-sidebar-route="${destination}"]`).getAttribute('aria-current');
          if (active !== 'page') failures.push(`Меню: не отмечен текущий раздел ${destination}`);
          if (await page.locator('#courseSidebar').isVisible()) failures.push(`Меню не закрылось после перехода в ${destination}`);
        }
      }
      await page.evaluate(() => AT.ui.toast('Длинное уведомление с важной информацией для пользователя'));
      await scan('toast');
      await page.evaluate(() => { AT.ui.confirmDialog({ title: 'Подтверждение действия', text: 'Длинное сообщение для проверки размещения диалога на узком экране. '.repeat(3) }); });
      await page.waitForSelector('.modal.is-open');
      await scan('confirmation-dialog');
      await page.locator('[data-modal="cancel"]').last().click();
      await page.waitForSelector('.modal', {state: 'detached'});
      for (const bank of ['1', '2', '3', '4', '5', '6', '7', 'credit-1', 'credit-2', 'stom-2', 'stom-3']) {
        await page.evaluate(bank => { localStorage.setItem('anatomy-colloquium-selected', bank); location.hash = '#/key'; }, bank);
        await page.reload();
        await page.waitForSelector('.key-list');
        await scan('key-bank-' + bank);
      }
      if (width === 320 && zoom === 1) {
        for (const theme of ['light', 'dark']) for (const accent of ['default', 'anime', 'rickmorty', 'breakingbad']) {
          await route('');
          await page.evaluate(({theme, accent}) => {
            document.documentElement.dataset.theme = theme;
            document.documentElement.dataset.accent = accent;
          }, {theme, accent});
          await scan(`dashboard-${theme}-${accent}`);
        }
        await page.evaluate(() => {
          const q = AT.dataset.questions[0];
          AT.annotations.toggleFavorite(q.id);
          AT.annotations.setComment(q.id, 'ДлиннаяЗаметкаБезПробелов'.repeat(6));
          AT.recordAttempt(q, false, [1]);
          AT.save(true);
        });
        for (const name of ['portfolio', 'mistakes', 'stats']) {
          await route(name);
          await scan(name + '-populated');
        }
      }
      await page.close();
      console.log(`Проверена ширина ${width}px, масштаб ${zoom}×`);
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log('Переполнений в проверенных состояниях не найдено.');
})().catch(error => { console.error(error); process.exitCode = 1; });
