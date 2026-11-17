const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const html = read('index.html');
const js = read('app.js');
const buttons = read('button-finish.css');
const sidebar = read('sidebar-only.css');
const main = read('home-rebuild.css');

test('dark finish loads after approved home and sidebar styles', () => {
  const home = html.indexOf('home-rebuild.css');
  const sidebarAt = html.indexOf('sidebar-only.css');
  const finish = html.indexOf('button-finish.css');
  assert.ok(home >= 0 && sidebarAt > home && finish > sidebarAt);
});
test('approved Today workout golden action remains distinct', () => {
  assert.match(buttons, /#home #heroStart/);
  assert.match(buttons, /background:linear-gradient\(180deg,#fff9df/);
  assert.match(main, /reference-todays-workout/);
});
test('dark button palette covers every implemented extra destination', () => {
  for (const id of ['home','workouts','library','progress','history','calendar','tracking','coaching','nutrition','settings']) {
    assert.ok(buttons.includes('#' + id + ' button'), 'missing dark buttons on ' + id);
  }
  assert.match(buttons, /--mlc-action-bottom:#071116/);
  assert.match(buttons, /--mlc-action-edge:#d5ab6b/);
});
test('sidebar has grouped navigation and dismiss controls', () => {
  for (const title of ['TRAINING','PROGRESS','DAILY TRACKING','ACCOUNT &amp; EXTRAS']) {
    assert.ok(html.includes(title), title);
  }
  for (const id of ['sidebarClose','sidebarScrim','menuBtn','homeMenuBtn','moreMenuBtn']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  assert.match(sidebar, /\.sidebar-scrim\.open/);
  assert.match(js, /sidebarScrim.*addEventListener\('click',closeSidebar\)/);
});
test('all sidebar routes point to implemented pages', () => {
  const nav = html.split('<aside class="sidebar"')[1].split('</aside>')[0];
  const pages = new Set([...html.matchAll(/<section id="([^"]+)" class="page[^"]*"/g)].map(m=>m[1]));
  for (const match of nav.matchAll(/data-page="([^"]+)"/g)) {
    assert.ok(pages.has(match[1]), 'missing section for ' + match[1]);
  }
});
test('timer and records functionality are wired to real code', () => {
  assert.match(html, /id="sidebarTimer"/);
  assert.match(js, /sidebarTimer.*addEventListener/);
  assert.match(js, /function renderCalendar\(\)/);
  assert.match(js, /function openRest\(\)/);
});
test('preview storage stays isolated from the original app', () => {
  assert.match(js, /const DEMO_KEY='mlc2-demo-workouts-v1'/);
  assert.match(js, /const AUTH_KEY='mlc2-auth-session-v1'/);
  assert.doesNotMatch(js, /fetch\([^\n]*\/rest\/v1\//);
});
