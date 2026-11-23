import test from 'node:test';
import assert from 'node:assert/strict';

/** A DOM-less smoke harness for environments where automated browser navigation is blocked. */
test('app loads, switches demo identities, renders manager and profile pages',async()=>{
 const storage=new Map(), elements=new Map();
 const elt=id=>{
   if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){}},
     handlers:{},setAttribute(){},addEventListener(type,fn){this.handlers[type]=fn;},
     querySelector(){return null;}});
   return elements.get(id);
 };
 const navButtons=()=>{
   const html=elt('#desktop-nav').innerHTML;
   const ids=[...html.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]);
   return ids.map(page=>({dataset:{page},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},click(){this.handlers.click?.();}}));
 };
 let currentNav=[];
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v)};
 globalThis.window={scrollTo(){},matchMedia(){return {matches:true}}};
 globalThis.document={querySelector:selector=>elt(selector),querySelectorAll:selector=>{
   if(selector==='[data-page]')return currentNav;
   return [];
 }};
 // Render re-generates the navigation. Rebuild its simulated buttons before each interaction.
 await import('../public/app.js?ui-test=1');
 assert.match(elt('#main').innerHTML,/Every presence counts/);
 assert.match(elt('#desktop-nav').innerHTML,/data-page="manager"/);
 const role=elt('#role');
 role.handlers.change({target:{value:'member'}});
 assert.doesNotMatch(elt('#desktop-nav').innerHTML,/data-page="manager"/);
 elt('#profile-shortcut').handlers.click();
 assert.match(elt('#main').innerHTML,/My profile/);
 assert.match(elt('#main').innerHTML,/Attendance and leave requests/);
 role.handlers.change({target:{value:'director'}});
 assert.match(elt('#main').innerHTML,/Level 3 manager/);
 assert.match(elt('#desktop-nav').innerHTML,/data-page="manager"/);
 // Since controls are recreated during render, use a live selector shim to trigger navigation.
 const origQuery=globalThis.document.querySelectorAll;
 globalThis.document.querySelectorAll=selector=>{
   if(selector==='[data-page]'){
     currentNav=navButtons();
     return currentNav;
   }
   return origQuery(selector);
 };
 role.handlers.change({target:{value:'lead'}});
 currentNav.find(x=>x.dataset.page==='manager').click();
 assert.match(elt('#main').innerHTML,/Approval inbox/);
 assert.match(elt('#main').innerHTML,/Assigned team only/);
 assert.doesNotMatch(elt('#main').innerHTML,/id="assignment-form"/);
 role.handlers.change({target:{value:'operations'}});
 assert.match(elt('#main').innerHTML,/id="assignment-form"/);
 assert.match(elt('#main').innerHTML,/View audit activity/);
 role.handlers.change({target:{value:'director'}});
 assert.match(elt('#main').innerHTML,/id="target-form"/);
 // Level 2 selects Nova; attendance must show the selected team, not Orion.
 elt('#manager-team-filter').handlers.change({target:{value:'Nova'}});
 currentNav.find(x=>x.dataset.page==='attendance').click();
 assert.match(elt('#main').innerHTML,/Team Nova/);
 assert.doesNotMatch(elt('#main').innerHTML,/Customer Support Specialist · Team Orion/);
 delete globalThis.document;delete globalThis.window;delete globalThis.localStorage;
});
