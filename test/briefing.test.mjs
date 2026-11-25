import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('every stop briefs its exact challenge questions without grading or changing progress',()=>{
 const elements=new Map();const app={innerHTML:'',querySelector(selector){if(!elements.has(selector))elements.set(selector,{});return elements.get(selector)}};
 const w={matchMedia:()=>({matches:true}),scrollTo(){},print(){}};
 const context=vm.createContext({window:w,document:{getElementById:()=>app,documentElement:{classList:{add(){}}}},localStorage:{getItem:()=>null,setItem(){throw Error('Briefing must not save progress')}},console,Date,Set,Map});
 for(const f of ['signs.js','questions.js','questions-more.js'])vm.runInContext(readFileSync(new URL('../js/'+f,import.meta.url),'utf8'),context);
 let source=readFileSync(new URL('../js/game.js',import.meta.url),'utf8');source=source.slice(0,source.indexOf('  // Boot'))+`window.briefingAudit={STOPS,roadBriefing,prepare(){Q=window.ORT_QUESTIONS;QBY=Object.fromEntries(Q.map(q=>[q.id,q]));store.profiles={test:{xp:80,best:{kapolei:2},cards:{}}};store.active='test';begin=(...args)=>{window.started=args};},progress(){return JSON.stringify(P())}};})();`;
 vm.runInContext(source,context);const a=w.briefingAudit;a.prepare();
 for(let stop=0;stop<a.STOPS.length;stop++){
  elements.clear();const questions=w.ORT_QUESTIONS.filter(q=>q.t===a.STOPS[stop].topic).slice(0,10);const ids=questions.map(q=>q.id);const before=a.progress();a.roadBriefing(stop,ids);
  assert.equal(a.progress(),before);assert.equal((app.innerHTML.match(/data-tip=/g)||[]).length,10);assert.ok(app.innerHTML.includes('Roadside briefing'));assert.ok(app.innerHTML.includes('Study sources'));
  for(const q of questions)assert.ok(app.innerHTML.includes('data-tip="'+q.id+'"'));
  elements.get('#briefing-challenge').onclick();assert.equal(w.started[0],'leg');assert.equal(w.started[2].stop,stop);assert.deepEqual([...w.started[1]].sort(),[...ids].sort());assert.equal(a.progress(),before);
 }
});
