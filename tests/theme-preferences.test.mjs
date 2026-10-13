import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const raw=read("lib/theme/theme-init.ts");
const script=raw.match(/export const themeInitScript = `([\s\S]*?)`;/)?.[1];
assert.ok(script,"Theme initialization script must be extractable");

function boot(saved,mediaDark=false,storageThrows=false){
  const dataset={};
  const listeners={};
  const mediaListeners={};
  const values=new Map();
  if(saved!==null)values.set("skilltwin-theme",saved);
  const media={
    matches:mediaDark,
    addEventListener(name,fn){mediaListeners[name]=fn;}
  };
  const localStorage={
    getItem(key){if(storageThrows)throw new Error("Storage denied");return values.get(key)??null;},
    setItem(key,val){values.set(key,val);}
  };
  const window={
    localStorage,matchMedia(){return media;},
    addEventListener(name,fn){listeners[name]=fn;}
  };
  runInNewContext(script,{window,document:{documentElement:{dataset}}});
  return {dataset,media,mediaListeners,listeners,values};
}

test("first paint follows saved light/dark, and invalid values become system",()=>{
  assert.equal(boot("light",true).dataset.theme,"light");
  assert.equal(boot("dark",false).dataset.theme,"dark");
  const invalid=boot("solarized",true);
  assert.equal(invalid.dataset.themePreference,"system");
  assert.equal(invalid.dataset.theme,"dark");
});

test("system responds to device changes, explicit appearance does not",()=>{
  const system=boot("system",false);
  assert.equal(system.dataset.theme,"light");
  system.media.matches=true;
  system.mediaListeners.change();
  assert.equal(system.dataset.theme,"dark");
  const light=boot("light",true);
  light.media.matches=false;light.mediaListeners.change();
  assert.equal(light.dataset.theme,"light");
});

test("other tabs synchronize, storage denial does not block rendering",()=>{
  const state=boot("dark",false);
  state.values.set("skilltwin-theme","light");
  state.listeners.storage({key:"skilltwin-theme"});
  assert.equal(state.dataset.themePreference,"light");
  assert.equal(state.dataset.theme,"light");
  assert.equal(boot(null,true,true).dataset.theme,"dark");
});

test("theme controls apply immediately without account writes",()=>{
  const control=read("components/theme/theme-switcher.tsx");
  const layout=read("app/layout.tsx");
  const themeCSS=read("app/theme.css");
  const nav=read("components/orbit/orbit-preview-nav.tsx");
  const classic=read("components/shell/app-nav.tsx");
  const orbitSettings=read("app/orbit-settings/page.tsx");
  const settings=read("app/settings/page.tsx");
  assert.match(layout,/suppressHydrationWarning/);
  assert.match(layout,/themeInitScript/);
  assert.match(control,/skilltwin-theme/);
  assert.match(control,/aria-pressed=/);
  assert.match(control,/localStorage\.setItem/);
  assert.match(control,/dataset\.theme=/);
  assert.doesNotMatch(control,/fetch\s*\(|supabase|\/api\/settings/);
  assert.match(nav,/<ThemeSwitcher compact\/>/);
  assert.match(classic,/<ThemeSwitcher compact\/>/);
  assert.match(orbitSettings,/<ThemeSwitcher\/>/);
  assert.match(settings,/<ThemeSwitcher\s*\/>/);
  assert.match(themeCSS,/html\[data-theme="light"\]/);
  assert.match(themeCSS,/html\[data-theme="dark"\]/);
  assert.match(themeCSS,/\.osw-native-content/);
  assert.match(themeCSS,/\.oh-site/);
});
