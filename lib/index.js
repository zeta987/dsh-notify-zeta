import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCenter,defaultSettings,validateSettings,normalizeSessionEvent,EVENT_LABELS,failure} from './core.js';

export const name='dsh-notify-zeta';
export const inject=['webServer','connection','agents','jobs'];
export const PREFIX='/__dsh/zeta-notify';
function sessionOf(req){return req?.agent?.session;}
function sessionId(req){return String(sessionOf(req)?.id??sessionOf(req)?.header?.id??'');}
function sessionLabel(session){return String(session?.header?.title??(session?.header?.cwd?basename(session.header.cwd):session?.id??'DSH'));}
function json(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));}
async function readJson(req){
  if(!String(req.headers['content-type']??'').toLowerCase().startsWith('application/json'))throw failure('需要 JSON 請求',415);
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>128*1024)throw failure('請求內容過大',413);chunks.push(chunk);}
  try {const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw failure('JSON 格式無效');}
}
function sameOrigin(req){try{const o=new URL(req.headers.origin);return ['http:','https:'].includes(o.protocol)&&o.host===req.headers.host&&o.origin===req.headers.origin;}catch{return false;}}
function approvalOperation(req) {
  const callId=typeof req?.callId==='string'?req.callId:'';
  const session=sessionOf(req);
  if(!callId||callId.length>512||typeof req.toolName!=='string'||!req.toolName||typeof session?.snapshotEvents!=='function')return null;
  try {
    const events=session.snapshotEvents();
    if(!Array.isArray(events))return null;
    const call=events.findLast(event=>event?.type==='tool/call'&&event.data?.callId===callId);
    if(call?.data?.name!==req.toolName||typeof call.data.arguments!=='string'||!call.data.arguments)return null;
    const args=JSON.parse(call.data.arguments);
    if(!args||typeof args!=='object'||Array.isArray(args))return null;
    const detail=typeof args.command==='string'?args.command:call.data.arguments;
    if(!detail.trim()||detail.length>32000)return null;
    return {callId,detail};
  } catch {return null;}
}

