import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHost} from '../lib/index.js';
import {HOST_STRINGS} from '../lib/core.js';

function fixture() {
  const hooks=new Map(),routes=new Map(),cards=[];
  const ctx={connection:{requestRejection:req=>req.headers.cookie==='auth=test'?undefined:401},webServer:{register:r=>{routes.set(r.path,r);return ()=>routes.delete(r.path);}},on(name,fn,options){hooks.set(name,{fn,options});return ()=>hooks.delete(name);}};
  const bridge={available:true,show(event){cards.push(event);return true;},close(){},dispose(){}};
  return {ctx,hooks,routes,cards,bridge};
}
function toolCall(callId,name,arguments_) {
  return {type:'tool/call',seq:0,time:1,data:{turn:1,step:1,callId,name,arguments:arguments_}};
}
function approvalAgent(events,id='s') {
  const session={id,snapshotEvents:()=>events};
  return {id,session};
}
test('custom HTTP routes reject unauthenticated and cross-origin writes',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});
  assert.ok(f.routes.has('/__dsh/zeta-notify/state'),'authenticated state route registered');
  const server=http.createServer((req,res)=>f.routes.get(new URL(req.url,'http://localhost').pathname)?.handler(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/__dsh/zeta-notify`;
  try {
    assert.equal((await fetch(`${base}/state`)).status,401);
    assert.equal((await fetch(`${base}/settings`,{method:'POST',headers:{cookie:'auth=test',origin:'https://evil.example','content-type':'application/json'},body:'{"patch":{"enabled":false}}'})).status,403);
    assert.equal((await fetch(`${base}/settings`,{method:'POST',headers:{cookie:'auth=test','content-type':'application/json'},body:'{}'})).status,403);
    const result=await fetch(`${base}/settings`,{method:'POST',headers:{cookie:'auth=test',origin:new URL(base).origin,'content-type':'application/json'},body:'{"patch":{"events":{"planReview":false}}}'});
    assert.equal(result.status,200);
    assert.equal(host.center.snapshot().settings.events.planReview,false);
    const replay=await fetch(`${base}/answer`,{method:'GET',headers:{cookie:'auth=test'}});assert.equal(replay.status,405);
  } finally {host.dispose();await new Promise(resolve=>server.close(resolve));}
});
test('synthetic approval test stays usable without claiming a real tool operation',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});
  const server=http.createServer((req,res)=>f.routes.get(new URL(req.url,'http://localhost').pathname)?.handler(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/__dsh/zeta-notify`;
  try {
    const result=await fetch(`${base}/test`,{method:'POST',headers:{cookie:'auth=test',origin:new URL(base).origin,'content-type':'application/json'},body:'{"kind":"approval"}'});
    assert.equal(result.status,200);const event=host.center.snapshot().pending[0];
    assert.equal(event.isTest,true);assert.equal(event.callId,undefined);assert.match(event.detail,/模擬|測試/);
    host.respond({...event,decision:'rejected'});
  } finally {host.dispose();await new Promise(resolve=>server.close(resolve));}
});
test('question waterfall is owned once and returns exact native response',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});let nextCalls=0;
  const hook=f.hooks.get('user-questions/request');assert.equal(hook.options.prepend,true);
  const pending=hook.fn({agent:{id:'a',session:{id:'s'}},questions:[{id:'q',question:'choose',options:[{label:'yes'}]}]},()=>{nextCalls++;});
  const e=host.center.snapshot().pending[0];assert.ok(e);
  host.respond({id:e.id,requestId:e.requestId,token:e.token,sessionId:e.sessionId,answers:[{id:'q',selected:['yes']}]});
  assert.deepEqual(await pending,{answers:[{id:'q',selected:['yes']}]});assert.equal(nextCalls,0);host.dispose();
});
test('disabled native and helper failure delegate to official presenter, never silently approve',async()=>{
  const f=fixture();f.bridge.show=()=>false;const host=createHost(f.ctx,{bridge:f.bridge});let called=0;
  const agent=approvalAgent([toolCall('call-1','file','{"path":"a.txt"}')]);
  const value=await f.hooks.get('approval/request').fn({agent,toolName:'file',callId:'call-1',reason:'test'},async()=>{called++;return 'rejected';});
  assert.equal(called,1);assert.equal(value,'rejected');assert.equal(host.center.snapshot().pending.length,0);host.dispose();
});
test('asynchronous helper failure delegates only the still-live unanswered request',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});let called=0;
  const agent=approvalAgent([toolCall('call-1','file','{"path":"a.txt"}')]);
  const pending=f.hooks.get('approval/request').fn({agent,toolName:'file',callId:'call-1'},async()=>{called++;return 'rejected';});
  host.nativeFailure();assert.equal(await pending,'rejected');assert.equal(called,1);assert.equal(host.center.snapshot().pending.length,0);
  host.nativeFailure();assert.equal(called,1);host.dispose();
});
test('native failure after an answer and abort do not trigger a second presenter',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});let called=0;
  const agent=approvalAgent([toolCall('call-1','file','{"path":"a.txt"}'),toolCall('call-2','file','{"path":"b.txt"}')]);
  const pending=f.hooks.get('approval/request').fn({agent,toolName:'file',callId:'call-1'},async()=>{called++;return 'rejected';});
  const e=host.center.snapshot().pending[0];host.respond({...e,decision:'allowed-once'});host.nativeFailure();
  assert.equal(await pending,'allowed-once');assert.equal(called,0);
  const abort=new AbortController();const second=f.hooks.get('approval/request').fn({agent,toolName:'file',callId:'call-2',signal:abort.signal},async()=>{called++;return 'allowed-once';});
  abort.abort();host.nativeFailure();assert.equal(await second,'cancelled');assert.equal(called,0);host.dispose();
});
test('real agent identity is checked again when the user answers',async()=>{
  const f=fixture();const agent=approvalAgent([toolCall('call-1','file','{"path":"a.txt"}')]);let current=agent;
  f.ctx.agents={get:()=>current};const host=createHost(f.ctx,{bridge:f.bridge});
  const pending=f.hooks.get('approval/request').fn({agent,toolName:'file',callId:'call-1'},async()=> 'unavailable');
  const e=host.center.snapshot().pending[0];current={...agent};
  assert.throws(()=>host.respond({...e,decision:'allowed-once'}),{status:409});assert.equal(await pending,'cancelled');host.dispose();
});
test('approval card binds exact call ids and shows the matched command or original arguments',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});
  const agent=approvalAgent([
    toolCall('call-old','shell','{"command":"Remove-Item old.txt"}'),
    toolCall('call-current','shell','{"command":"Get-Content safe.txt"}'),
    toolCall('call-file','file','{ "path": "safe.txt", "line": 7 }'),
  ]);
  const pending=f.hooks.get('approval/request').fn({agent,toolName:'shell',callId:'call-current',reason:'Inspect the file'},async()=> 'unavailable');
  const event=host.center.snapshot().pending[0];
  assert.equal(event.callId,'call-current');
  assert.equal(event.detail,'Get-Content safe.txt');
  host.respond({...event,decision:'rejected'});assert.equal(await pending,'rejected');
  const generic=f.hooks.get('approval/request').fn({agent,toolName:'file',callId:'call-file'},async()=> 'unavailable');
  const genericEvent=host.center.snapshot().pending[0];assert.equal(genericEvent.detail,'{ "path": "safe.txt", "line": 7 }');
  host.respond({...genericEvent,decision:'rejected'});assert.equal(await generic,'rejected');host.dispose();
});
test('approvals without a verifiable exact call delegate to the official presenter',async()=>{
  for(const request of [
    {agent:approvalAgent([toolCall('call-1','shell','{"command":"Get-Date"}')]),toolName:'shell'},
    {agent:approvalAgent([toolCall('call-1','shell','{"command":"Get-Date"}')]),toolName:'shell',callId:'missing'},
    {agent:approvalAgent([toolCall('call-1','file','{"path":"a.txt"}')]),toolName:'shell',callId:'call-1'},
  ]) {
    const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});let called=0;
    const returned=f.hooks.get('approval/request').fn(request,async()=>{called++;return 'rejected';});
    await Promise.resolve();const pendingCount=host.center.snapshot().pending.length;host.dispose();
    const result=await returned;
    assert.equal(result,'rejected');assert.equal(called,1);assert.equal(pendingCount,0);
  }
});
test('host snapshot exposes one stable instance id per host lifetime',()=>{
  const a=fixture(),b=fixture();const first=createHost(a.ctx,{bridge:a.bridge}),second=createHost(b.ctx,{bridge:b.bridge});
  assert.equal(typeof first.snapshot().instanceId,'string');assert.ok(first.snapshot().instanceId);
  assert.equal(first.snapshot().instanceId,first.snapshot().instanceId);assert.notEqual(first.snapshot().instanceId,second.snapshot().instanceId);
  first.dispose();second.dispose();
});
test('native shown acknowledgement keeps delivered history from browser replay after failure',()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});
  const event=host.center.publish({kind:'completed',sessionId:'s',title:'Done'});assert.equal(host.center.snapshot().history[0].nativeDelivered,true);
  host.nativeAction({type:'shown',id:event.id});host.nativeFailure();
  assert.equal(host.center.snapshot().history[0].nativeDelivered,true);host.dispose();
});
test('only an unacknowledged ordinary in-flight notification becomes browser-eligible once',()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});
  host.center.publish({kind:'completed',sessionId:'s',title:'Done'});assert.equal(host.center.snapshot().history[0].nativeDelivered,true);
  host.nativeFailure();const afterFirst=host.snapshot();assert.equal(afterFirst.history[0].nativeDelivered,false);
  host.nativeFailure();assert.equal(host.snapshot().revision,afterFirst.revision);host.dispose();
});
test('resolved approval history is not replayed after a later native failure',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});
  const agent=approvalAgent([toolCall('call-1','shell','{"command":"Get-Date"}')]);
  const pending=f.hooks.get('approval/request').fn({agent,toolName:'shell',callId:'call-1'},async()=> 'unavailable');
  const event=host.center.snapshot().pending[0];host.respond({...event,decision:'rejected'});assert.equal(await pending,'rejected');
  host.nativeFailure();const history=host.center.snapshot().history;
  assert.equal(history.length,1);assert.equal(history[0].resolved,true);assert.equal(history[0].nativeDelivered,true);host.dispose();
});
test('native failure delegates a live approval once and emits a fresh browser-only reminder',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});let called=0;
  const agent=approvalAgent([toolCall('call-1','shell','{"command":"Get-Date"}')]);
  const pending=f.hooks.get('approval/request').fn({agent,toolName:'shell',callId:'call-1'},async()=>{called++;return 'rejected';});
  host.nativeFailure();assert.equal(await pending,'rejected');assert.equal(called,1);
  const history=host.center.snapshot().history;
  assert.equal(history.filter(event=>event.channel==='browser').length,1);
  assert.match(history.find(event=>event.channel==='browser').body,/DSH/);
  assert.equal(history.find(event=>event.kind==='approval').nativeDelivered,true);
  host.nativeFailure();assert.equal(called,1);host.dispose();
});
test('excluded child approvals delegate to the official presenter',async()=>{
  const f=fixture();const child={id:'s',session:{id:'s',header:{origin:'subagent'}}};
  f.ctx.agents={get:()=>child};const host=createHost(f.ctx,{bridge:f.bridge});let called=0;
  assert.equal(await f.hooks.get('approval/request').fn({agent:child,toolName:'file'},async()=>{called++;return 'rejected';}),'rejected');
  assert.equal(called,1);assert.equal(host.center.snapshot().pending.length,0);host.dispose();
});
test('jobs and goal events use the official terminal observer and operations',()=>{
  const f=fixture();let onDone;
  f.ctx.jobs={onJobDone(fn){onDone=fn;return ()=>{};}};const host=createHost(f.ctx,{bridge:f.bridge});
  onDone({id:'j',label:'build',status:'failed'},{id:'s'});
  assert.equal(host.center.snapshot().history[0].kind,'jobFailed');
  f.hooks.get('goal/changed').fn({agent:{id:'s'},change:{operation:'complete'}});
  assert.equal(host.center.snapshot().history[0].kind,'goal');host.dispose();
});
test('HTTP route and request validation errors follow the host language',async()=>{
  for(const [language,strings] of [['en',HOST_STRINGS.en],['zh',HOST_STRINGS.zh]]) {
    const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge,language});
    const server=http.createServer((req,res)=>f.routes.get(new URL(req.url,'http://localhost').pathname)?.handler(req,res));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}/__dsh/zeta-notify`,origin=new URL(base).origin;
    const post=(path,body,headers={})=>fetch(`${base}${path}`,{method:'POST',headers:{cookie:'auth=test',origin,'content-type':'application/json',...headers},body});
    const errorOf=async response=>(await response.json()).error;
    try {
      assert.equal(await errorOf(await fetch(`${base}/state`)),strings.errors.reauth);
      assert.equal(await errorOf(await fetch(`${base}/answer`,{method:'GET',headers:{cookie:'auth=test'}})),strings.errors.methodNotAllowed);
      assert.equal(await errorOf(await post('/settings','{}',{'content-type':'text/plain'})),strings.errors.jsonRequired);
      assert.equal(await errorOf(await post('/settings','not json')),strings.errors.jsonInvalid);
      assert.equal(await errorOf(await post('/settings','{"patch":{"autoApprove":true}}')),strings.errors.settingUnsupported);
      assert.equal(await errorOf(await post('/visibility','{"clientId":"c"}')),strings.errors.visibilityInvalid);
      assert.equal(await errorOf(await post('/test','{"kind":"nope"}')),strings.errors.testKindInvalid);
    } finally {host.dispose();await new Promise(resolve=>server.close(resolve));}
  }
});
test('an explicit language publishes host titles in that language',async()=>{
  for(const [language,strings] of [['en',HOST_STRINGS.en],['zh',HOST_STRINGS.zh]]) {
    const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge,language});
    f.hooks.get('goal/changed').fn({agent:{id:'s'},change:{operation:'complete'}});
    assert.equal(host.center.snapshot().history[0].title,strings.goalCompleted);
    host.nativeFailure();assert.equal(host.snapshot().native.error,strings.nativeUnavailable);
    host.dispose();
  }
});
test('automatic language follows the stored dsh locale preference and stays Chinese without one',()=>{
  for(const [preference,strings] of [['en',HOST_STRINGS.en],['zh-TW',HOST_STRINGS.zh],[undefined,HOST_STRINGS.zh]]) {
    const f=fixture();f.ctx.settings={get:ns=>ns==='locale'?(preference?{preference}:{}):undefined};
    const host=createHost(f.ctx,{bridge:f.bridge});
    f.hooks.get('goal/changed').fn({agent:{id:'s'},change:{operation:'pause'}});
    assert.equal(host.center.snapshot().history[0].title,strings.goalPaused);
    host.dispose();
  }
  const missing=fixture();const host=createHost(missing.ctx,{bridge:missing.bridge});
  missing.hooks.get('goal/changed').fn({agent:{id:'s'},change:{operation:'block'}});
  assert.equal(host.center.snapshot().history[0].title,HOST_STRINGS.zh.goalBlocked);host.dispose();
});
test('a language switch after startup localizes the next published title',()=>{
  const f=fixture();let preference='zh';
  f.ctx.settings={get:()=>({preference})};
  const host=createHost(f.ctx,{bridge:f.bridge});
  f.hooks.get('goal/changed').fn({agent:{id:'s'},change:{operation:'complete'}});
  assert.equal(host.center.snapshot().history[0].title,HOST_STRINGS.zh.goalCompleted);
  preference='en';
  f.hooks.get('goal/changed').fn({agent:{id:'s'},change:{operation:'complete'}});
  assert.equal(host.center.snapshot().history[0].title,HOST_STRINGS.en.goalCompleted);
  assert.equal(host.center.snapshot().history[1].title,HOST_STRINGS.zh.goalCompleted);
  host.dispose();
});
test('invalid native answer restores the same card for correction',async()=>{
  const f=fixture();const host=createHost(f.ctx,{bridge:f.bridge});
  const pending=f.hooks.get('user-questions/request').fn({agent:{session:{id:'s'}},questions:[{id:'q',question:'choose',options:[{label:'yes'}]}]},async()=>({answers:[]}));
  const event=host.center.snapshot().pending[0];
  host.nativeAction({...event,type:'respond',answers:[{id:'q',selected:['yes'],custom:'both'}]});
  assert.equal(f.cards.length,2);assert.equal(f.cards[1].requestId,event.requestId);assert.ok(f.cards[1].error);
  host.nativeAction({...event,type:'respond',answers:[{id:'q',selected:['yes']}]});
  assert.deepEqual(await pending,{answers:[{id:'q',selected:['yes']}]});host.dispose();
});
