/** Browser regression checks using real Play templates/CSS and mocked Foundry storage. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { ROOT } from "./project-utils.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const template = readFileSync(join(ROOT, "templates/companion.hbs"), "utf8");
const shellStart = template.slice(0, template.indexOf('{{!-- DASHBOARD'));
const playStart = template.indexOf('<section class="nd-workspace nd-play"');
const playEnd = template.indexOf('{{!-- CAMPAIGN —', playStart);
const playMarkup = template.slice(playStart, playEnd).replace('aria-label="Play workspace" hidden', 'aria-label="Play workspace"');
const shell = (shellStart + playMarkup + '</div></div></div>').replace(/{{!--[\s\S]*?--}}/g, '');
const styles = JSON.parse(readFileSync(join(ROOT, "module.json"))).styles;
const html = `<!doctype html><html><head><meta charset="utf-8">${styles.map(s => `<link rel="stylesheet" href="/${s}">`).join("")}
<style>body{margin:0;background:#141619}#nd-companion-app{height:100vh}#fixture{height:100%}.nd-workspace-region{min-width:0}</style></head>
<body><div id="nd-companion-app"><main id="fixture" class="nd-companion">${shell}</main></div></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/test-relay.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280"><rect width="600" height="280" fill="#192d39"/><g fill="none" stroke="#79b8d0" stroke-width="3"><circle cx="300" cy="125" r="67"/><circle cx="300" cy="125" r="32"/><path d="M70 125h163m134 0h163M300 20v38m0 134v38M125 60l110 35m130 60l110 35"/></g><g fill="#b9d5db" font-family="sans-serif" text-anchor="middle"><text x="300" y="132" font-size="18">CORE</text><text x="300" y="260" font-size="15">IZZET RELAY · SAMPLE REFERENCE</text></g></svg>'); return;
  }
  if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); return; }
  const path = resolve(ROOT, `.${decodeURIComponent(req.url.split("?")[0])}`);
  if (!path.startsWith(resolve(ROOT) + sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : "text/css");
    res.end(readFileSync(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const { Playbook } = await import("/scripts/playbook.js");
    const { PlaybookService } = await import("/scripts/playbook-service.js");
    const { CompanionStorage } = await import("/scripts/storage.js");
    const { SessionService } = await import("/scripts/session-service.js");
    const { CampaignDocument } = await import("/scripts/campaign-document.js");
    const { CampaignActivityService } = await import("/scripts/campaign-activity-service.js");
    const { QuestEntryService } = await import("/scripts/quest-entry-service.js");
    const { LiveNotes } = await import("/scripts/live-notes.js");
    const { QuestCards } = await import("/scripts/quest-cards.js");
    const { QuestImages } = await import("/scripts/quest-images.js");
    const { ContextSerializer } = await import("/scripts/context-serializer.js");
    window.ui = { notifications: { error: message => { window.lastNotice = message; }, info: message => { window.lastInfo = message; } } };
    window.game = { user: { isGM: true }, users: [{id:"gm",active:true,isGM:true},{id:"player",active:true,isGM:false},{id:"offline",active:false,isGM:false}], world: { title: "Ravnica" } };
    window.shared = []; window.previews = [];
    class Picker {
      constructor(options) { window.pickerOptions = options; }
      render() { return this; }
    }
    class Popout {
      constructor(options) { this.options = options; }
      render() { window.previews.push(this.options); return Promise.resolve(this); }
      shareImage(options) { window.shared.push(options); }
    }
    window.foundry = { utils: { duplicate: value => structuredClone(value), randomID: () => crypto.randomUUID() }, applications: { apps: { FilePicker: { implementation: Picker }, ImagePopout: Popout } } };
    const root = document.querySelector("#fixture");
    window.stored = { currentIndex: 0, beats: [
      { id: "a", title: "Resonance Leak", sourceStoryEntryId: "quest-a" },
      { id: "b", title: "The courier's trail", speechNotes: "<p>A second quest.</p>" }
    ] };
    CompanionStorage.getPlaybook = () => structuredClone(window.stored);
    CompanionStorage.setPlaybook = async value => { window.stored = structuredClone(value); };
    CompanionStorage.setCampaign = async value => {
      if (window.failSave) throw new Error("Simulated storage failure");
      if (window.holdSave) await new Promise(r => { window.releaseSave = r; });
      window.campaignStored = structuredClone(value);
    };
    CompanionStorage.getAutoCollapseEmptySections = () => window.autoCollapse !== false;
    SessionService.syncActiveBeatIds = async () => {};
    SessionService.getActive = () => null;
    SessionService.list = () => [];
    const { ContextEngine } = await import('/scripts/context-engine.js');
    ContextEngine.getPlayContext = () => ({ activeStoryThreads: [] });
    CampaignActivityService.edited = () => {};
    const content = '<ul><li>Professor Fiznap sends Frikka to investigate a damaged Izzet relay.</li><li>Spells cast nearby are being stored and randomly discharged later.</li><li>Objective:<ul><li>Stabilize the relay</li><li>Recover the resonance core</li></ul></li><li>Reward:<ul><li>Renown</li><li>Access to a useful Izzet component</li></ul></li><li>Good for showing Frikka can solve problems instead of merely creating municipal ones.</li></ul>';
    await CampaignDocument.update(doc => { doc.storyEntries = [CampaignDocument.normalizeQuestEntry({ id: "quest-a", title: "Resonance Leak", speechNotes: content })]; });
    PlaybookService.reload();
    window.testApi = { Playbook, PlaybookService, LiveNotes, QuestCards, QuestImages, QuestEntryService, CampaignDocument, ContextSerializer, root };
    window.paint = () => Playbook.paint(root, Playbook.get());
    window.select = async index => { await PlaybookService.setCurrentIndex(index); paint(); };
    window.flush = () => LiveNotes.flushAll(root);
    root.querySelector('[data-workspace="dashboard"]').classList.remove('is-active');
    root.querySelector('[data-workspace="dashboard"]').setAttribute('aria-pressed', 'false');
    root.querySelector('[data-workspace="play"]').classList.add('is-active');
    root.querySelector('[data-workspace="play"]').setAttribute('aria-pressed', 'true');
    Playbook.attach(root); paint();
  });
  const card = id => page.locator(`details[data-playbook-field-block="${id}"]`);
  const open = id => card(id).evaluate(el => el.open);
  const source = "legacy-speechNotes";
  assert.equal(await card(source).count(), 1, "legacy content remains available");
  assert.equal(await open(source), true);
  const title = card(source).locator('[data-card-title]');
  await title.fill("Professor Fiznap’s request");
  assert.equal(await open(source), true, "editing a title does not toggle the card");
  await page.locator('[data-quest-title]').fill("Resonance Leak — Frikka");
  await page.evaluate(() => flush());
  assert.equal(await page.evaluate(() => campaignStored.storyEntries[0].title), "Resonance Leak — Frikka");
  assert.equal(await page.evaluate(() => campaignStored.storyEntries[0].cards[0].title), "Professor Fiznap’s request");
  assert.equal(await page.evaluate(() => campaignStored.storyEntries[0].cards[0].body), "", "legacy body is linked, not duplicated");

  await card(source).locator('.nd-quest-card__tools > summary').click();
  await card(source).locator('[data-card-split]').click();
  await page.waitForFunction(() => document.querySelectorAll('.nd-quest-card').length === 5);
  assert.equal(await page.evaluate(() => testApi.QuestCards.forBeat(testApi.Playbook.get().beat)[2].body.includes("Stabilize the relay")), true);
  assert.equal(await page.evaluate(() => testApi.QuestCards.forBeat(testApi.Playbook.get().beat)[2].body.includes("Recover the resonance core")), true, "nested objectives stay together");
  assert.equal(await page.evaluate(() => testApi.QuestCards.forBeat(testApi.Playbook.get().beat).filter(c => !c.title).length), 4, "split cards have editable blank titles");
  await page.evaluate(async () => {
    const labels = ["Professor Fiznap’s request", "The relay malfunction", "Objectives", "Rewards", "GM notes"];
    const cards = testApi.QuestCards.forBeat(testApi.Playbook.get().beat);
    for (let i = 0; i < cards.length; i++) await testApi.PlaybookService.updateCard("a", cards[i].id, { title: labels[i] });
    paint();
  });

  await page.locator('[data-quest-add]').click();
  await page.waitForFunction(() => document.querySelectorAll('.nd-quest-card').length === 6);
  const added = await page.evaluate(() => testApi.QuestCards.forBeat(testApi.Playbook.get().beat).at(-1).id);
  assert.equal(await card(added).locator('[data-card-title]').textContent(), "");
  assert.equal(await card(added).locator('[data-card-body]').textContent(), "");
  assert.equal(await open(added), true, "new card opens for editing");
  await card(added).locator('[data-card-title]').fill("Relay illustration");
  await card(added).locator('[data-card-body]').fill("Keep this draft while switching quests.");
  await page.evaluate(() => {
    const editor = document.activeElement; const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
    getSelection().removeAllRanges(); getSelection().addRange(range); window.selectionNode = getSelection().anchorNode;
    paint();
  });
  assert.equal(await page.evaluate(() => getSelection().anchorNode === selectionNode), true);
  await page.evaluate(() => { testApi.root.hidden = true; paint(); testApi.root.hidden = false; });
  assert.match(await card(added).locator('[data-card-body]').textContent(), /Keep this draft/);
  await page.evaluate(() => select(1));
  await page.waitForFunction(() => document.querySelector('[data-quest-title]').dataset.playBeatId === "b");
  await page.evaluate(() => select(0));
  assert.match(await card(added).locator('[data-card-body]').textContent(), /Keep this draft/);
  await card(added).locator('[data-card-toggle]').click();
  await page.evaluate(() => { paint(); paint(); });
  assert.equal(await open(added), false);
  await page.evaluate(() => select(1)); await page.evaluate(() => select(0));
  assert.equal(await open(added), false, "choice restored across quests");
  await card(added).locator(':scope > summary').focus(); await page.keyboard.press("Enter");
  assert.equal(await open(added), true, "keyboard expands card");
  await page.keyboard.press("Space"); assert.equal(await open(added), false);
  await card(added).locator('[data-card-toggle]').click();

  // Removal is reversible, and removing a card never deletes an uploaded file.
  await card(added).locator('[data-card-remove]').click();
  await page.waitForFunction(id => !document.querySelector(`[data-playbook-field-block="${id}"]`), added);
  await page.getByRole('button', { name: "Restore removed card" }).click();
  await page.waitForFunction(id => document.querySelector(`[data-playbook-field-block="${id}"]`), added);
  assert.match(await card(added).locator('[data-card-body]').textContent(), /Keep this draft/);

  // Picker callback attaches only to its original quest, even after navigation.
  await card(added).locator('[data-card-image]').click();
  await page.waitForFunction(() => window.pickerOptions);
  assert.equal(await page.evaluate(() => pickerOptions.type), "image");
  await page.evaluate(() => select(1));
  await page.evaluate(() => pickerOptions.callback("/test-relay.svg"));
  assert.equal(await page.evaluate(() => shared.length), 0, "upload/select does not share");
  await page.evaluate(() => select(0));
  assert.equal(await card(added).locator('img').getAttribute('src'), "/test-relay.svg");
  await card(added).getByRole('button', {name:"Preview image privately"}).click();
  await page.waitForFunction(() => previews.length === 1);
  assert.equal(await page.evaluate(() => shared.length), 0);
  await card(added).locator('[data-card-share]').click();
  await page.waitForFunction(() => shared.length === 1);
  assert.deepEqual(await page.evaluate(() => shared[0]), { image: "/test-relay.svg", title: "Quest image", showTitle: false, users: ["player"] });
  await page.evaluate(() => { game.user.isGM = false; });
  await card(added).locator('[data-card-share]').click();
  await page.waitForFunction(() => window.lastNotice?.includes("Only a GM"));
  assert.equal(await page.evaluate(() => shared.length), 1);
  await page.evaluate(() => { game.user.isGM = true; game.users[1].active = false; });
  await card(added).locator('[data-card-share]').click();
  await page.waitForFunction(() => window.lastInfo?.includes("No players"));
  assert.equal(await page.evaluate(() => shared.length), 1);
  await page.evaluate(() => { game.users[1].active = true; });
  assert.equal(await page.evaluate(() => testApi.QuestCards.imagePath('javascript:alert(1)')), "");
  assert.equal(await page.evaluate(() => testApi.QuestCards.imagePath('data:image/svg+xml,bad')), "");

  // Failed and delayed writes retain their draft, and recover without rebinding.
  const body = card(added).locator('[data-card-body]');
  await body.fill("Draft retained after save failure");
  await page.evaluate(async () => { window.failSave = true; await testApi.PlaybookService.setCurrentIndex(1); window.lastNotice = null; paint(); });
  await page.waitForFunction(() => window.lastNotice?.includes("Could not save"));
  assert.equal(await body.textContent(), "Draft retained after save failure");
  await page.evaluate(async () => { window.failSave = false; await flush(); paint(); });
  await page.evaluate(() => select(0));
  await body.fill("Draft during slow storage");
  await page.evaluate(() => { window.holdSave = true; window.pendingFlush = flush(); });
  await page.waitForFunction(() => typeof releaseSave === "function");
  await page.evaluate(() => paint());
  assert.equal(await body.textContent(), "Draft during slow storage");
  await body.fill("Latest revision during slow storage");
  await page.evaluate(async () => { window.holdSave = false; releaseSave(); await pendingFlush; });
  assert.equal(await page.evaluate(id => campaignStored.storyEntries[0].cards.find(card => card.id === id).body, added), "Latest revision during slow storage");

  // Normalization/export keeps cards, and an intentionally empty list stays empty.
  assert.equal(await page.evaluate(() => testApi.CampaignDocument.normalizeQuestEntry(campaignStored.storyEntries[0]).cards.length), 6);
  assert.deepEqual(await page.evaluate(() => testApi.QuestCards.forBeat({speechNotes:"old content",cards:[]})), []);
  assert.match(await page.evaluate(() => testApi.ContextSerializer.serializeEntity({
    questCards: testApi.QuestCards.forEntry(campaignStored.storyEntries[0])
  }, { maxChars: 50000 }).markdown), /Recover the resonance core/);
  await page.evaluate(async () => {
    const before = campaignStored.storyEntries[0].speechNotes;
    await testApi.QuestEntryService.update("quest-a", { speechNotes: "<p>Changed from the Campaign editor.</p>" }); paint();
    window.linkedBody = document.querySelector('[data-playbook-field-block="legacy-speechNotes"] [data-card-body]').textContent;
    await testApi.QuestEntryService.update("quest-a", { speechNotes: before });
    await testApi.CampaignDocument.update(doc => { doc.storyEntries = campaignStored.storyEntries.map(entry => testApi.CampaignDocument.normalizeQuestEntry(entry)); });
    testApi.PlaybookService.reload(); paint();
  });
  assert.equal(await page.evaluate(() => linkedBody), "Changed from the Campaign editor.");
  assert.equal(await card(added).locator('img').getAttribute('src'), "/test-relay.svg", "image survives normalization and reload");
  await page.evaluate(async () => {
    document.activeElement?.blur();
    await testApi.PlaybookService.updateCard("a", window.testApi.QuestCards.forBeat(testApi.Playbook.get().beat).at(-1).id, { body: "<p>A reference image to show when the party reaches the relay.</p>" }); paint();
  });
  const rightId = await page.evaluate(() => testApi.QuestCards.forBeat(testApi.Playbook.get().beat).find(c => c.column === 1).id);
  const before = await card(rightId).boundingBox();
  await card(source).locator('[data-card-toggle]').click();
  const after = await card(rightId).boundingBox();
  assert.equal(after.x, before.x); assert.equal(after.y, before.y);
  await card(source).locator('[data-card-toggle]').click();
  const shots = process.env.ND_TEST_SCREENSHOTS;
  await page.locator('[data-cards-collapse]').click();
  assert.equal(await page.locator('.nd-quest-card[open]').count(), 0);
  await page.evaluate(() => paint());
  assert.equal(await page.locator('.nd-quest-card[open]').count(), 0, "collapse all survives repaint");
  await page.locator('[data-cards-expand]').click();
  assert.equal(await page.locator('.nd-quest-card[open]').count(), await page.locator('.nd-quest-card').count());
  assert.equal(await page.locator('[data-card-toggle]').first().evaluate(el => getComputedStyle(el, '::after').content), '\"\"', "chevron must not retain the old Collapse label");
  // Exercise the real sidebar, including the save boundary before navigation.
  await card(added).locator('[data-card-body]').fill('Sidebar navigation draft');
  await page.locator('button[data-play-beat-id="b"]').click();
  await page.waitForFunction(() => testApi.Playbook.get().beat.id === 'b');
  await page.locator('button[data-play-beat-id="a"]').click();
  await page.waitForFunction(() => testApi.Playbook.get().beat.id === 'a');
  assert.equal(await card(added).locator('[data-card-body]').textContent(), 'Sidebar navigation draft');
  await page.evaluate(() => { window.failSave = true; });
  await card(added).locator('[data-card-body]').fill('Unsaved sidebar draft');
  await page.locator('button[data-play-beat-id="b"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-playbook]').dataset.questNavigationBusy);
  assert.equal(await page.evaluate(() => testApi.Playbook.get().beat.id), 'a', 'failed save blocks sidebar navigation');
  assert.equal(await card(added).locator('[data-card-body]').textContent(), 'Unsaved sidebar draft');
  await page.evaluate(async () => { window.failSave = false; await flush(); });
  await card(added).locator('[data-card-body]').fill('A reference image to show when the party reaches the relay.');
  await page.evaluate(() => flush());
  await page.locator('[data-play-add-quest]').click();
  await page.waitForFunction(() => testApi.Playbook.get().total === 3);
  assert.equal(await page.locator('.nd-play-quest-row').count(), 3);
  await page.locator('button[data-play-beat-id="a"]').click();
  await page.waitForFunction(() => testApi.Playbook.get().beat.id === 'a');
  const layout = await page.evaluate(() => ({
    nav: document.querySelector('.nd-app-nav').getBoundingClientRect().right,
    rail: document.querySelector('.nd-play-rail').getBoundingClientRect().right,
    main: document.querySelector('.nd-play-content').getBoundingClientRect().left,
    background: getComputedStyle(document.querySelector('.nd-play')).backgroundColor
  }));
  assert.ok(layout.nav < layout.rail && layout.rail <= layout.main, 'three-column desktop layout');
  assert.equal(layout.background, 'rgb(20, 22, 25)');
  if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: join(shots, "quest-cards-wide.png"), fullPage: true }); }
  await page.setViewportSize({ width: 520, height: 1050 });
  assert.equal((await card(source).boundingBox()).x, (await card(rightId).boundingBox()).x);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (shots) await page.screenshot({ path: join(shots, "quest-cards-narrow.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: legacy links; editable quest/card titles; split nested bullets; blank cards; autosave; beat/workspace switches; caret; keyboard; removal/undo; image picker, preview and explicit sharing; GM/recipient checks; failed/delayed saves; normalization; responsive stable stacks.");
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
