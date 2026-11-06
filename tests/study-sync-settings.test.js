const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const pages=fs.readFileSync(require.resolve('../js/views-pages.js'),'utf8');
const sync=fs.readFileSync(require.resolve('../js/study-sync.js'),'utf8');
test('sync settings name only excluded data and retain backup and conflict protections',()=>{
  const section=pages.split('id="studySync"')[1].split('</section>')[0];
  assert.match(section,/Не синхронизируются: игра, кошелёк, награды, оформление, настройки и текущие сессии/);
  assert.doesNotMatch(section,/Прогресс, ошибки, избранное|Для надёжности/);
  assert.match(section,/Скачать учебную копию/);assert.match(section,/Восстановить учебную копию/);
  assert.match(sync,/автоматической перезаписи не будет/);
  assert.match(sync,/if\(!text && !auth\)text='Войдите через Telegram\.'/);
});
test('manual backups remain available while signed out and hide on a live authenticated session',()=>{
  const section=pages.split('id="studySync"')[1].split('</section>')[0];
  assert.match(section,/data-if-signed-out><button[^>]+data-sync="backup"/);
  assert.match(pages,/data-action="export-progress" data-if-signed-out/);
  assert.match(sync,/el\.hidden=!!auth && auth\.expiresAt>Date\.now\(\)\/1000/);
  assert.doesNotMatch(pages,/data-action="appearance-file"/);
  assert.match(pages,/id="promoForm"/);
});
