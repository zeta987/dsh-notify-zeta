import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';

export const EVENT_LABELS = Object.freeze({completed:'任務完成',error:'執行失敗',aborted:'任務已中止',interrupted:'任務遭中斷',blocked:'任務受到阻塞',maxTokens:'已達輸出上限',approval:'等待批准',question:'等待回答',planReview:'等待計畫審閱',compaction:'上下文壓縮完成',jobCompleted:'背景工作完成',jobFailed:'背景工作失敗',jobKilled:'背景工作已停止',goal:'目標狀態更新'});
export function defaultSettings() {
  return {enabled:true,native:true,browser:true,sound:true,backgroundOnly:true,preview:true,includeSubagents:false,events:Object.fromEntries(Object.keys(EVENT_LABELS).map(k=>[k,true]))};
}
export function failure(message,status=400,code) { return Object.assign(new Error(message),{status,...(code?{code}: {})}); }
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>structuredClone(value);
function text(value,max=16000) { return typeof value==='string'?value.slice(0,max):''; }
export function validateSettings(patch,current=defaultSettings()) {
  if(!record(patch))throw failure('設定必須是物件');
  const next=clone(current);
  for(const [key,value] of Object.entries(patch)) {
    if(key==='events') {
      if(!record(value))throw failure('事件設定無效');
      for(const [kind,enabled] of Object.entries(value)) {
        if(!Object.hasOwn(EVENT_LABELS,kind)||typeof enabled!=='boolean')throw failure('事件開關無效');
        next.events[kind]=enabled;
      }
    } else {
      if(!Object.hasOwn(defaultSettings(),key)||typeof value!=='boolean')throw failure('不支援的設定');
      next[key]=value;
    }
  }
  return next;
}
function validateQuestions(questions) {
  if(!Array.isArray(questions)||questions.length<1||questions.length>20)throw failure('問題數量不支援');
  const seen=new Set();
  for(const q of questions) {
    if(!record(q)||typeof q.id!=='string'||!q.id||q.id.length>512||seen.has(q.id)||typeof q.question!=='string')throw failure('問題格式無效');
    seen.add(q.id);
    if(q.options!==undefined&&(!Array.isArray(q.options)||q.options.length>100||q.options.some(o=>!record(o)||typeof o.label!=='string'||!o.label)))throw failure('選項格式無效');
    const labels=(q.options??[]).map(o=>o.label);
    if(new Set(labels).size!==labels.length)throw failure('選項不得重複');
    if(q.intent&&(q.intent.kind!=='plan-review'||!(q.options??[]).some(o=>o.label===q.intent.approve)||typeof q.detail!=='string'))throw failure('計畫審閱格式無效');
  }
  if(Buffer.byteLength(JSON.stringify(questions))>96000)throw failure('問題內容超過通知中心限制');
  return clone(questions);
}
export function validateAnswers(questions,answers) {
  if(!Array.isArray(answers)||answers.length!==questions.length)throw failure('請回答每一道問題');
  const byId=new Map();
  for(const answer of answers) {
    if(!record(answer)||typeof answer.id!=='string'||byId.has(answer.id))throw failure('回答識別碼無效');
    byId.set(answer.id,answer);
  }
  return questions.map(q=>{
    const a=byId.get(q.id);
    if(!a||!Array.isArray(a.selected)||a.selected.some(s=>typeof s!=='string')||new Set(a.selected).size!==a.selected.length)throw failure('回答選项無效');
    const allowed=new Set((q.options??[]).map(o=>o.label));
    if(a.selected.some(s=>!allowed.has(s)))throw failure('回答包含未知選項');
    if(a.custom!==undefined&&typeof a.custom!=='string')throw failure('自由回答必須是文字');
    const custom=a.custom?.trim();
    if(custom?.length>16000)throw failure('自由回答超過 16000 字元');
    if(!a.selected.length&&!custom)throw failure('請選擇選項或輸入回答');
    if(!q.multiSelect&&(a.selected.length>1||(a.selected.length&&custom)))throw failure('單選問題只能選一項或填寫自由回答');
    return {id:q.id,selected:[...a.selected],...(custom?{custom}: {})};
  });
}
function matches(left,right) {
  if(typeof left!=='string'||typeof right!=='string'||left.length!==right.length)return false;
  const a=Buffer.from(left),b=Buffer.from(right);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export function createCenter({settings,clock=Date.now,maxHistory=200,onChange=()=>{},onDeliver=()=>{},onSettle=()=>{}}={}) {
  let preferences=settings?validateSettings(settings):defaultSettings();
  let revision=0,history=[];
  const pending=new Map();
  const emit=()=>{revision++;onChange();};
  const api={
    snapshot(){return {revision,settings:clone(preferences),history:clone(history),pending:[...pending.values()].map(p=>clone(p.event))};},
    updateSettings(patch){preferences=validateSettings(patch,preferences);emit();return clone(preferences);},
    publish(input){
      if(!Object.hasOwn(EVENT_LABELS,input.kind))throw failure('通知類型無效');
      const event={id:randomUUID(),sessionId:text(input.sessionId,512),kind:input.kind,title:text(input.title||EVENT_LABELS[input.kind],512),body:text(input.body,4000),createdAt:clock(),read:false,...(input.isTest?{isTest:true}:{}),...(input.channel?{channel:input.channel}:{}),...(input.origin?{origin:input.origin}:{})};
      if(input.detail)event.detail=text(input.detail,32000);
      history.unshift(event);history=history.slice(0,maxHistory);
      if(preferences.enabled&&preferences.events[event.kind]&&(preferences.includeSubagents||event.origin!=='subagent'))onDeliver(event,clone(preferences));
      emit();return event;
    },
    openRequest(input){
      if(pending.size>=32)throw failure('待處理請求已達上限',503);
      if(input.signal?.aborted)throw failure('問題已取消',409,'ASK_ABORTED');
      if(!['question','planReview','approval'].includes(input.kind)||typeof input.sessionId!=='string'||!input.sessionId)throw failure('互動請求無效');
      const questions=input.kind==='approval'?undefined:validateQuestions(input.questions);
      const event={id:randomUUID(),requestId:randomUUID(),token:randomBytes(24).toString('hex'),sessionId:input.sessionId,kind:input.kind,title:text(input.title||EVENT_LABELS[input.kind],512),body:text(input.body,4000),createdAt:clock(),read:false,...(questions?{questions}:{}),...(input.toolName?{toolName:text(input.toolName,512)}:{}),...(input.callId?{callId:text(input.callId,512)}:{}),...(input.reason?{reason:text(input.reason,32000)}:{}),...(input.detail?{detail:text(input.detail,32000)}:{}),...(input.isTest?{isTest:true}:{}),...(input.origin?{origin:input.origin}:{})};
      let resolve,reject;
      const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
      const abort=()=>api.cancel(event.id,'問題已取消');
      pending.set(event.id,{event,resolve,reject,signal:input.signal,abort,isCurrent:input.isCurrent});
      input.signal?.addEventListener('abort',abort,{once:true});
      const safe={...event};delete safe.token;delete safe.questions;
      history.unshift(safe);history=history.slice(0,maxHistory);
      if(preferences.enabled&&preferences.events[event.kind])onDeliver(event,clone(preferences));
      safe.nativeDelivered=Boolean(event.nativeDelivered);
      emit();return {event,promise};
    },
    respond(payload){
      if(!record(payload))throw failure('回答格式無效');
      const item=pending.get(payload.id);
      if(!item||item.event.sessionId!==payload.sessionId||item.event.requestId!==payload.requestId||!matches(item.event.token,payload.token))throw failure('這個請求已失效，請更新待辦',409);
      if(item.signal?.aborted){api.cancel(payload.id);throw failure('這個請求已取消',409);}
      if(item.isCurrent&&!item.isCurrent()){api.cancel(payload.id);throw failure('原本的會話已結束，請更新待辦',409);}
      let result;
      if(item.event.kind==='approval') {
        if(!['allowed-once','rejected'].includes(payload.decision))throw failure('只能明確允許這次或拒絕');
        result=payload.decision;
      } else result={answers:validateAnswers(item.event.questions,payload.answers)};
      pending.delete(payload.id);item.signal?.removeEventListener('abort',item.abort);
      const h=history.find(e=>e.id===payload.id);if(h){h.resolved=true;h.read=true;h.resolvedAt=clock();}
      onSettle(item.event);item.resolve(result);emit();return {ok:true};
    },
    cancel(id,message='問題已取消'){
      const item=pending.get(id);if(!item)return false;
      pending.delete(id);item.signal?.removeEventListener('abort',item.abort);
      const h=history.find(e=>e.id===id);if(h){h.cancelled=true;h.read=true;}
      onSettle(item.event);item.reject(failure(message,409,'ASK_ABORTED'));emit();return true;
    },
    markRead(id){const e=history.find(e=>e.id===id);if(e)e.read=true;emit();},
    clearHistory(){history=history.filter(e=>pending.has(e.id));emit();},
    prune(){for(const [id,item] of pending)if(item.isCurrent&&!item.isCurrent())api.cancel(id,'原本的會話已結束');},
    markNative(id,value){const p=pending.get(id);if(p)p.event.nativeDelivered=value;const h=history.find(e=>e.id===id);if(h)h.nativeDelivered=value;emit();},
    dispose(){for(const id of [...pending.keys()])api.cancel(id,'通知外掛已停止');},
  };
  return api;
}
export function normalizeSessionEvent(session,event) {
  const sessionId=String(session?.id??session?.header?.id??'');
  if(!sessionId)return null;
  const base={sessionId,origin:session?.header?.origin,body:text(session?.header?.title||sessionId,512)};
  if(event?.type==='turn/end') {
    const kind=({'completed':'completed','error':'error','aborted':'aborted','interrupted':'interrupted','blocked':'blocked','max-tokens':'maxTokens'})[event.data?.reason?.kind];
    return kind?{...base,kind,title:EVENT_LABELS[kind],detail:text(event.data?.reason?.message||event.data?.reason?.error?.message),dedupKey:`${sessionId}:turn:${event.data?.turn}:${kind}`} :null;
  }
  if(event?.type==='compaction/end')return {...base,kind:event.data?.error?'error':'compaction',title:event.data?.error?'上下文壓縮失敗':EVENT_LABELS.compaction,dedupKey:`${sessionId}:compact:${event.seq??event.timestamp??''}`};
  if(event?.type==='goal/change'&&['complete','completed','blocked','paused'].includes(event.data?.goal?.status??event.data?.status))return {...base,kind:'goal',title:EVENT_LABELS.goal};
  return null;
}
