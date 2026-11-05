import {mkdir,writeFile} from 'node:fs/promises';
import {formatUnits} from 'ethers';
import {rpc,TOKEN} from '../src/chain.mjs';
import {USDC,NETWORK,SELLER_DEFAULT,EXPLORER} from '../src/config.mjs';
const hashes=[
'0xdf57e0785b6e0997fcd1dc56a40e9db64a978f97b3e6ba451bc4150d1b2bcc7e',
'0xc0e8387c01e147928b38e825dfc33e07c7502d8c17d071705a2ae4495966dab1'
];
const c={rpc:process.env.ATLANTIC_RPC_URL||'https://atlantic.dplabs-internal.com'};
const low=x=>String(x||'').toLowerCase();
const seen=new Set();
const evidence={
 schema:'pharos-x402-agent-buyer-new-two-hashes-audit-v1',
 observedAtUtc:new Date().toISOString(),network:NETWORK,
 verifier:'Independent read-only Pharos Atlantic JSON-RPC and decoded EIP-3009 USDC Transfer event',
 userSubmittedLinksCount:3,distinctTransactionHashes:hashes.length,
 tokenContract:USDC,transactions:[],
 buyerAgentCompletedStatus:'UNVERIFIED_NO_PRIVATE_TASK_JOURNAL',
 merchantHttp200AndPaymentResponse:'NOT_INCLUDED_IN_PUBLIC_TRANSACTION',
 note:'EIP-3009 settlement proves USDC transfer, but not which HTTP endpoint served data or whether the buyer agent logged task completion.'
};
const chain=await rpc(c,'eth_chainId',[]);
if(BigInt(chain)!==688689n)throw Error('The RPC is not Pharos Atlantic chain 688689');
for(const hash of hashes){
 if(seen.has(low(hash)))continue;seen.add(low(hash));
 const item={hash,explorer:EXPLORER+hash,network:NETWORK,
  found:false,receiptSuccess:false,tokenMatches:false,
  method:null,amountUSDC:null,payer:null,receiver:null,relayer:null,
  payerDiffersReceiver:false,matchingTransferEvent:false,block:null,issue:null};
 try{
  const [tx,receipt]=await Promise.all([
   rpc(c,'eth_getTransactionByHash',[hash]),
   rpc(c,'eth_getTransactionReceipt',[hash])
  ]);
  if(!tx||!receipt){item.issue='Not found/indexed';evidence.transactions.push(item);continue;}
  item.found=true;item.block=BigInt(receipt.blockNumber).toString();
  item.receiptSuccess=BigInt(receipt.status||'0x0')===1n;
  item.tokenMatches=low(tx.to)===low(USDC);item.tokenContract=tx.to;
  item.relayer=tx.from;
  const decoded=TOKEN.parseTransaction({data:tx.input||tx.data||'0x'});
  item.method=decoded?.name||null;
  if(item.method==='transferWithAuthorization'){
   item.payer=String(decoded.args[0]);
   item.receiver=String(decoded.args[1]);
   item.amountAtomic=String(decoded.args[2]);
   item.amountUSDC=formatUnits(decoded.args[2],6);
   item.authorizationNonce=String(decoded.args[5]);
   item.payerDiffersReceiver=low(item.payer)!==low(item.receiver);
   item.matchingTransferEvent=(receipt.logs||[]).some(log=>{
    if(low(log.address)!==low(USDC))return false;
    try{const ev=TOKEN.parseLog({topics:log.topics,data:log.data});
     return ev?.name==='Transfer'&&
      low(ev.args[0])===low(item.payer)&&low(ev.args[1])===low(item.receiver)&&
      String(ev.args[2])===item.amountAtomic;
    }catch{return false}
   });
  }
  item.validEip3009Transfer=Boolean(item.receiptSuccess&&item.tokenMatches&&
   item.method==='transferWithAuthorization'&&item.matchingTransferEvent);
  item.distinctMerchantPurchaseCandidate=Boolean(item.validEip3009Transfer&&item.payerDiffersReceiver);
  if(!item.validEip3009Transfer)item.issue='No verified matching USDC EIP-3009 transfer';
  else if(!item.payerDiffersReceiver)item.issue='The payer and receiver are identical (self-transfer)';
 }catch(e){item.issue='RPC/decoder error: '+String(e.message||e).slice(0,150);}
 evidence.transactions.push(item);
 console.log('NEW_BUYER_TRANSACTION_AUDIT',JSON.stringify(item));
}
const valid=evidence.transactions.filter(t=>t.validEip3009Transfer);
evidence.verifiedUSDCTransactions=valid.length;
evidence.totalGrossUSDC=formatUnits(valid.reduce((a,t)=>a+BigInt(t.amountAtomic),0n),6);
evidence.twoDistinctPayers=valid.length===2&&low(valid[0].payer)!==low(valid[1].payer);
evidence.sameBuyer=valid.length===2&&low(valid[0].payer)===low(valid[1].payer);
evidence.sameReceiver=valid.length===2&&low(valid[0].receiver)===low(valid[1].receiver);
evidence.twoNonces=valid.length===2&&low(valid[0].authorizationNonce)!==low(valid[1].authorizationNonce);
evidence.notSelfTransfers=valid.length===2&&valid.every(t=>t.payerDiffersReceiver);
evidence.amountsMatchExpectedTwoPaidRoutes=
 valid.length===2&&['0.001','0.003'].every(amount=>valid.some(t=>t.amountUSDC===amount));
