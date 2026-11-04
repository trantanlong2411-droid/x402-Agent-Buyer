import {Interface} from 'ethers';
import {CHAIN_ID,NETWORK,USDC,RPC_DEFAULT,EXPLORER} from './config.mjs';
export const TOKEN=new Interface([
 'function transferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce,uint8 v,bytes32 r,bytes32 s)',
 'event Transfer(address indexed from,address indexed to,uint256 value)'
]);
const bigint=(value,name)=>{
 if(typeof value!=='string'||!/^0x[0-9a-f]+$/i.test(value))
  throw Error('Invalid '+name+' on Atlantic JSON-RPC');
 return BigInt(value);
};
let rpcCounter=0;
export async function rpc(config,method,params=[]){
 const allowed=['eth_chainId','eth_getTransactionByHash','eth_getTransactionReceipt','eth_blockNumber'];
 if(!allowed.includes(method))throw Error('Forbidden RPC method');
 let last;
 for(let i=0;i<3;i++){
  try{
   const id=++rpcCounter;
   const response=await fetch(config.rpc||RPC_DEFAULT,{method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id,method,params}),
    signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('Atlantic RPC HTTP '+response.status);
   const body=await response.json();
   if(body.id!==id||body.jsonrpc!=='2.0')throw Error('Unexpected Atlantic RPC response ID');
   if(body.error)throw Error('Atlantic RPC: '+String(body.error.message||'RPC error').slice(0,120));
   return body.result;
  }catch(e){last=e;if(i<2)await new Promise(r=>setTimeout(r,(i+1)*450))}
 }
 throw Error(String(last?.message||last||'RPC timeout').slice(0,160));
}
export function verifyTransferEvidence(tx,receipt,step,payer){
 if(!tx||!receipt)return {ok:false,reason:'Transaction receipt not yet available'};
 if(bigint(receipt.status,'receipt status')!==1n)
  return {ok:false,reason:'Transaction reverted on chain'};
 if(String(tx.hash||'').toLowerCase()!==String(receipt.transactionHash||'').toLowerCase())
  return {ok:false,reason:'Transaction hash and receipt mismatch'};
 if(String(tx.to||'').toLowerCase()!==USDC.toLowerCase())
  return {ok:false,reason:'Settlement did not call the configured test USDC'};
 let decoded;
 try{decoded=TOKEN.parseTransaction({data:tx.input||tx.data||'0x'})}
 catch{return {ok:false,reason:'No compatible EIP-3009 transferWithAuthorization calldata'};}
 if(decoded?.name!=='transferWithAuthorization'||
   String(decoded.args[0]).toLowerCase()!==payer.toLowerCase()||
   String(decoded.args[1]).toLowerCase()!==String(step.quote?.offer?.payTo||'').toLowerCase()||
   BigInt(decoded.args[2])!==BigInt(step.quotedAmount))
  return {ok:false,reason:'Settled EIP-3009 recipient or amount differs from the quoted task'};
 const log=(receipt.logs||[]).find(l=>{
  if(String(l.address||'').toLowerCase()!==USDC.toLowerCase())return false;
  try{
   const e=TOKEN.parseLog({topics:l.topics,data:l.data});
   return e?.name==='Transfer'&&
    String(e.args[0]).toLowerCase()===payer.toLowerCase()&&
    String(e.args[1]).toLowerCase()===String(step.quote?.offer?.payTo||'').toLowerCase()&&
    BigInt(e.args[2])===BigInt(step.quotedAmount);
  }catch{return false}
 });
 if(!log)return {ok:false,reason:'Confirmed receipt is missing an exact USDC Transfer event'};
 return {ok:true,block:bigint(receipt.blockNumber,'receipt block').toString(),reason:null};
}
export async function verifyLiveReceipt(txHash,step,payer,c,transport=rpc){
 if(!/^0x[0-9a-f]{64}$/i.test(String(txHash||'')))throw Error('Missing real Atlantic transaction hash');
 const chain=bigint(await transport(c,'eth_chainId',[]),'chain ID');
 if(chain!==BigInt(CHAIN_ID))throw Error('RPC points to wrong chain');
 const [tx,receipt]=await Promise.all([
  transport(c,'eth_getTransactionByHash',[txHash]),
  transport(c,'eth_getTransactionReceipt',[txHash])
 ]);
 const checked=verifyTransferEvidence(tx,receipt,step,payer);
 if(!checked.ok)throw Error(checked.reason);
 return {ok:true,network:NETWORK,transaction:txHash,block:checked.block,
  explorer:EXPLORER+txHash,verifiedOnChain:true};
}
export function decodeHeader(header){
 if(typeof header!=='string'||header.length>20000)throw Error('Payment header absent or oversized');
 let obj;
 try{obj=JSON.parse(atob(header))}catch{throw Error('Malformed x402 base64 JSON header')}
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Invalid x402 header');
 return obj;
}
export function validateMerchantReceipt(header,body,step,payer){
 const receipt=decodeHeader(header);
 if(receipt.success!==true||receipt.network!==NETWORK||
  String(receipt.payer||'').toLowerCase()!==payer.toLowerCase()||
  !/^0x[0-9a-f]{64}$/i.test(String(receipt.transaction||''))||
  !body?.ok||!body.payment||
  String(body.payment.transaction||'').toLowerCase()!==receipt.transaction.toLowerCase())
  throw Error('Merchant did not return a matching paid x402 receipt and data');
 return receipt;
}