export function createHost(ctx,{bridge,settingsPath,clock=Date.now}={}) {
  const instanceId=randomUUID();
  let settings=defaultSettings(),closed=false,nativeError='';
  if(settingsPath){try{settings=validateSettings(JSON.parse(readFileSync(settingsPath,'utf8')));}catch(error){if(error.code!=='ENOENT')nativeError='通知設定讀取失敗，已使用預設值';}}
  const subscribers=new Map(),visibility=new Map(),disposers=[],fallback=new Set(),dedup=new Map(),replies=new Map(),nativeInFlight=new Set();
  let center;
  const snapshot=()=>({instanceId,...center.snapshot(),native:{available:Boolean(bridge?.available),...(nativeError?{error:nativeError}:{})}});
  const broadcast=()=>{
    if(closed)return;
    const data=`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`;
    for(const [res,stream] of subscribers){try{if(stream.blocked){stream.latest=data;}else{stream.blocked=!res.write(data);}}catch{subscribers.delete(res);}}
  };
  const foreground=id=>[...visibility.values()].some(v=>clock()-v.at<35000&&!v.hidden&&v.currentSessionId===id);
  center=createCenter({settings,clock,onChange:broadcast,onSettle:event=>{nativeInFlight.delete(event.id);try{bridge?.close(event.id);}catch{}},onDeliver(event,prefs){
    event.nativeDelivered=false;
    if(event.channel==='browser'||!prefs.native||(!event.requestId&&!event.isTest&&prefs.backgroundOnly&&foreground(event.sessionId)))return;
    try{
      event.nativeDelivered=bridge?.show(event,prefs)===true;
      if(event.nativeDelivered){nativeInFlight.add(event.id);if(nativeInFlight.size>256)nativeInFlight.delete(nativeInFlight.values().next().value);}
    }catch(error){nativeError='原生浮窗啟動失敗';}
  }});
  const persist=()=>{
    if(!settingsPath)return;
    mkdirSync(dirname(settingsPath),{recursive:true});
    const temp=`${settingsPath}.tmp`;
    writeFileSync(temp,JSON.stringify(center.snapshot().settings,null,2)+'\n',{mode:0o600});renameSync(temp,settingsPath);
  };
  const api={center,snapshot,
    respond(payload){return center.respond(payload);},
    nativeAction(action){
      if(action?.type==='ready'){nativeError='';broadcast();return;}
      if(action?.type==='shown'){nativeInFlight.delete(action.id);return;}
      if(action?.type==='respond'){
        try{center.respond(action);nativeError='';broadcast();}
        catch(error){
          nativeError=error.status===409?'已忽略失效的浮窗回答':error.message;
          const pending=center.snapshot().pending.find(e=>e.id===action.id);
          if(pending){try{bridge?.show({...pending,error:nativeError},center.snapshot().settings);}catch{}}
          else {try{bridge?.close(action.id);}catch{}}
          broadcast();
        }
      }
      if(action?.type==='dismiss'){nativeInFlight.delete(action.id);center.markRead(action.id);}
    },
    nativeFailure(){
      nativeError='原生浮窗不可用，待回答請求將交回 DSH';
      for(const e of center.snapshot().pending){
        const needsReminder=nativeInFlight.has(e.id);
        fallback.add(e.id);center.cancel(e.id,'原生浮窗不可用');
        if(needsReminder)publish({kind:'error',sessionId:e.sessionId,title:'原生互動已切回 DSH',body:'尚未回答的互動請求已交回 DSH，請返回 DSH 繼續處理。',channel:'browser',dedupKey:`native-fallback:${e.id}`});
      }
      const history=new Map(center.snapshot().history.map(event=>[event.id,event]));
      for(const id of nativeInFlight){const event=history.get(id);if(event&&!event.requestId&&!event.read&&!event.resolved&&!event.cancelled)center.markNative(id,false);}
      nativeInFlight.clear();
      broadcast();
    },
    dispose(){closed=true;center.dispose();for(const res of subscribers.keys())res.end();subscribers.clear();for(const off of disposers)try{off();}catch{};bridge?.dispose();},
  };
  const publish=input=>{
    if(!input)return;
    if(input.dedupKey){if(dedup.has(input.dedupKey))return;dedup.set(input.dedupKey,clock());if(dedup.size>1000)dedup.delete(dedup.keys().next().value);}
    center.publish(input);
  };
  const ownRequest=async(kind,req,next)=>{
    const sid=sessionId(req),prefs=center.snapshot().settings;
    const origin=sessionOf(req)?.header?.origin;
    if(!sid||!prefs.enabled||!prefs.events[kind])return next();
    if(origin==='subagent'&&!prefs.includeSubagents)return next();
    if(!prefs.native){publish({kind,sessionId:sid,title:EVENT_LABELS[kind],body:sessionLabel(sessionOf(req))});return next();}
    let pending;
    try{
      const agents=ctx.get?.('agents')??ctx.agents;
      const isCurrent=()=>!agents||(agents.get(req.agent.id)===req.agent&&String(req.agent.id)===sid);
      if(!isCurrent())return next();
      const operation=kind==='approval'?approvalOperation(req):null;
      if(kind==='approval'&&!operation)return next();
      pending=center.openRequest({kind,sessionId:sid,title:EVENT_LABELS[kind],body:sessionLabel(sessionOf(req)),questions:req.questions,toolName:req.toolName,callId:operation?.callId,reason:req.reason,detail:operation?.detail,signal:req.signal,isCurrent,origin});
    }catch(error){if(req.signal?.aborted){if(kind==='approval')return 'cancelled';throw error;}return next();}
    if(!pending.event.nativeDelivered){fallback.add(pending.event.id);center.cancel(pending.event.id,'原生浮窗不可用');}
    try{return await pending.promise;}
    catch(error){if(fallback.delete(pending.event.id)&&!req.signal?.aborted&&!closed)return next();if(kind==='approval')return 'cancelled';throw error;}
  };
  disposers.push(ctx.on('user-questions/request',(req,next)=>ownRequest(req.questions?.some(q=>q.intent?.kind==='plan-review')?'planReview':'question',req,next),{prepend:true}));
  disposers.push(ctx.on('approval/request',(req,next)=>ownRequest('approval',req,next),{prepend:true}));
  disposers.push(ctx.on('session/event',(session,event)=>{
    const sid=String(session?.id??'');
    if(event?.type==='turn/start'){replies.set(sid,'');if(replies.size>200)replies.delete(replies.keys().next().value);}
    if(event?.type==='assistant/message'){
      const body=(event.data?.message?.content??[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      replies.set(sid,((replies.get(sid)??'')+body).slice(0,1000));
    }
    const normalized=normalizeSessionEvent(session,event);
    if(normalized){normalized.body=replies.get(sid)||sessionLabel(session);publish(normalized);}
    if(event?.type==='turn/end')replies.delete(sid);
  }));
  disposers.push(ctx.on('goal/changed',({agent,change})=>{
    if(!['pause','complete','block'].includes(change?.operation))return;
    publish({kind:'goal',sessionId:String(agent?.session?.id??agent?.id??''),title:({pause:'目標已暫停',complete:'目標已完成',block:'目標受到阻塞'})[change.operation],body:sessionLabel(agent?.session),origin:agent?.session?.header?.origin});
  }));
  const jobs=ctx.get?.('jobs')??ctx.jobs;
  if(jobs?.onJobDone)disposers.push(jobs.onJobDone((job,owner)=>{
    const kind=({completed:'jobCompleted',failed:'jobFailed',killed:'jobKilled'})[job.status];
    if(kind)publish({kind,sessionId:String(owner?.id??job.ownerSession??''),title:EVENT_LABELS[kind],body:String(job.label??job.id??'背景工作'),origin:owner?.session?.header?.origin});
  }));
  const pruneTimer=setInterval(()=>center.prune(),5000);pruneTimer.unref();disposers.push(()=>clearInterval(pruneTimer));
  const handler=(method,fn)=>async(req,res)=>{
    const rejection=ctx.connection.requestRejection(req);
    if(rejection!==undefined){json(res,rejection,{ok:false,error:rejection===401?'請重新登入 DSH':'請求來源不受信任'});return;}
    if(req.method!==method){json(res,405,{ok:false,error:'不支援的 HTTP 方法'});return;}
    if(method==='POST'&&!sameOrigin(req)){json(res,403,{ok:false,error:'只接受同來源操作'});return;}
    try{await fn(req,res);}catch(error){if(!res.headersSent)json(res,error.status??500,{ok:false,error:error.status?error.message:'通知服務發生錯誤'});else res.destroy();}
  };
  const route=(suffix,method,fn)=>{disposers.push(ctx.webServer.register({kind:'exact',path:PREFIX+suffix,handler:handler(method,fn)}));};
  route('/state','GET',async(_req,res)=>json(res,200,snapshot()));
  route('/events','GET',async(req,res)=>{
    if(subscribers.size>=20)throw failure('通知連線數已達上限',429);
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-accel-buffering':'no'});
    const stream={blocked:false,latest:null};subscribers.set(res,stream);
    stream.blocked=!res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
    res.on('drain',()=>{stream.blocked=false;if(stream.latest){const latest=stream.latest;stream.latest=null;stream.blocked=!res.write(latest);}});
    const heartbeat=setInterval(()=>{if(!stream.blocked)stream.blocked=!res.write(': keepalive\n\n');},20000);heartbeat.unref();
    const cleanup=()=>{clearInterval(heartbeat);subscribers.delete(res);};req.on('close',cleanup);res.on('close',cleanup);
  });
  route('/settings','POST',async(req,res)=>{const body=await readJson(req);const old=center.snapshot().settings;center.updateSettings(body.patch);try{persist();}catch(error){center.updateSettings(old);throw failure('無法儲存通知設定',500);}json(res,200,{ok:true});});
  route('/answer','POST',async(req,res)=>json(res,200,api.respond(await readJson(req))));
  route('/read','POST',async(req,res)=>{const body=await readJson(req);center.markRead(body.id);json(res,200,{ok:true});});
  route('/clear','POST',async(req,res)=>{await readJson(req);center.clearHistory();json(res,200,{ok:true});});
  route('/visibility','POST',async(req,res)=>{
    const body=await readJson(req);if(typeof body.clientId!=='string'||body.clientId.length>128||typeof body.hidden!=='boolean')throw failure('頁面狀態無效');
    for(const [id,v] of visibility)if(clock()-v.at>35000)visibility.delete(id);
    if(visibility.size>=20&&!visibility.has(body.clientId))throw failure('頁面數量已達上限',429);
    visibility.set(body.clientId,{hidden:body.hidden,currentSessionId:typeof body.currentSessionId==='string'?body.currentSessionId:'',at:clock()});json(res,200,{ok:true});
  });
  route('/test','POST',async(req,res)=>{
    const body=await readJson(req);if(!['native','browser','question','approval'].includes(body.kind))throw failure('測試類型無效');
    if(body.kind==='question'||body.kind==='approval'){
      const pending=center.openRequest({kind:body.kind,sessionId:'zeta-notify-test',isTest:true,title:body.kind==='question'?'互動問答測試':'一次性批准測試',body:'這是通知外掛的測試，不會執行指令或呼叫模型。',toolName:'notification_test',reason:'只確認通知卡片可回傳一次性決定；不會修改檔案。',detail:body.kind==='approval'?'模擬批准操作：不會執行任何工具或指令。':undefined,questions:body.kind==='question'?[{id:'choice',question:'請選擇一個選項，或輸入自己的回答。',options:[{label:'互動正常'},{label:'需要調整'}]},{id:'multi',question:'測試多選，也可以補充文字。',multiSelect:true,options:[{label:'選項顯示正常'},{label:'可以输入文字'}]}]:undefined});
      const timer=setTimeout(()=>center.cancel(pending.event.id,'測試已逾時'),600000);timer.unref();
      pending.promise.then(()=>publish({kind:'completed',sessionId:'zeta-notify-test',title:'互動測試已完成',body:'答案已對應原始請求並成功接收。',isTest:true}),()=>{}).finally(()=>clearTimeout(timer));
      json(res,200,{ok:true,id:pending.event.id});
    }else{publish({kind:'completed',sessionId:'zeta-notify-test',title:'Zeta 通知測試',body:'通知管道已收到測試訊息。',isTest:true,channel:body.kind});json(res,200,{ok:true});}
  });
  return api;
}
export async function apply(ctx){
  const {createNativeBridge}=await import('./native.js');let host;
  const bridge=createNativeBridge({onAction:action=>host?.nativeAction(action),onError:()=>host?.nativeFailure()});
  const settingsPath=fileURLToPath(new URL('zeta-notify.settings.json',ctx.baseUrl));
  host=createHost(ctx,{bridge,settingsPath});
  ctx.effect(()=>()=>host.dispose(),'dsh-notify-zeta: lifecycle');
}