try{
 const offers={};const recipients={};
 for(const route of ['/api/insights','/api/report']){
  const r=await fetch(SELLER_DEFAULT+route,{signal:AbortSignal.timeout(12000)});
  if(r.status!==402)throw Error('Seller '+route+' HTTP '+r.status);
  const raw=r.headers.get('PAYMENT-REQUIRED');
  if(!raw)throw Error('No PAYMENT-REQUIRED for '+route);
  const data=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
  const offer=data?.accepts?.[0];
  if(offer?.network!==NETWORK||low(offer?.asset)!==low(USDC))throw Error('Unexpected token or chain');
  offers[route]=formatUnits(BigInt(offer.amount),6);recipients[route]=offer.payTo;
 }
 evidence.liveQuotesUSDC=offers;evidence.liveReceivers=recipients;
 evidence.matchCurrentRoutePrices=valid.length===2&&
   valid.some(t=>t.amountUSDC===offers['/api/insights']&&low(t.receiver)===low(recipients['/api/insights']))&&
   valid.some(t=>t.amountUSDC===offers['/api/report']&&low(t.receiver)===low(recipients['/api/report']));
}catch(e){evidence.sellerQuoteError=String(e.message||e).slice(0,200)}
evidence.onchainTwoRoutePaymentEvidence=Boolean(evidence.notSelfTransfers&&evidence.sameBuyer&&
 evidence.twoNonces&&evidence.matchCurrentRoutePrices);
await mkdir('proof',{recursive:true});
await writeFile('proof/new-buyer-two-transaction-audit.json',JSON.stringify(evidence,null,2)+'\n');
console.log('NEW_BUYER_TWO_HASH_SUMMARY',JSON.stringify({
 verified:valid.length,totalGrossUSDC:evidence.totalGrossUSDC,
 sameBuyer:evidence.sameBuyer,notSelfTransfers:evidence.notSelfTransfers,
 amountsMatchExpectedTwoPaidRoutes:evidence.amountsMatchExpectedTwoPaidRoutes,
 matchCurrentRoutePrices:evidence.matchCurrentRoutePrices,
 transactionHashCount:evidence.transactions.length,
 buyerAgentState:evidence.buyerAgentCompletedStatus
}));
if(valid.length!==2)throw Error('Not both hashes are verified successful USDC EIP-3009 transfers');
