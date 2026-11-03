const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const source = fs.readFileSync(require("node:path").join(__dirname, "../app.js"), "utf8");

function app(fetch) {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML:"", textContent:"", hidden:true, disabled:false, attributes:{},
      classList:{ add() {}, remove() {}, toggle() {} },
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener() {}, querySelectorAll() { return []; },
    });
    return elements.get(selector);
  };
  const context = vm.createContext({ structuredClone, Intl, Date, fetch, document:{ querySelector:element } });
  vm.runInContext(source.slice(0, source.indexOf('\n$("#date-select").addEventListener')), context);
  return { context, element, run:(code) => vm.runInContext(code, context) };
}

test("today uses the Madison date across midnight and daylight saving time", () => {
  const { run } = app();
  assert.equal(run('campusDate(new Date("2026-11-03T02:00:00Z"))'), "2026-11-02");
  assert.equal(run('campusDate(new Date("2026-07-03T05:30:00Z"))'), "2026-07-03");
});

test("choose today instead of snapshot creation date, then nearest available future or last date", () => {
  const { run } = app();
  assert.equal(run('initialMenuDate(["2026-10-27","2026-11-03","2026-11-04"], "2026-11-03")'), "2026-11-03");
  assert.equal(run('initialMenuDate(["2026-11-02","2026-11-04"], "2026-11-03")'), "2026-11-04");
  assert.equal(run('initialMenuDate(["2026-10-27","2026-10-28"], "2026-11-03")'), "2026-10-28");
});

test("old snapshots select today and show a stale data notice", async () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone:"America/Chicago" });
  const instance = app(async () => ({ ok:true, json:async () => ({
    generatedAt:"2026-01-01T12:00:00Z", firstDate:"2026-01-01",
    dates:["2026-01-01", today], locations:[{ id:1, name:"Market", menus:{} }],
  }) }));
  await instance.run("loadMenus()");
  assert.equal(instance.run("state.date"), today);
  assert.equal(instance.element("#menu-notice").hidden, false);
  assert.match(instance.element("#data-status").textContent, /Updated/);
});

test("missing or empty snapshots finish loading and provide retry instead of crashing", async () => {
  for (const fetch of [
    async () => { throw new Error("offline"); },
    async () => ({ ok:false }),
    async () => ({ ok:true, json:async () => ({ dates:[], locations:[] }) }),
  ]) {
    const instance = app(fetch);
    await instance.run("loadMenus()");
    assert.equal(instance.run("state.data"), null);
    assert.equal(instance.element("#hall-list").attributes["aria-busy"], "false");
    assert.match(instance.element("#hall-list").innerHTML, /Try again/);
    assert.equal(instance.element("#next-day").disabled, true);
    assert.equal(instance.element("#previous-day").disabled, true);
  }
});
