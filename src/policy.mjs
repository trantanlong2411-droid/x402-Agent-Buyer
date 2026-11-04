import {getAddress,parseUnits,verifyTypedData,keccak256,toUtf8Bytes} from 'ethers';
import {NETWORK,CHAIN_ID,USDC,ROUTES,ZERO} from './config.mjs';
export const TYPE={TransferWithAuthorization:[
 {name:'from',type:'address'},{name:'to',type:'address'},
 {name:'value',type:'uint256'},{name:'validAfter',type:'uint256'},
 {name:'validBefore',type:'uint256'},{name:'nonce',type:'bytes32'}
]};
const MONEY_SCALE=1000000n;
export const MONEY_LIMIT=10000000n; // Maximum 10 test USDC for a demo task.
export const MAX_QUOTE=50000n;    // Hard safety ceiling: 0.05 USDC per request.
export function addr(s){try{const a=getAddress(String(s||''));return a===ZERO?null:a}catch{return null}}
export function money(x){
 const str=String(x??'').trim();
 if(!/^\d+(?:\.\d{1,6})?$/.test(str))throw Error('Use a positive USDC decimal with up to six places');
 const value=parseUnits(str,6);
 if(value<=0n||value>MONEY_LIMIT)throw Error('Budget / price cap must be between 0.000001 and 10 test USDC');
 return value;
}
export function dollars(raw){const n=BigInt(raw);return (n/MONEY_SCALE).toString()+'.'+(n%MONEY_SCALE).toString().padStart(6,'0').replace(/0+$/,'').padEnd(1,'0')}
export function newTask(input,key,now=Date.now()){
 if(!/^[-0-9a-f]{36}$/i.test(key))throw Error('Invalid task access key');
 const payer=addr(input?.payer);if(!payer)throw Error('Connect a nonzero Atlantic EVM buyer wallet');
 const budget=money(input.budgetUSDC??'0.010');
 const perCall=money(input.priceCapUSDC??'0.005');
 if(perCall>budget)throw Error('Per-call limit cannot exceed total task budget');
 const kind=String(input?.kind||'bundle');
 if(!['bundle','budget-stop'].includes(kind))throw Error('Unknown agent task');
 return {
  id:key.slice(0,8),payer,kind,
  createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),
  state:'RUNNING',budgetAtomic:budget.toString(),priceCapAtomic:perCall.toString(),
  spentAtomic:'0',spentUSDC:'0.0',totalPurchases:0,stoppedReason:null,
  steps:ROUTES.map((r,i)=>({
   index:i,id:r.id,path:r.path,title:r.name,status:'PLANNED',
   quotedAmount:null,quotedUSDC:null,quote:null,
   reason:null,transactionHash:null,purchasedAt:null,
   data:null,attempts:0,authorizationId:null,receiptVerified:false,
   history:[]
  })),
  log:[{at:new Date(now).toISOString(),event:'TASK_CREATED',
   note:'Task created; no test USDC transferred',runningTotal:'0.0'}]
 };
}
export function validateChallenge(challenge,route,origin){
 const expectedUrl=origin+route.path;
 if(!challenge||challenge.x402Version!==2||!challenge.resource||
  challenge.resource.url!==expectedUrl||!Array.isArray(challenge.accepts))
  throw Error('Merchant returned an invalid or wrong-resource x402 v2 challenge');
 const candidates=challenge.accepts.filter(o=>o&&o.scheme==='exact'&&o.network===NETWORK&&
  String(o.asset||'').toLowerCase()===USDC.toLowerCase()&&
  addr(o.payTo)&&o.extra?.assetTransferMethod==='eip3009'&&
  o.extra?.name==='USDC'&&o.extra?.version==='2'&&
  /^\d+$/.test(String(o.amount))&&BigInt(o.amount)>0n);
 if(candidates.length!==1)throw Error('Exactly one trusted Atlantic EIP-3009 test USDC payment option is required');
 const quote=candidates[0],amount=BigInt(quote.amount);
 if(amount>MAX_QUOTE)throw Error('Merchant price exceeds the global hard safety cap of 0.05 test USDC');
 if(!Number.isSafeInteger(Number(quote.maxTimeoutSeconds||300))||Number(quote.maxTimeoutSeconds||300)>3600)
  throw Error('Unexpected merchant payment timeout');
 return {offer:quote,resource:challenge.resource,amount};
}
export function decide(task,amount){
 const raw=BigInt(amount),spent=BigInt(task.spentAtomic);
 if(raw>BigInt(task.priceCapAtomic))
  return {allowed:false,state:'STOPPED_PRICE_CAP',reason:'The merchant price '+dollars(raw)+' USDC exceeds the per-call cap '+dollars(task.priceCapAtomic)+' USDC.'};
 if(raw+spent>BigInt(task.budgetAtomic))
  return {allowed:false,state:'STOPPED_BUDGET',reason:'The next price '+dollars(raw)+' USDC would exceed the task budget '+dollars(task.budgetAtomic)+' USDC (spent '+dollars(spent)+').'};
 return {allowed:true,state:'ALLOW',reason:null};
}
export function verifySignedEnvelope(payload,task,step,now=Date.now()){
 if(!payload||payload.x402Version!==2||!payload.payload||!payload.accepted||!payload.resource)
  throw Error('A signed x402 v2 payment payload is required');
 if(!step.quote||step.status!=='AWAITING_SIGNATURE')
  throw Error('The quote is not available for signing');
 const {offer,resource}=step.quote;
 if(payload.resource.url!==resource.url||JSON.stringify(payload.accepted)!==JSON.stringify(offer))
  throw Error('Signed payment does not match the exact quoted resource and accepted price');
 const authorization=payload.payload.authorization,signature=payload.payload.signature;
 if(!authorization||typeof signature!=='string'||!/^0x[0-9a-f]{130}$/i.test(signature)||
    typeof authorization.nonce!=='string'||!/^0x[0-9a-f]{64}$/i.test(authorization.nonce))
  throw Error('Malformed authorization or signature');
 if(addr(authorization.from)?.toLowerCase()!==task.payer.toLowerCase()||
   addr(authorization.to)?.toLowerCase()!==addr(offer.payTo)?.toLowerCase()||
   !/^\d+$/.test(String(authorization.value))||
   BigInt(authorization.value)!==BigInt(offer.amount))
  throw Error('Authorization payer, payee or price differs from reviewed quote');
 if(!/^\d+$/.test(String(authorization.validAfter))||!/^\d+$/.test(String(authorization.validBefore)))
  throw Error('Authorization window is invalid');
 const current=BigInt(Math.floor(now/1000));
 if(BigInt(authorization.validAfter)>current||BigInt(authorization.validBefore)<=current||
   BigInt(authorization.validBefore)>current+300n)
  throw Error('Authorization expired or exceeds the price request timeout');
 const domain={name:offer.extra.name,version:offer.extra.version,
   chainId:CHAIN_ID,verifyingContract:offer.asset};
 const value={
  from:addr(authorization.from),to:addr(authorization.to),
  value:String(authorization.value),validAfter:String(authorization.validAfter),
  validBefore:String(authorization.validBefore),nonce:authorization.nonce
 };
 let signer;try{signer=verifyTypedData(domain,TYPE,value,signature)}
 catch{throw Error('EIP-712 authorization signature invalid')}
 if(signer.toLowerCase()!==task.payer.toLowerCase())
  throw Error('Signed authorization is not from the task buyer wallet');
 const authorizationId=keccak256(toUtf8Bytes(NETWORK+':'+offer.asset.toLowerCase()+':'+
  signer.toLowerCase()+':'+authorization.nonce.toLowerCase()));
 return {authorizationId,payer:signer,amount:BigInt(offer.amount)};
}
export function record(task,event,step,details={}){
 const now=new Date().toISOString();
 task.updatedAt=now;
 task.log.unshift({at:now,event,step:step?.id??null,
  ...details,runningTotal:dollars(task.spentAtomic)});
 if(task.log.length>80)task.log.length=80;
}
export function finalizePaid(task,step,receipt,verifiedData){
 if(step.status==='PAID')return task; // Idempotent completion.
 if(!['SETTLEMENT_PENDING','NEEDS_RECONCILIATION'].includes(step.status))
  throw Error('Cannot mark an unsubmitted step as paid');
 if(!receipt?.transaction||receipt.success!==true||!/^0x[0-9a-f]{64}$/i.test(receipt.transaction))
  throw Error('A real success receipt with a transaction hash is required');
 step.status='PAID';step.receiptVerified=true;
 step.transactionHash=receipt.transaction;step.purchasedAt=new Date().toISOString();
 step.data=verifiedData??step.data??null;step.reason=null;
 task.spentAtomic=(BigInt(task.spentAtomic)+BigInt(step.quotedAmount)).toString();
 task.spentUSDC=dollars(task.spentAtomic);task.totalPurchases+=1;
 step.history.push({at:new Date().toISOString(),status:'PAID',hash:receipt.transaction,
  amountUSDC:dollars(step.quotedAmount)});
 record(task,'PAYMENT_VERIFIED',step,{
  priceUSDC:dollars(step.quotedAmount),whatBought:step.title,
  transactionHash:receipt.transaction,success:true
 });
 if(task.steps.every(p=>p.status==='PAID')){
  task.state='COMPLETED';
  record(task,'TASK_COMPLETED',null,{note:'Both paid API results obtained after on-chain settlement'});
 }
 return task;
}
export function simulateTask(kind='complete'){
 if(!['complete','budget-stop'].includes(kind))throw Error('Unknown simulation kind');
 const budget=kind==='complete'?5000n:2000n;
 const quotes=[1000n,3000n];let spent=0n;
 const items=[];
 for(let i=0;i<2;i++){
  const price=quotes[i];
  if(spent+price>budget){
   items.push({endpoint:ROUTES[i].path,priceUSDC:dollars(price),result:'STOPPED_BUDGET',txHash:null});
   break;
  }
  spent+=price;
  items.push({endpoint:ROUTES[i].path,priceUSDC:dollars(price),result:'SIMULATED_PURCHASE_ONLY',txHash:null});
 }
 return {
  mode:'DRY_RUN_ONLY',onChainPayment:false,realTxHashes:[],
  type:kind,budgetUSDC:dollars(budget),spentUSDC:dollars(spent),
  state:items.every(x=>x.result==='SIMULATED_PURCHASE_ONLY')?'SIMULATED_COMPLETED':'SIMULATED_STOPPED_BUDGET',
  steps:items,note:'Illustrative budget logic only. No wallet signature, API purchase, transaction or funds moved.'
 };
}
