import {mkdir,writeFile} from 'node:fs/promises';
import {formatUnits} from 'ethers';
import {rpc,TOKEN} from '../src/chain.mjs';
import {NETWORK,USDC,EXPLORER,SELLER_DEFAULT} from '../src/config.mjs';

const TRANSACTIONS=[
 '0x4aac620082af15d20b12543a7c39fc853fbeda76ac89c2c641c5bd597ec2db30',
 '0x6527281d3034e025466aacbf6809f6c6993fa06597dea0886d45fc0e9d8e7118'
];
const evidence={
 schema:'pharos-x402-agent-buyer-user-supplied-transactions-check-v1',
 observedAtUtc:new Date().toISOString(),
 network:NETWORK,
 tokenContractExpected:USDC,
 claimedPricesUser:['0.005','0.003'],
 expectedMerchantRoutes:{
  '/api/insights':'0.001',
  '/api/report':'0.003'
 },
 source:'Read-only Pharos Atlantic JSON-RPC transaction+receipt inspection; user-supplied hashes',
 transactions:[],
 actualBuyerTaskState:'UNVERIFIED_PRIVATE_TASK_ACCESS_KEY_NOT_PROVIDED',
 actualHttp402To200:'UNVERIFIED_NO_BROWSER_PAYMENT_RESPONSE_SUPPLIED',
 note:'Transactions alone do not prove the private Agent Buyer task has two paid states, received data, or reached COMPLETED.'
};
const config={rpc:process.env.ATLANTIC_RPC_URL||'https://atlantic.dplabs-internal.com'};
const chain=await rpc(config,'eth_chainId',[]);
if(BigInt(chain)!==688689n)throw Error('Wrong chain ID');
const norm=x=>String(x||'').toLowerCase();
for(const hash of TRANSACTIONS){
 const item={hash,explorer:EXPLORER+hash,found:false,success:false,
  chainId:688689,contractMatches:false,method:null,amountUSDC:null,
  payer:null,receiver:null,relayer:null,nonce:null,transferEventMatches:false,
  blockNumber:null,issue:null};
 try{
  const [tx,receipt]=await Promise.all([
   rpc(config,'eth_getTransactionByHash',[hash]),
   rpc(config,'eth_getTransactionReceipt',[hash])
  ]);
  if(!tx||!receipt){item.issue='Transaction or receipt not yet indexed';evidence.transactions.push(item);continue;}
  item.found=true;item.success=BigInt(receipt.status||'0x0')===1n;
  item.blockNumber=BigInt(receipt.blockNumber).toString();
  item.relayer=tx.from;
  item.contract=tx.to;
  item.contractMatches=norm(tx.to)===norm(USDC);
  item.valueWei=String(BigInt(tx.value||'0x0'));
  const decoded=TOKEN.parseTransaction({data:tx.input||tx.data||'0x'});
  item.method=decoded?.name||null;
  if(decoded?.name==='transferWithAuthorization'){
   item.payer=decoded.args[0];item.receiver=decoded.args[1];
   item.amountAtomic=decoded.args[2].toString();
   item.amountUSDC=formatUnits(decoded.args[2],6);
   item.nonce=String(decoded.args[5]);
  }
  if(item.payer){
   item.transferEventMatches=(receipt.logs||[]).some(log=>{
    try{
     if(norm(log.address)!==norm(USDC))return false;
     const ev=TOKEN.parseLog({data:log.data,topics:log.topics});
     return ev?.name==='Transfer'&&
      norm(ev.args[0])===norm(item.payer)&&
      norm(ev.args[1])===norm(item.receiver)&&
      String(ev.args[2])===item.amountAtomic;
    }catch{return false}
   });
  }
  item.confirmedExactUsdcEip3009=Boolean(item.success&&item.contractMatches&&
   item.method==='transferWithAuthorization'&&item.transferEventMatches);
  if(!item.success)item.issue='Transaction receipt status is not successful';
  else if(!item.contractMatches)item.issue='Transaction targeted another token or contract';
  else if(!item.confirmedExactUsdcEip3009)item.issue='Missing exact EIP-3009 calldata or USDC Transfer log';
 }catch(err){item.issue='RPC or decoding error: '+String(err.message||err).slice(0,180)}
 evidence.transactions.push(item);
 console.log('USER_X402_TRANSACTION_CHECK',JSON.stringify(item));
}
const confirmed=evidence.transactions.filter(x=>x.confirmedExactUsdcEip3009);
evidence.confirmedExactUsdcEip3009Count=confirmed.length;
evidence.totalConfirmedUSDC=formatUnits(confirmed.reduce((acc,x)=>acc+BigInt(x.amountAtomic),0n),6);
evidence.samePayer=confirmed.length===2&&norm(confirmed[0].payer)===norm(confirmed[1].payer);
evidence.sameReceiver=confirmed.length===2&&norm(confirmed[0].receiver)===norm(confirmed[1].receiver);
evidence.distinctNonces=confirmed.length===2&&norm(confirmed[0].nonce)!==norm(confirmed[1].nonce);
const amounts=confirmed.map(x=>x.amountUSDC);
evidence.matchesDefaultTwoEndpointPrices=
 confirmed.length===2&&amounts.includes('0.001')&&amounts.includes('0.003');
try{
 const merchant={};
 for(const route of ['/api/insights','/api/report']){
  const response=await fetch(SELLER_DEFAULT+route,{signal:AbortSignal.timeout(15000)});
  if(response.status!==402)throw Error('Seller returned HTTP '+response.status);
  const header=response.headers.get('PAYMENT-REQUIRED');
  if(!header)throw Error('Missing PAYMENT-REQUIRED');
  const quote=JSON.parse(Buffer.from(header,'base64').toString('utf8'));
  const amount=quote?.accepts?.[0]?.amount;
  if(!/^\d+$/.test(String(amount)))throw Error('No positive atomic amount');
  merchant[route]=formatUnits(BigInt(amount),6);
 }
 evidence.liveMerchantQuoteUSDC=merchant;
 evidence.matchesLiveMerchantTwoEndpointPrices=
  confirmed.length===2&&
  amounts.includes(merchant['/api/insights'])&&
  amounts.includes(merchant['/api/report']);
}catch(err){evidence.liveMerchantQuoteError=String(err.message||err).slice(0,180)}
await mkdir('proof',{recursive:true});
await writeFile('proof/user-transactions-verified.json',JSON.stringify(evidence,null,2)+'\n');
console.log('USER_X402_TWO_TX_AUDIT_SUMMARY',JSON.stringify({
 checks:confirmed.length,
 paidAmounts:amounts,
 totalConfirmedUSDC:evidence.totalConfirmedUSDC,
 samePayer:evidence.samePayer,
 matchesDefaultTwoEndpointPrices:evidence.matchesDefaultTwoEndpointPrices,
 matchesLiveMerchantTwoEndpointPrices:evidence.matchesLiveMerchantTwoEndpointPrices,
 buyerTaskState:evidence.actualBuyerTaskState
}));
if(confirmed.length!==2)throw Error('At least one reported transaction is not a verified USDC EIP-3009 settlement');
