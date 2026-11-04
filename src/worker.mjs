import {DurableObject} from 'cloudflare:workers';
import {BUILD_VERSION,NETWORK,CHAIN_ID,ROUTES,USDC,EXPLORER,config} from './config.mjs';
import {addr,dollars,newTask,validateChallenge,decide,verifySignedEnvelope,record,finalizePaid,simulateTask} from './policy.mjs';
import {decodeHeader,validateMerchantReceipt,verifyLiveReceipt} from './chain.mjs';
import {PAGE} from './page.mjs';

const json=(x,status=200)=>Response.json(x,{status,
 headers:{'content-type':'application/json','cache-control':'no-store',
 'x-content-type-options':'nosniff'}});
const error=(s,status=400)=>json({ok:false,error:String(s).slice(0,240)},status);
const now=()=>new Date().toISOString();
function publicJob(task){
 if(!task)return null;
 // Do not expose raw signed payloads: only public quote, status and real tx evidence.
 return {...task,steps:task.steps.map(x=>({...x}))};
}
const safeReason=s=>String(s||'').slice(0,180);
async function merchantQuote(c,route){
 const target=c.seller+route.path;
 const response=await fetch(target,{headers:{'accept':'application/json'},
  redirect:'manual',signal:AbortSignal.timeout(16000)});
 if(response.status!==402)throw Error('Merchant must return HTTP 402. Received HTTP '+response.status);
 const header=response.headers.get('PAYMENT-REQUIRED');
 const payload=decodeHeader(header);
 return validateChallenge(payload,route,c.seller);
}
async function merchantPay(c,step,paymentPayload){
 const response=await fetch(c.seller+step.path,{
  method:'GET',redirect:'manual',
  headers:{'accept':'application/json','PAYMENT-SIGNATURE':btoa(JSON.stringify(paymentPayload))},
  signal:AbortSignal.timeout(99000)
 });
 const raw=await response.text();
 if(raw.length>20000)throw Error('Merchant response exceeded safe size limit');
 let data;try{data=JSON.parse(raw)}catch{throw Error('Merchant sent a non-JSON settlement response')}
 return {status:response.status,body:data,
  receiptHeader:response.headers.get('PAYMENT-RESPONSE')};
}
const cleanQuote=q=>({offer:q.offer,resource:q.resource});
function noteEvent(step,status,note){
 step.history.push({at:now(),status,note:String(note||'').slice(0,160)});
 if(step.history.length>20)step.history.shift();
}
export class BuyerTask extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);this.sql=ctx.storage.sql;
  this.sql.exec('CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
 }
 read(){
  const row=this.sql.exec("SELECT data FROM documents WHERE id='job'").toArray()[0];
  return row?JSON.parse(row.data):null;
 }
 save(job){
  job.updatedAt=now();
  this.sql.exec("INSERT INTO documents(id,data) VALUES('job',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",JSON.stringify(job));
 }
 async fetch(req){
  if(req.method!=='POST')return error('POST required',405);
  let input;
  try{input=await req.json()}catch{return error('Valid JSON required')}
  const action=new URL(req.url).pathname.slice(1),c=config(this.env);
  let job=this.read();
  if(action==='create'){
   if(job)return error('This private task access key already exists',409);
   try{job=newTask(input,input.accessKey)}
   catch(e){return error(e.message)}
   this.save(job);
   return json({ok:true,job:publicJob(job)},201);
  }
  if(!job)return error('Task not found for this private access key',404);
  if(action==='status')return json({ok:true,job:publicJob(job)});
  if(action==='next'){
   if(job.state!=='RUNNING')return json({ok:true,job:publicJob(job),message:'Task is not accepting further purchases.'});
   const step=job.steps.find(x=>x.status!=='PAID');
   if(!step){
    job.state='COMPLETED';this.save(job);
    return json({ok:true,job:publicJob(job)});
   }
   if(step.status==='AWAITING_SIGNATURE')
    return json({ok:true,job:publicJob(job),message:'Approved quote awaiting a user-controlled wallet signature'});
   if(step.status!=='PLANNED')
    return json({ok:true,job:publicJob(job),message:'Payment has already been attempted; resolve or retry explicitly before continuing'});
   let quote;
   try{quote=await merchantQuote(c,ROUTES[step.index])}
   catch(e){return error('Merchant challenge unavailable: '+e.message,503)}
   // Re-read after network I/O to avoid overwriting a concurrent signing request.
   job=this.read();const item=job.steps[step.index];
   if(job.state!=='RUNNING'||item.status!=='PLANNED')
    return error('Task state changed while obtaining quote; refresh first',409);
   const priceDecision=decide(job,quote.amount);
   item.quotedAmount=quote.amount.toString();item.quotedUSDC=dollars(quote.amount);
   if(!priceDecision.allowed){
    item.status=priceDecision.state;item.reason=priceDecision.reason;
    job.state=priceDecision.state;job.stoppedReason=priceDecision.reason;
    noteEvent(item,item.status,item.reason);
    record(job,'BUDGET_POLICY_REFUSAL',item,{priceUSDC:item.quotedUSDC,reason:item.reason});
   }else{
    item.status='AWAITING_SIGNATURE';item.quote=cleanQuote(quote);
    item.reason=null;
    noteEvent(item,'QUOTE_ACCEPTED','Validated the live x402 price, limits and trusted asset');
    record(job,'QUOTE_APPROVED',item,{
      priceUSDC:item.quotedUSDC,perCallCapUSDC:dollars(job.priceCapAtomic),
      totalBudgetUSDC:dollars(job.budgetAtomic)
    });
   }
   this.save(job);
   return json({ok:true,job:publicJob(job)});
  }
  if(action==='retry'){
   if(job.state!=='RUNNING')return error('Task is stopped; cannot retry',409);
   const step=job.steps.find(x=>x.id===input.stepId);
   if(!step||step.status!=='FAILED_NO_CHARGE'||step.transactionHash)
    return error('Only a definitively rejected, uncharged payment can be retried',409);
   step.status='PLANNED';step.quote=null;step.reason=null;
   step.authorizationId=null;
   noteEvent(step,'RETRY_REQUESTED','Requote requested after confirmed no-charge failure');
   record(job,'SAFE_RETRY_REQUESTED',step);
   this.save(job);return json({ok:true,job:publicJob(job)});
  }
  if(action==='reconcile'){
   const step=job.steps.find(x=>x.id===input.stepId);
   if(!step||step.status!=='NEEDS_RECONCILIATION'||!step.transactionHash)
    return error('No known transaction hash exists for on-chain reconciliation',409);
   try{
    const verification=await verifyLiveReceipt(step.transactionHash,step,job.payer,c);
    job=this.read();const latest=job.steps.find(x=>x.id===step.id);
    if(latest.status==='PAID')return json({ok:true,job:publicJob(job),idempotent:true});
    if(latest.status!=='NEEDS_RECONCILIATION'||latest.transactionHash!==step.transactionHash)
     return error('Task state changed; reload before reconciling',409);
    finalizePaid(job,latest,{success:true,transaction:step.transactionHash,network:NETWORK,payer:job.payer},latest.data);
    latest.verifiedBlock=verification.block;
    this.save(job);return json({ok:true,job:publicJob(job),verified:true});
   }catch(e){
    return json({ok:false,reason:'Still awaiting a verifiable matching receipt: '+safeReason(e.message),
     job:publicJob(job)});
   }
  }
  if(action!=='pay')return error('Unknown task operation',404);
  if(job.state!=='RUNNING')return error('Task is stopped or completed',409);
  const step=job.steps.find(x=>x.id===input.stepId);
  if(!step||step.status!=='AWAITING_SIGNATURE')
   return error('Payment already attempted or missing a currently approved quote',409);
  let signed;
  try{signed=verifySignedEnvelope(input.paymentPayload,job,step)}
  catch(e){return error('Authorization refused: '+e.message,400)}
  if(!decide(job,BigInt(step.quotedAmount)).allowed)
   return error('Payment no longer fits the task budget',409);
  if(job.steps.some(x=>x.authorizationId===signed.authorizationId))
   return error('Authorization nonce has already been used in this task',409);
  // Persist an irreversible in-flight state BEFORE any request that can charge tokens.
  // No network exception may roll this back automatically.
  step.status='SETTLEMENT_PENDING';step.attempts+=1;step.authorizationId=signed.authorizationId;
  noteEvent(step,'SETTLEMENT_PENDING','Signed authorization forwarded once; awaiting merchant settlement');
  record(job,'SIGNED_ATTEMPT_SUBMITTED',step,{priceUSDC:step.quotedUSDC,
    note:'No payment counted until a matching blockchain receipt is verified'});
  this.save(job);
  let merchant;
  try{merchant=await merchantPay(c,step,input.paymentPayload)}
  catch(e){
   job=this.read();const item=job.steps[step.index];
   item.status='NEEDS_RECONCILIATION';
   item.reason='Merchant response uncertain: '+safeReason(e.message)+
    '. DO NOT sign again; inspect the facilitator transaction first.';
   noteEvent(item,item.status,item.reason);
   record(job,'UNKNOWN_SETTLEMENT_NO_RETRY',item,{reason:item.reason});
   this.save(job);
   return json({ok:false,job:publicJob(job),warning:item.reason});
  }
  job=this.read();const item=job.steps[step.index];
  if(item.status!=='SETTLEMENT_PENDING'||item.authorizationId!==signed.authorizationId)
   return error('Task state changed during payment; inspect status before any further action',409);
  if(merchant.status!==200){
   const reason=safeReason(merchant.body?.error||merchant.body?.errorReason||'Seller did not settle payment');
   // Only this exact balance validation error is known to occur before settlement.
   if(merchant.status===402&&/insufficient test usdc balance/i.test(reason)){
    item.status='FAILED_NO_CHARGE';item.reason=reason;
    noteEvent(item,item.status,'On-chain balance check rejected authorization before broadcast');
    record(job,'NO_CHARGE_REJECTION',item,{reason});
   }else{
    item.status='NEEDS_RECONCILIATION';
    item.reason='Payment not confirmed (HTTP '+merchant.status+'): '+reason+
     '. Do not create a new authorization until manually resolved.';
    noteEvent(item,item.status,item.reason);
    record(job,'UNKNOWN_SETTLEMENT_NO_RETRY',item,{reason:item.reason});
   }
   this.save(job);
   return json({ok:false,job:publicJob(job),warning:item.reason});
  }
  let receipt;
  try{receipt=validateMerchantReceipt(merchant.receiptHeader,merchant.body,item,job.payer)}
  catch(e){
   item.status='NEEDS_RECONCILIATION';
   item.reason='Merchant HTTP 200 lacked matching x402 evidence: '+safeReason(e.message);
   noteEvent(item,item.status,item.reason);
   record(job,'MISSING_RECEIPT_NO_RETRY',item,{reason:item.reason});
   this.save(job);
   return json({ok:false,job:publicJob(job),warning:item.reason});
  }
  item.transactionHash=receipt.transaction;
  item.data=merchant.body.data??null;
  item.status='NEEDS_RECONCILIATION';
  item.reason='Merchant reported settlement. Independently checking Atlantic receipt.';
  this.save(job);
  try{
   const evidence=await verifyLiveReceipt(receipt.transaction,item,job.payer,c);
   job=this.read();const current=job.steps[step.index];
   if(current.status==='PAID')return json({ok:true,job:publicJob(job),idempotent:true});
   if(current.status!=='NEEDS_RECONCILIATION'||current.transactionHash!==receipt.transaction)
    return error('Task changed during on-chain verification',409);
   finalizePaid(job,current,receipt,merchant.body.data);
   current.verifiedBlock=evidence.block;
   this.save(job);
   return json({ok:true,job:publicJob(job),payment:{
    success:true,transaction:receipt.transaction,explorer:EXPLORER+receipt.transaction}});
  }catch(e){
   job=this.read();const current=job.steps[step.index];
   current.reason='Merchant supplied tx '+receipt.transaction+
    ', but independent receipt verification is pending: '+safeReason(e.message);
   record(job,'ONCHAIN_RECHECK_REQUIRED',current,{reason:current.reason,
    transactionHash:receipt.transaction});
   this.save(job);
   return json({ok:false,job:publicJob(job),warning:current.reason});
  }
 }
}
export default {
 async fetch(req,env={}){
  const url=new URL(req.url),path=url.pathname;
  if(req.method==='GET'&&path==='/')
   return new Response(PAGE,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
  if(req.method==='GET'&&path==='/api/health')
   return json({ok:true,version:BUILD_VERSION,network:NETWORK,chainId:CHAIN_ID,
    seller:config(env).seller,paymentMode:'user wallet EIP-712 approval',
    signingKeyOnServer:false,spendLimitEnforced:true,retryPolicy:'never repay on uncertain settlement',
    durableStorage:Boolean(env.BUYER_TASKS),
    successRule:'merchant PAYMENT-RESPONSE + independent on-chain receipt'});
  if(req.method==='GET'&&path==='/api/demo')
   return json({ok:true,mode:'DRY_RUN_ONLY',examples:{
    completes:simulateTask('complete'),budgetStops:simulateTask('budget-stop')}});
  if(req.method!=='POST'||path!=='/api/task')return error('Not found',404);
  if(!env.BUYER_TASKS)return error('Cloudflare Durable Object BUYER_TASKS binding missing',503);
  let body;
  try{const raw=await req.text();
    if(raw.length>26000)throw Error('Request exceeds size limit');
    body=JSON.parse(raw);
    if(!body||typeof body!=='object'||Array.isArray(body))throw Error('A JSON object is required');
  }catch(e){return error('Invalid task JSON: '+e.message)}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.accessKey||''))
   return error('A private random UUIDv4 task access key is required');
  if(!['create','status','next','pay','retry','reconcile'].includes(body.action))
   return error('Unsupported task action');
  const id=env.BUYER_TASKS.idFromName('x402-buyer:'+body.accessKey.toLowerCase());
  return env.BUYER_TASKS.get(id).fetch(new Request('https://task.internal/'+body.action,{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
  }));
 }
};
