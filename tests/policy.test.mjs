import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet,hexlify,randomBytes} from 'ethers';
import {newTask,validateChallenge,decide,verifySignedEnvelope,finalizePaid,simulateTask,money,dollars,TYPE} from '../src/policy.mjs';
import {SELLER_DEFAULT,ROUTES,USDC,NETWORK} from '../src/config.mjs';

const payer=Wallet.createRandom();
const seller=Wallet.createRandom().address;
const key='11111111-1111-4111-8111-111111111111';
function task(budget='0.010',cap='0.005',kind='bundle'){
 return newTask({payer:payer.address,budgetUSDC:budget,priceCapUSDC:cap,kind},key,Date.parse('2026-11-05T00:00:00Z'));
}
function quote(route=ROUTES[0],amount='1000'){
 return {x402Version:2,resource:{url:SELLER_DEFAULT+route.path},
 accepts:[{scheme:'exact',network:NETWORK,amount,asset:USDC,
 payTo:seller,maxTimeoutSeconds:300,extra:{assetTransferMethod:'eip3009',name:'USDC',version:'2'}}]};
}
test('task requires valid buyer and supports independent total and per-call budget caps',()=>{
 const t=task('0.002','0.005','budget-stop');
 assert.equal(t.state,'RUNNING');assert.equal(t.steps.length,2);
 assert.equal(t.budgetAtomic,'2000');assert.equal(t.priceCapAtomic,'5000');
 assert.equal(t.totalPurchases,0);assert.equal(t.spentUSDC,'0.0');
 assert.throws(()=>newTask({payer:'not-a-wallet',budgetUSDC:'1',priceCapUSDC:'0.005'},key),/buyer wallet/);
 assert.throws(()=>money('0.0000001'),/up to six/);
 assert.equal(dollars(money('0.003')),'0.003');
});
test('reads two different live x402 route prices and enforces both spending limits',()=>{
 const t=task('0.002','0.005','budget-stop');
 const q1=validateChallenge(quote(ROUTES[0],'1000'),ROUTES[0],SELLER_DEFAULT);
 const q2=validateChallenge(quote(ROUTES[1],'3000'),ROUTES[1],SELLER_DEFAULT);
 assert.equal(q1.amount,1000n);assert.equal(q2.amount,3000n);
 assert.equal(decide(t,q1.amount).allowed,true);
 t.spentAtomic='1000';
 assert.equal(decide(t,q2.amount).state,'STOPPED_BUDGET');
 const per=task('0.010','0.002');
 assert.equal(decide(per,q2.amount).state,'STOPPED_PRICE_CAP');
});
test('wrong asset, network, URL, price or EIP-3009 domain cannot pass challenge',()=>{
 const good=quote(),other={...good,resource:{url:'https://attacker.invalid/api/insights'}};
 assert.throws(()=>validateChallenge(other,ROUTES[0],SELLER_DEFAULT),/wrong-resource/);
 assert.throws(()=>validateChallenge({...good,accepts:[{...good.accepts[0],network:'eip155:1672'}]},ROUTES[0],SELLER_DEFAULT),/trusted/);
 assert.throws(()=>validateChallenge({...good,accepts:[{...good.accepts[0],asset:Wallet.createRandom().address}]},ROUTES[0],SELLER_DEFAULT),/trusted/);
 assert.throws(()=>validateChallenge(quote(ROUTES[0],'100000'),ROUTES[0],SELLER_DEFAULT),/hard safety cap/);
});
async function signed(t){
 const q=validateChallenge(quote(),ROUTES[0],SELLER_DEFAULT);
 const step=t.steps[0];step.status='AWAITING_SIGNATURE';step.quote={offer:q.offer,resource:q.resource};
 step.quotedAmount=q.amount.toString();step.quotedUSDC=dollars(q.amount);
 const now=Math.floor(Date.now()/1000);
 const authorization={from:payer.address,to:seller,value:'1000',
 validAfter:String(now-20),validBefore:String(now+200),nonce:hexlify(randomBytes(32))};
 const domain={name:'USDC',version:'2',chainId:688689,verifyingContract:USDC};
 const signature=await payer.signTypedData(domain,TYPE,authorization);
 return {x402Version:2,resource:q.resource,accepted:q.offer,
 payload:{signature,authorization}};
}
test('valid EIP-712 exact authorization is linked to the expected buyer and nonce',async()=>{
 const t=task(),p=await signed(t);
 const checked=verifySignedEnvelope(p,t,t.steps[0]);
 assert.equal(checked.payer,payer.address);
 assert.equal(checked.amount,1000n);
 assert.match(checked.authorizationId,/^0x[0-9a-f]{64}$/);
 const altered={...p,accepted:{...p.accepted,amount:'2000'}};
 assert.throws(()=>verifySignedEnvelope(altered,t,t.steps[0]),/exact quoted/);
 const other={...p,payload:{...p.payload,authorization:{...p.payload.authorization,value:'999'}}};
 assert.throws(()=>verifySignedEnvelope(other,t,t.steps[0]),/price/);
});
test('no paid event without an independently verified real merchant transaction hash',async()=>{
 const t=task(),p=await signed(t);const step=t.steps[0];
 step.status='SETTLEMENT_PENDING';
 assert.throws(()=>finalizePaid(t,step,{success:true,transaction:'0x123'},{}),/unsubmitted|real success/);
 assert.equal(t.spentAtomic,'0');
 step.status='NEEDS_RECONCILIATION';
 const tx='0x'+'a'.repeat(64);
 finalizePaid(t,step,{success:true,transaction:tx},{insights:'paid content'});
 assert.equal(t.spentAtomic,'1000');assert.equal(t.totalPurchases,1);
 assert.equal(t.log[0].transactionHash,tx);
 assert.equal(t.steps[0].status,'PAID');
 finalizePaid(t,step,{success:true,transaction:tx},{insights:'paid content'});
 assert.equal(t.totalPurchases,1,'A repeat callback must never double-count payment');
});
test('full dry run demonstrates completed task and a budget stop without fabricating paid transactions',()=>{
 const success=simulateTask('complete');
 assert.equal(success.state,'SIMULATED_COMPLETED');
 assert.deepEqual(success.steps.map(s=>s.endpoint),['/api/insights','/api/report']);
 assert.equal(success.spentUSDC,'0.004');
 assert.equal(success.onChainPayment,false);
 assert.equal(success.steps.every(x=>x.txHash===null),true);
 const stop=simulateTask('budget-stop');
 assert.equal(stop.state,'SIMULATED_STOPPED_BUDGET');
 assert.equal(stop.steps[0].result,'SIMULATED_PURCHASE_ONLY');
 assert.equal(stop.steps[1].result,'STOPPED_BUDGET');
 assert.equal(stop.spentUSDC,'0.001');
 assert.equal(stop.realTxHashes.length,0);
});
