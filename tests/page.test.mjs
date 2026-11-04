import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {PAGE} from '../src/page.mjs';
test('buyer UI includes both paid x402 routes, total cap, price guard, actual receipt journal',()=>{
 for(const text of ['X402','AGENT BUYER','Total task budget','Maximum price per call',
  'Advance agent / check next price','Sign & pay approved step',
  'Retry proven no-charge failure','Recheck known transaction',
  'Running','PAYMENT','/api/insights','/api/report','DRY_RUN_ONLY']){
   // Case insensitive for status headings.
   assert.ok(PAGE.toUpperCase().includes(text.toUpperCase()),'Missing UI token '+text);
 }
});
test('browser script compiles and signs solely through the user wallet',()=>{
 const m=PAGE.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(m,'Missing browser application script');
 new Script(m[1]);
 assert.match(m[1],/eth_signTypedData_v4/);
 assert.match(m[1],/wallet_switchEthereumChain/);
 assert.match(m[1],/crypto\.randomUUID\(\)/);
 assert.doesNotMatch(m[1],/PRIVATE_KEY\s*=/i);
 assert.doesNotMatch(m[1],/eth_sendRawTransaction|eth_sendTransaction/i);
});
test('dry-run is clearly marked not paid and privacy controls exist',()=>{
 assert.match(PAGE,/Dry-run examples below do not charge/);
 assert.match(PAGE,/private task access key/i);
 assert.match(PAGE,/localStorage/);
 assert.match(PAGE,/No paid data yet/);
});
