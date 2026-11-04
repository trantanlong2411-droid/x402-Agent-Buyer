import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet} from 'ethers';
import {TOKEN,verifyTransferEvidence,verifyLiveReceipt,validateMerchantReceipt} from '../src/chain.mjs';
import {USDC,NETWORK} from '../src/config.mjs';
const payer=Wallet.createRandom().address,payTo=Wallet.createRandom().address,relay=Wallet.createRandom().address;
const hash='0x'+'ab'.repeat(32);
function fixture(){
 const data=TOKEN.encodeFunctionData('transferWithAuthorization',[
  payer,payTo,1000n,100n,10000000000n,'0x'+'11'.repeat(32),27,
  '0x'+'22'.repeat(32),'0x'+'33'.repeat(32)]);
 const event=TOKEN.encodeEventLog(TOKEN.getEvent('Transfer'),[payer,payTo,1000n]);
 const step={quotedAmount:'1000',quote:{offer:{payTo}}};
 const tx={hash,to:USDC,from:relay,input:data};
 const receipt={transactionHash:hash,status:'0x1',blockNumber:'0x100',
  logs:[{address:USDC,topics:event.topics,data:event.data}]};
 return {step,tx,receipt};
}
test('requires real successful on-chain receipt, exact calldata and USDC Transfer',()=>{
 const {step,tx,receipt}=fixture();
 assert.equal(verifyTransferEvidence(tx,receipt,step,payer).ok,true);
 assert.equal(verifyTransferEvidence(tx,{...receipt,status:'0x0'},step,payer).ok,false);
 assert.equal(verifyTransferEvidence(tx,{...receipt,logs:[]},step,payer).ok,false);
 assert.equal(verifyTransferEvidence({...tx,to:payTo},receipt,step,payer).ok,false);
 assert.equal(verifyTransferEvidence({...tx,input:'0x1234'},receipt,step,payer).ok,false);
 assert.equal(verifyTransferEvidence(tx,receipt,{...step,quotedAmount:'3000'},payer).ok,false);
});
test('onchain RPC recheck verifies the Atlantic chain and known tx hash',async()=>{
 const {step,tx,receipt}=fixture();
 const mocked=async(_,method)=>{
  if(method==='eth_chainId')return '0xa8231';
  if(method==='eth_getTransactionByHash')return tx;
  if(method==='eth_getTransactionReceipt')return receipt;
  throw Error('Unexpected RPC '+method);
 };
 const r=await verifyLiveReceipt(hash,step,payer,{},mocked);
 assert.equal(r.ok,true);assert.equal(r.block,'256');assert.equal(r.network,NETWORK);
 await assert.rejects(verifyLiveReceipt('0xbad',step,payer,{},mocked),/real Atlantic transaction hash/);
 await assert.rejects(verifyLiveReceipt(hash,step,payer,{},async()=> '0x1'),/wrong chain/);
});
test('merchant 200 must include PAYMENT-RESPONSE and matching tx and buyer',()=>{
 const {step}=fixture();
 const receipt={success:true,network:NETWORK,transaction:hash,payer};
 const header=btoa(JSON.stringify(receipt));
 const result=validateMerchantReceipt(header,{ok:true,payment:receipt,data:{test:true}},step,payer);
 assert.equal(result.transaction,hash);
 assert.throws(()=>validateMerchantReceipt(header,{ok:true,payment:{transaction:'0x'+'a'.repeat(64)}},step,payer),/matching/);
 assert.throws(()=>validateMerchantReceipt(null,{ok:true,payment:receipt},step,payer),/absent/);
});
