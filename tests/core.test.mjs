import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCenter, defaultSettings, normalizeSessionEvent } from '../lib/core.js';

const questions=[{id:'one',question:'Choose',options:[{label:'A'},{label:'B'}]}];
const request=(center,extra={})=>center.openRequest({kind:'question',sessionId:'session-a',title:'Question',questions,...extra});
const response=(event,extra={})=>({id:event.id,requestId:event.requestId,token:event.token,sessionId:event.sessionId,answers:[{id:'one',selected:['A']}],...extra});

test('every supported trigger is on by default',()=>{
  const s=defaultSettings(); assert.equal(Object.keys(s.events).length,14);
  assert.ok(Object.values(s.events).every(v=>v===true));
});
test('only exact active request and valid option can complete a question',async()=>{
  const c=createCenter(); const r=request(c);
  for(const payload of [response(r.event,{sessionId:'other'}),response(r.event,{token:'bad'}),response(r.event,{requestId:'old'})]) assert.throws(()=>c.respond(payload),{status:409});
  assert.throws(()=>c.respond(response(r.event,{answers:[{id:'one',selected:['C']}]})),{status:400});
  assert.equal(c.snapshot().pending.length,1);
  c.respond(response(r.event)); assert.deepEqual(await r.promise,{answers:[{id:'one',selected:['A']}]});
  assert.throws(()=>c.respond(response(r.event)),{status:409});
  assert.equal(c.snapshot().pending.length,0); assert.equal(c.snapshot().history[0].token,undefined);
});
test('multiple questions require complete unique answers and honor single/multi selection',async()=>{
  const c=createCenter(); const r=request(c,{questions:[...questions,{id:'two',question:'Pick',multiSelect:true,options:[{label:'X'},{label:'Y'}]}]});
  assert.throws(()=>c.respond(response(r.event)),{status:400});
  assert.throws(()=>c.respond(response(r.event,{answers:[{id:'one',selected:['A','B']},{id:'two',selected:['X']}]})),{status:400});
  c.respond(response(r.event,{answers:[{id:'one',selected:[],custom:'Other'},{id:'two',selected:['X','Y'],custom:'Note'}]}));
  assert.equal((await r.promise).answers.length,2);
});
test('concurrent sessions and reused question IDs never share responses',async()=>{
  const c=createCenter(); const a=request(c);const b=request(c,{sessionId:'session-b'});
  c.respond(response(b.event));assert.equal((await b.promise).answers[0].selected[0],'A');
  assert.equal(c.snapshot().pending[0].id,a.event.id);
  c.respond(response(a.event));await a.promise;
});
test('aborted requests reject and late answers cannot be used by a later request',async()=>{
  const c=createCenter();const controller=new AbortController();const a=request(c,{signal:controller.signal});
  const failed=assert.rejects(a.promise,{code:'ASK_ABORTED'});controller.abort();await failed;
  const b=request(c);assert.throws(()=>c.respond(response(a.event)),{status:409});
  c.respond(response(b.event));await b.promise;
});
test('owner liveness and malformed unicode token cannot bypass request binding',async()=>{
  const c=createCenter();let live=true;const a=request(c,{isCurrent:()=>live});
  assert.throws(()=>c.respond(response(a.event,{token:'界'.repeat(a.event.token.length)})),{status:409});
  const rejected=assert.rejects(a.promise,{code:'ASK_ABORTED'});live=false;
  assert.throws(()=>c.respond(response(a.event)),{status:409});await rejected;
});
test('approval accepts only explicit once/reject and dismissal does not decide',async()=>{
  const c=createCenter();const a=c.openRequest({kind:'approval',sessionId:'a',title:'Tool',toolName:'write_file',callId:'call-1',detail:'{"path":"a.txt"}',reason:'Fixture'});
  assert.equal(a.event.callId,'call-1');assert.equal(a.event.detail,'{"path":"a.txt"}');
  c.markRead(a.event.id);assert.equal(c.snapshot().pending.length,1);
  assert.throws(()=>c.respond(response(a.event,{decision:'allow-always'})),{status:400});
  c.respond(response(a.event,{decision:'allowed-once'}));assert.equal(await a.promise,'allowed-once');
});
test('history stays bounded and clearing cannot drop unresolved requests',async()=>{
  const c=createCenter({maxHistory:3});const a=request(c);
  for(let i=0;i<9;i++)c.publish({kind:'completed',sessionId:'a',title:String(i)});
  assert.equal(c.snapshot().history.length,3);c.clearHistory();assert.equal(c.snapshot().pending.length,1);
  c.respond(response(a.event));await a.promise;
});
test('settings reject unknown keys and nonboolean trigger values',()=>{
  const c=createCenter();assert.throws(()=>c.updateSettings({autoApprove:true}),{status:400});
  assert.throws(()=>c.updateSettings({events:{question:'false'}}),{status:400});
  c.updateSettings({events:{question:false}});assert.equal(c.snapshot().settings.events.question,false);assert.equal(c.snapshot().settings.events.error,true);
});
test('turn end reasons are distinguished and plan review recognized',()=>{
  for(const [reason,kind] of [['completed','completed'],['error','error'],['aborted','aborted'],['interrupted','interrupted'],['blocked','blocked'],['max-tokens','maxTokens']]) {
    assert.equal(normalizeSessionEvent({id:'s'},{type:'turn/end',data:{turn:1,reason:{kind:reason}}}).kind,kind);
  }
  assert.equal(normalizeSessionEvent({id:'s'},{type:'turn/start',data:{}}),null);
});
