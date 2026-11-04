import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {BUILD_VERSION,SELLER_DEFAULT,NETWORK} from '../src/config.mjs';
const base=(process.env.BUYER_WORKER_URL||'https://x402-agent-buyer.trantanlong2411.workers.dev').replace(/\/$/,'');
const sleep=t=>new Promise(r=>setTimeout(r,t));
async function request(path,body){
 const response=await fetch(base+path,{
  method:body?'POST':'GET',
  headers:body?{'content-type':'application/json'}:{},
  body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(45000)
 });
 const raw=await response.text();
 let json;try{json=JSON.parse(raw)}catch{
  throw Error('Worker returned non-JSON HTTP '+response.status+': '+raw.slice(0,150))}
 return {status:response.status,value:json};
}
async function task(key,action,fields={}){
 return request('/api/task',{action,accessKey:key,...fields});
}
let health;
for(let attempt=0;attempt<28;attempt++){
 try{
  const r=await request('/api/health');
  health=r.value;
  if(r.status===200&&health.version===BUILD_VERSION)break;
  console.log('WAIT_FOR_DEPLOY',attempt+1,health.version,'expected',BUILD_VERSION);
 }catch(e){console.log('WAIT_FOR_DEPLOY',attempt+1,String(e.message||e).slice(0,130))}
 await sleep(4500);
}
assert.equal(health?.version,BUILD_VERSION,'Buyer Worker is not deployed at the expected URL');
assert.equal(health.chainId,688689);
assert.equal(health.network,NETWORK);
assert.equal(health.durableStorage,true);
assert.equal(health.spendLimitEnforced,true);
assert.equal(health.signingKeyOnServer,false);
const balance=await request('/api/balance?address=0x1111111111111111111111111111111111111111');
console.log('LIVE_BUYER_BALANCE_DIAGNOSTIC',JSON.stringify({status:balance.status,data:balance.value}));
assert.equal(balance.status,200,'Deployed Worker should read buyer USDC through the trusted merchant');
assert.equal(balance.value.ok,true);
assert.equal(balance.value.network,NETWORK);
assert.equal(balance.value.asset.toLowerCase(),'0xcfc8330f4bcab529c625d12781b1c19466a9fc8b');
assert.match(String(balance.value.balanceUSDC),/^\d+(?:\.\d+)?$/);
console.log('LIVE_BUYER_USDC_BALANCE_VERIFIED',JSON.stringify({
 asset:balance.value.asset,balanceUSDC:balance.value.balanceUSDC,block:balance.value.block
}));
const demos=await request('/api/demo');
assert.equal(demos.status,200);
assert.equal(demos.value.examples.completes.state,'SIMULATED_COMPLETED');
assert.equal(demos.value.examples.budgetStops.state,'SIMULATED_STOPPED_BUDGET');
assert.equal(demos.value.examples.completes.onChainPayment,false);
assert.equal(demos.value.examples.completes.steps.every(x=>x.txHash===null),true);
console.log('LIVE_BUDGET_DEMOS_VERIFIED','clearly labeled dry-run only');
const payer='0x1111111111111111111111111111111111111111';
const key=randomUUID();
const created=await task(key,'create',{kind:'bundle',payer,budgetUSDC:'0.010',priceCapUSDC:'0.005'});
assert.equal(created.status,201);
assert.equal(created.value.job.state,'RUNNING');
assert.equal(created.value.job.steps.length,2);
const next=await task(key,'next');
assert.equal(next.value.ok,true,JSON.stringify(next.value));
assert.equal(next.value.job.steps[0].status,'AWAITING_SIGNATURE');
assert.equal(next.value.job.steps[0].quotedAmount,'1000');
assert.equal(next.value.job.spentAtomic,'0');
assert.equal(next.value.job.totalPurchases,0);
const fake=await task(key,'pay',{stepId:'insights',paymentPayload:{x402Version:2,accepted:{},resource:{},payload:{}}});
assert.equal(fake.status,400);
assert.equal(fake.value.ok,false);
const state=await task(key,'status');
assert.equal(state.value.job.steps[0].status,'AWAITING_SIGNATURE');
assert.equal(state.value.job.spentAtomic,'0');
console.log('LIVE_AGENT_QUOTES_AND_INVALID_SIGNATURE_BLOCKED',JSON.stringify({
 route:'/api/insights',priceUSDC:'0.001',charged:false,
 perCallLimitUSDC:'0.005',totalBudgetUSDC:'0.010'
}));
const stopKey=randomUUID();
const started=await task(stopKey,'create',{kind:'budget-stop',payer,
 budgetUSDC:'0.0005',priceCapUSDC:'0.005'});
assert.equal(started.status,201);
const stopped=await task(stopKey,'next');
assert.equal(stopped.value.job.state,'STOPPED_BUDGET');
assert.equal(stopped.value.job.spentAtomic,'0');
assert.equal(stopped.value.job.totalPurchases,0);
const denied=await task(stopKey,'pay',{stepId:'insights',paymentPayload:{}});
assert.equal(denied.status,409);
console.log('LIVE_AGENT_BUDGET_REJECTION_BEFORE_SIGNATURE',JSON.stringify({
 state:'STOPPED_BUDGET',priceUSDC:'0.001',budgetUSDC:'0.0005',spentUSDC:'0'
}));
const merchantPrices={};
for(const path of ['/api/insights','/api/report']){
 const r=await fetch(SELLER_DEFAULT+path,{signal:AbortSignal.timeout(16000)});
 assert.equal(r.status,402,'The trusted merchant should return a real x402 challenge');
 const header=r.headers.get('PAYMENT-REQUIRED');
 assert.ok(header,'Merchant must provide PAYMENT-REQUIRED');
 const quote=JSON.parse(Buffer.from(header,'base64').toString('utf8'));
 assert.equal(quote.x402Version,2);
 assert.equal(quote.accepts[0].network,NETWORK);
 merchantPrices[path]=quote.accepts[0].amount;
}
assert.equal(merchantPrices['/api/insights'],'1000');
assert.equal(merchantPrices['/api/report'],'3000');
const evidence={
 schema:'pharos-x402-agent-buyer-deployed-readiness-v1',
 observedAtUtc:new Date().toISOString(),buyerWebsite:base,merchant:SELLER_DEFAULT,
 deployedVersion:health.version,network:NETWORK,chainId:688689,
 checks:{
  durableStorage:true,liveX402QuotesForTwoDifferentRoutes:true,
  quoteFirstRoutePriceUSDC:'0.001',quoteSecondRoutePriceUSDC:'0.003',
  budgetStopBeforeSignature:true,perCallCapConfigured:true,
  rejectedInvalidSignedPayload:true,zeroSpendRecordedUntilOnchainSuccess:true,
  completeDryRunWithoutRealPayment:true,budgetStopDryRunWithoutRealPayment:true
 },
 actualLiveSignedPayments:0,actualVerifiedTransactionHashes:[],
 note:'No live signed-payment receipt was submitted. The demo results are explicit DRY_RUN_ONLY, not paid transactions. To complete the hard task live, a buyer wallet must sign both authorizations and the agent must verify confirmed Atlantic receipts.'
};
await mkdir('proof',{recursive:true});
await writeFile('proof/deployed-agent-readiness.json',JSON.stringify(evidence,null,2)+'\n');
console.log('X402_AGENT_BUYER_LIVE_READINESS_SUCCESS',JSON.stringify(evidence.checks));
