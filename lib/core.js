import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';

// Every host-generated user-facing string, in both UI languages. Titles are
// localized when an event is published; history keeps the language it was
// created with, because stored events carry their rendered title.
export const HOST_STRINGS = Object.freeze({
  zh:Object.freeze({
    events:Object.freeze({completed:'任務完成',error:'執行失敗',aborted:'任務已中止',interrupted:'任務遭中斷',blocked:'任務受到阻塞',maxTokens:'已達輸出上限',approval:'等待批准',question:'等待回答',planReview:'等待計畫審閱',compaction:'上下文壓縮完成',jobCompleted:'背景工作完成',jobFailed:'背景工作失敗',jobKilled:'背景工作已停止',goal:'目標狀態更新'}),
    compactionFailed:'上下文壓縮失敗',goalPaused:'目標已暫停',goalCompleted:'目標已完成',goalBlocked:'目標受到阻塞',jobFallback:'背景工作',
    settingsReadFailed:'通知設定讀取失敗，已使用預設值',nativeLaunchFailed:'原生浮窗啟動失敗',nativeStaleAnswer:'已忽略失效的浮窗回答',nativeUnavailable:'原生浮窗不可用，待回答請求將交回 DSH',
    fallbackTitle:'原生互動已切回 DSH',fallbackBody:'尚未回答的互動請求已交回 DSH，請返回 DSH 繼續處理。',
    testQuestionTitle:'互動問答測試',testApprovalTitle:'一次性批准測試',testBody:'這是通知外掛的測試，不會執行指令或呼叫模型。',testReason:'只確認通知卡片可回傳一次性決定；不會修改檔案。',testApprovalDetail:'模擬批准操作：不會執行任何工具或指令。',
    testChoiceQuestion:'請選擇一個選項，或輸入自己的回答。',testChoiceOptions:Object.freeze(['互動正常','需要調整']),testMultiQuestion:'測試多選，也可以補充文字。',testMultiOptions:Object.freeze(['選項顯示正常','可以输入文字']),
    testDoneTitle:'互動測試已完成',testDoneBody:'答案已對應原始請求並成功接收。',testNoticeTitle:'Zeta 通知測試',testNoticeBody:'通知管道已收到測試訊息。',
    // Request validation the page can surface through /answer, /settings and the other routes.
    errors:Object.freeze({settingsNotObject:'設定必須是物件',eventSettingsInvalid:'事件設定無效',eventToggleInvalid:'事件開關無效',settingUnsupported:'不支援的設定',
      answerAll:'請回答每一道問題',answerIdInvalid:'回答識別碼無效',answerSelectionInvalid:'回答選项無效',answerUnknownOption:'回答包含未知選項',customMustBeText:'自由回答必須是文字',customTooLong:'自由回答超過 16000 字元',answerRequired:'請選擇選項或輸入回答',singleChoiceOnly:'單選問題只能選一項或填寫自由回答',
      answerPayloadInvalid:'回答格式無效',decisionInvalid:'只能明確允許這次或拒絕',kindInvalid:'通知類型無效',
      reauth:'請重新登入 DSH',untrustedOrigin:'請求來源不受信任',methodNotAllowed:'不支援的 HTTP 方法',sameOriginOnly:'只接受同來源操作',serviceError:'通知服務發生錯誤',tooManyStreams:'通知連線數已達上限',settingsSaveFailed:'無法儲存通知設定',visibilityInvalid:'頁面狀態無效',tooManyPages:'頁面數量已達上限',testKindInvalid:'測試類型無效',
      jsonRequired:'需要 JSON 請求',bodyTooLarge:'請求內容過大',jsonInvalid:'JSON 格式無效'}),
  }),
  en:Object.freeze({
    events:Object.freeze({completed:'Task completed',error:'Run failed',aborted:'Task aborted',interrupted:'Task interrupted',blocked:'Task blocked',maxTokens:'Output limit reached',approval:'Waiting for approval',question:'Waiting for an answer',planReview:'Waiting for plan review',compaction:'Context compacted',jobCompleted:'Background job finished',jobFailed:'Background job failed',jobKilled:'Background job stopped',goal:'Goal status changed'}),
    compactionFailed:'Context compaction failed',goalPaused:'Goal paused',goalCompleted:'Goal completed',goalBlocked:'Goal blocked',jobFallback:'Background job',
    settingsReadFailed:'Could not read the notification settings; the defaults are in use',nativeLaunchFailed:'The Windows card could not start',nativeStaleAnswer:'A stale card answer was ignored',nativeUnavailable:'Windows cards are unavailable; waiting requests go back to DSH',
    fallbackTitle:'Interaction moved back to DSH',fallbackBody:'Unanswered interactive requests were handed back to DSH. Return to DSH to continue.',
    testQuestionTitle:'Interactive question test',testApprovalTitle:'One-time approval test',testBody:'This is a notification plugin test; it runs no command and calls no model.',testReason:'It only confirms that a card can return a one-time decision; no file is modified.',testApprovalDetail:'Simulated approval: no tool or command will run.',
    testChoiceQuestion:'Pick an option, or type your own answer.',testChoiceOptions:Object.freeze(['Interaction works','Needs adjustment']),testMultiQuestion:'Test multiple choice; free text can be added too.',testMultiOptions:Object.freeze(['Options render correctly','Text input works']),
    testDoneTitle:'Interactive test finished',testDoneBody:'The answer was matched to its original request and received.',testNoticeTitle:'Zeta Notify test',testNoticeBody:'The notification channel received the test message.',
    // Request validation the page can surface through /answer, /settings and the other routes.
    errors:Object.freeze({settingsNotObject:'Settings must be an object',eventSettingsInvalid:'Invalid event settings',eventToggleInvalid:'Invalid event switch',settingUnsupported:'Unsupported setting',
      answerAll:'Answer every question',answerIdInvalid:'Invalid answer id',answerSelectionInvalid:'Invalid answer selection',answerUnknownOption:'The answer contains an unknown option',customMustBeText:'A free-text answer must be text',customTooLong:'The free-text answer is longer than 16000 characters',answerRequired:'Select an option or type an answer',singleChoiceOnly:'A single-choice question takes one option or free text, not both',
      answerPayloadInvalid:'Invalid answer format',decisionInvalid:'Only an explicit allow-once or reject is accepted',kindInvalid:'Invalid notification kind',
      reauth:'Sign in to DSH again',untrustedOrigin:'The request origin is not trusted',methodNotAllowed:'Unsupported HTTP method',sameOriginOnly:'Only same-origin requests are accepted',serviceError:'The notification service failed',tooManyStreams:'Too many notification connections',settingsSaveFailed:'Could not save the notification settings',visibilityInvalid:'Invalid page state',tooManyPages:'Too many pages',testKindInvalid:'Invalid test type',
      jsonRequired:'A JSON request is required',bodyTooLarge:'The request body is too large',jsonInvalid:'Invalid JSON'}),
  }),
});
/** Host dictionary for a resolved language id; anything but English reads Chinese. */
export function hostStrings(language) { return String(language||'').toLowerCase().startsWith('en')?HOST_STRINGS.en:HOST_STRINGS.zh; }
/** Kind registry and the Chinese titles; kept as the validation surface for event kinds. */
export const EVENT_LABELS = HOST_STRINGS.zh.events;
export function defaultSettings() {
  return {enabled:true,native:true,browser:true,sound:true,backgroundOnly:true,preview:true,includeSubagents:false,events:Object.fromEntries(Object.keys(EVENT_LABELS).map(k=>[k,true]))};
}
export function failure(message,status=400,code) { return Object.assign(new Error(message),{status,...(code?{code}: {})}); }
/** Request-validation failure whose message is resolved in the host language at throw time. */
export function failureIn(language,key,status=400,code) { return failure(hostStrings(language).errors[key],status,code); }
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>structuredClone(value);
function text(value,max=16000) { return typeof value==='string'?value.slice(0,max):''; }
export function validateSettings(patch,current=defaultSettings(),language='zh') {
  if(!record(patch))throw failureIn(language,'settingsNotObject');
  const next=clone(current);
  for(const [key,value] of Object.entries(patch)) {
    if(key==='events') {
      if(!record(value))throw failureIn(language,'eventSettingsInvalid');
      for(const [kind,enabled] of Object.entries(value)) {
        if(!Object.hasOwn(EVENT_LABELS,kind)||typeof enabled!=='boolean')throw failureIn(language,'eventToggleInvalid');
        next.events[kind]=enabled;
      }
    } else {
      if(!Object.hasOwn(defaultSettings(),key)||typeof value!=='boolean')throw failureIn(language,'settingUnsupported');
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
export function validateAnswers(questions,answers,language='zh') {
  if(!Array.isArray(answers)||answers.length!==questions.length)throw failureIn(language,'answerAll');
  const byId=new Map();
  for(const answer of answers) {
    if(!record(answer)||typeof answer.id!=='string'||byId.has(answer.id))throw failureIn(language,'answerIdInvalid');
    byId.set(answer.id,answer);
  }
  return questions.map(q=>{
    const a=byId.get(q.id);
    if(!a||!Array.isArray(a.selected)||a.selected.some(s=>typeof s!=='string')||new Set(a.selected).size!==a.selected.length)throw failureIn(language,'answerSelectionInvalid');
    const allowed=new Set((q.options??[]).map(o=>o.label));
    if(a.selected.some(s=>!allowed.has(s)))throw failureIn(language,'answerUnknownOption');
    if(a.custom!==undefined&&typeof a.custom!=='string')throw failureIn(language,'customMustBeText');
    const custom=a.custom?.trim();
    if(custom?.length>16000)throw failureIn(language,'customTooLong');
    if(!a.selected.length&&!custom)throw failureIn(language,'answerRequired');
    if(!q.multiSelect&&(a.selected.length>1||(a.selected.length&&custom)))throw failureIn(language,'singleChoiceOnly');
    return {id:q.id,selected:[...a.selected],...(custom?{custom}: {})};
  });
}
function matches(left,right) {
  if(typeof left!=='string'||typeof right!=='string'||left.length!==right.length)return false;
  const a=Buffer.from(left),b=Buffer.from(right);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export function createCenter({settings,clock=Date.now,maxHistory=200,language='zh',onChange=()=>{},onDeliver=()=>{},onSettle=()=>{}}={}) {
  const lang=()=>typeof language==='function'?language():language;
  const labels=()=>hostStrings(lang()).events;
  let preferences=settings?validateSettings(settings,undefined,lang()):defaultSettings();
  let revision=0,history=[];
  const pending=new Map();
  const emit=()=>{revision++;onChange();};
  const api={
    snapshot(){return {revision,settings:clone(preferences),history:clone(history),pending:[...pending.values()].map(p=>clone(p.event))};},
    updateSettings(patch){preferences=validateSettings(patch,preferences,lang());emit();return clone(preferences);},
    publish(input){
      if(!Object.hasOwn(EVENT_LABELS,input.kind))throw failureIn(lang(),'kindInvalid');
      const event={id:randomUUID(),sessionId:text(input.sessionId,512),kind:input.kind,title:text(input.title||labels()[input.kind],512),body:text(input.body,4000),createdAt:clock(),read:false,...(input.isTest?{isTest:true}:{}),...(input.channel?{channel:input.channel}:{}),...(input.origin?{origin:input.origin}:{})};
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
      const event={id:randomUUID(),requestId:randomUUID(),token:randomBytes(24).toString('hex'),sessionId:input.sessionId,kind:input.kind,title:text(input.title||labels()[input.kind],512),body:text(input.body,4000),createdAt:clock(),read:false,...(questions?{questions}:{}),...(input.toolName?{toolName:text(input.toolName,512)}:{}),...(input.callId?{callId:text(input.callId,512)}:{}),...(input.reason?{reason:text(input.reason,32000)}:{}),...(input.detail?{detail:text(input.detail,32000)}:{}),...(input.isTest?{isTest:true}:{}),...(input.origin?{origin:input.origin}:{})};
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
      if(!record(payload))throw failureIn(lang(),'answerPayloadInvalid');
      const item=pending.get(payload.id);
      if(!item||item.event.sessionId!==payload.sessionId||item.event.requestId!==payload.requestId||!matches(item.event.token,payload.token))throw failure('這個請求已失效，請更新待辦',409);
      if(item.signal?.aborted){api.cancel(payload.id);throw failure('這個請求已取消',409);}
      if(item.isCurrent&&!item.isCurrent()){api.cancel(payload.id);throw failure('原本的會話已結束，請更新待辦',409);}
      let result;
      if(item.event.kind==='approval') {
        if(!['allowed-once','rejected'].includes(payload.decision))throw failureIn(lang(),'decisionInvalid');
        result=payload.decision;
      } else result={answers:validateAnswers(item.event.questions,payload.answers,lang())};
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
export function normalizeSessionEvent(session,event,language='zh') {
  const s=hostStrings(language),EVENT_LABELS=s.events;
  const sessionId=String(session?.id??session?.header?.id??'');
  if(!sessionId)return null;
  const base={sessionId,origin:session?.header?.origin,body:text(session?.header?.title||sessionId,512)};
  if(event?.type==='turn/end') {
    const kind=({'completed':'completed','error':'error','aborted':'aborted','interrupted':'interrupted','blocked':'blocked','max-tokens':'maxTokens'})[event.data?.reason?.kind];
    return kind?{...base,kind,title:EVENT_LABELS[kind],detail:text(event.data?.reason?.message||event.data?.reason?.error?.message),dedupKey:`${sessionId}:turn:${event.data?.turn}:${kind}`} :null;
  }
  if(event?.type==='compaction/end')return {...base,kind:event.data?.error?'error':'compaction',title:event.data?.error?s.compactionFailed:EVENT_LABELS.compaction,dedupKey:`${sessionId}:compact:${event.seq??event.timestamp??''}`};
  if(event?.type==='goal/change'&&['complete','completed','blocked','paused'].includes(event.data?.goal?.status??event.data?.status))return {...base,kind:'goal',title:EVENT_LABELS.goal};
  return null;
}
