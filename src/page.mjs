export const PAGE=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="An x402 autonomous price-deciding buyer agent for Pharos Atlantic with strict budgets, paid API receipt logs and safe retries.">
<title>x402 Agent Buyer — Pharos</title>
<style>
:root{color-scheme:dark;--bg:#081226;--pane:#14243f;--pane2:#0c1c33;--line:#385573;--muted:#a8bddd;--accent:#b7c7ff;--green:#6ce9c5;--red:#ff9aa9;--gold:#f6d18c}
*{box-sizing:border-box}body{margin:0;color:#eaf2ff;background:radial-gradient(ellipse at 8% -18%,#253e69,#0d1930 48%,var(--bg));font:14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1190px;margin:auto;padding:26px 21px 70px}a{color:var(--accent)}h1{font-size:clamp(48px,7.8vw,84px);line-height:1.02;letter-spacing:-.068em;margin:54px 0 18px}h1 em{font-style:normal;color:var(--accent)}h2{font-size:22px;margin:0 0 12px}h3{font-size:16px;margin:10px 0}
header,.row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
header{font-size:12px;letter-spacing:.06em}.pill{border:1px solid #526e94;border-radius:99px;padding:3px 9px;font-size:11px;letter-spacing:0}
.lead{color:var(--muted);font-size:18px;max-width:860px}.notice{border:1px solid #8b7243;background:#342c25;color:#ffe1a5;padding:16px;border-radius:13px;margin:23px 0}
.steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:23px 0}.steps>div{border:1px solid #3d5978;background:#10213c;border-radius:12px;padding:13px}.steps b{color:var(--green);display:block}.steps small{font-size:11px;color:var(--muted)}
.grid{display:grid;grid-template-columns:1.05fr .95fr;gap:17px}.panel{border:1px solid var(--line);background:rgba(19,34,59,.98);border-radius:17px;padding:23px;margin-bottom:17px}
label{display:block;font-size:12px;color:#bfcee9;margin:12px 0 5px}input,select{width:100%;padding:12px;background:#08182e;border:1px solid #4a678b;border-radius:10px;color:#edf4ff;font:inherit}
.twocol{display:grid;grid-template-columns:1fr 1fr;gap:10px}.small,small{font-size:12px;color:var(--muted)}
button{border:0;border-radius:9px;padding:11px 15px;background:#b9caff;color:#09162e;font:700 13px system-ui;cursor:pointer}
button.secondary{background:#355376;color:#f3f7ff}button:disabled{opacity:.42;cursor:not-allowed}
.actions{display:flex;gap:9px;flex-wrap:wrap;margin:13px 0}.status{border:1px solid #3b5c7e;background:#0b1b34;border-radius:10px;padding:12px;margin:13px 0;overflow-wrap:anywhere}
.ok{color:var(--green)}.bad{color:var(--red)}.gold{color:var(--gold)}
.statgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.stat{border:1px solid #395577;background:#0c1a33;padding:11px;border-radius:10px}.stat small{display:block}.stat b{display:block;font-size:20px}
table{width:100%;border-collapse:collapse}th,td{font-size:12px;padding:10px;border-bottom:1px solid #324a68;text-align:left;vertical-align:top;overflow-wrap:anywhere}
pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:370px;overflow:auto;padding:13px;background:#07152a;border:1px solid #355272;border-radius:10px;font:12px/1.6 ui-monospace,Consolas,monospace}
code{overflow-wrap:anywhere;color:#c1d1ff}.demo{background:#0c1e35;border:1px solid #335371;padding:13px;border-radius:11px;margin:10px 0}
footer{color:var(--muted);font-size:12px;margin-top:35px}
@media(max-width:930px){.grid{grid-template-columns:1fr}.steps{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:650px){.steps,.statgrid,.twocol{grid-template-columns:1fr 1fr}h1{margin-top:30px}.panel{padding:16px}}
@media(max-width:430px){.steps,.statgrid,.twocol{grid-template-columns:1fr}main{padding:16px 12px}}
</style></head><body><main>
<header><span>PHAROS / AGENT ARENA <span class="pill">HARD · PAYMENTS</span></span><a href="https://github.com/trantanlong2411-droid/x402-Agent-Buyer" target="_blank" rel="noopener">GitHub source & test evidence ↗</a></header>
<h1>X402 <em>AGENT BUYER</em></h1>
<p class="lead">Give the buyer agent a task. It calls two independent x402 paid API routes, checks every live price, enforces a total budget and per-call cap, and records the purchased data, testnet transaction hashes and running spend.</p>
<div class="notice"><b>Real testnet USDC payments require wallet approval.</b> The agent can decide which requests fit your budget, but it never signs from server-side private keys. Only click <b>Sign & pay approved step</b> if you control the testnet buyer wallet and want to spend those test tokens. An uncertain settlement blocks further signatures to prevent double payments. Dry-run examples below do not charge any tokens.</div>
<div class="steps">
<div><b>01 · PLAN</b><small>Two resources for one task</small></div>
<div><b>02 · PRICE</b><small>Parse x402 HTTP 402 challenges</small></div>
<div><b>03 · GUARD</b><small>Budget and per-price cap</small></div>
<div><b>04 · BUY</b><small>Wallet EIP-712 + real receipts</small></div>
<div><b>05 · AUDIT</b><small>Hash, purchased data, running total</small></div>
</div>
<div class="grid"><div>
<section class="panel"><div class="row"><h2>01 / Create a buyer task</h2><button class="secondary" id="connect">Connect Atlantic wallet</button></div>
<p id="wallet" class="small">No wallet connected yet.</p>
<p class="small">The agent is limited to the trusted Pharos x402 Paywalled API seller. A task requests Insights first, then Report, and only moves forward after a verified paid receipt.</p>
<label for="scenario">Demo task</label><select id="scenario">
<option value="bundle">Complete research bundle — two API purchases</option>
<option value="budget-stop">Budget stop — decline second API request</option>
</select>
<div class="twocol"><div><label for="budget">Total task budget (test USDC)</label><input id="budget" value="0.010" inputmode="decimal"></div>
<div><label for="cap">Maximum price per call (test USDC)</label><input id="cap" value="0.005" inputmode="decimal"></div></div>
<div class="actions"><button id="create">Create & start task</button></div>
<div id="createMessage" class="status" role="status">Connect a testnet buyer wallet before creating a live task. Use a separate wallet from your facilitator.</div>
</section>
<section class="panel"><h2>02 / Open your persistent task</h2>
<label for="key">Private task access key</label><input id="key" placeholder="UUIDv4 access key" spellcheck="false">
<p class="small">Keep this key private. It lets someone read and control this task, but cannot authorize any payment without the buyer wallet's signature. It is saved in this browser for convenience.</p>
<div class="actions"><button id="open" class="secondary">Open saved task</button><button id="copyKey" class="secondary">Copy key</button><button id="refresh" class="secondary">Refresh</button></div>
<div class="status" id="status">No task selected.</div>
</section>
</div><aside>
<section class="panel"><h2>03 / Reviewer dry-run demonstrations</h2>
<p class="small">These run the same decision logic with known sample prices <b>0.001</b> and <b>0.003</b> test USDC. They are simulations, NOT blockchain payments or proof of completed settlement.</p>
<div class="actions"><button id="dryRun" class="secondary">Run both dry-run demos</button></div>
<h3>Demo A · Agent completes its plan</h3><pre id="completeDemo">Run the demo to see two simulated purchases within budget.</pre>
<h3>Demo B · Agent stops at the budget</h3><pre id="stopDemo">Run the demo to see second API rejected after the first planned purchase.</pre>
</section>
<section class="panel"><h2>04 / Safety rules</h2>
<p>✓ Only Pharos Atlantic Testnet <code>eip155:688689</code></p><hr>
<p>✓ Only verified Circle test USDC contract</p><hr>
<p>✓ Two different x402 endpoints; merchant prices read from each 402 challenge</p><hr>
<p>✓ Refuse either spending cap before an authorization is signed</p><hr>
<p>✓ Count purchases only after merchant 200 and matching on-chain USDC Transfer</p><hr>
<p>✓ If a submitted payment is uncertain, do not generate another signature</p>
<p class="small"><a href="https://x402-paywalled-api.trantanlong2411.workers.dev/" target="_blank" rel="noopener">Seller's x402 paid API ↗</a></p>
</section>
</aside></div>
<section class="panel" id="manager" hidden><div class="row"><h2>05 / Agent execution and running balance</h2><span class="pill" id="taskState">—</span></div>
<div class="statgrid">
<div class="stat"><small>TOTAL BUDGET</small><b id="sBudget">—</b></div>
<div class="stat"><small>PER-CALL CAP</small><b id="sCap">—</b></div>
<div class="stat"><small>VERIFIED SPENT</small><b id="sSpent">—</b></div>
<div class="stat"><small>PURCHASES</small><b id="sPurchases">0</b></div>
</div>
<div class="status" id="agentMessage">Choose Advance agent to fetch the next live x402 quote.</div>
<div class="actions"><button id="advance">Advance agent / check next price</button><button id="pay">Sign & pay approved step</button><button class="secondary" id="retry">Retry proven no-charge failure</button><button class="secondary" id="reconcile">Recheck known transaction</button></div>
<div class="twocol"><div><h3>Payment ledger</h3><div style="overflow:auto"><table><thead><tr><th>Resource</th><th>Price</th><th>Status</th><th>Receipt</th></tr></thead><tbody id="rows"></tbody></table></div></div>
<div><h3>Task activity</h3><pre id="log"></pre></div></div>
<h3>Purchased data and real transaction details</h3><pre id="results">No paid data yet.</pre>
</section>
<footer>Pharos Atlantic Testnet · x402 v2 exact EIP-3009 · User-controlled wallet signing · Durable SQLite task journal · Two priced API routes · Independent receipt verification · No private keys on the server · Dry runs are clearly distinguished from live payments.</footer>
</main><script>
(function(){
 const $=id=>document.getElementById(id);
 const USDC='0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B';
 const CHAIN='0x'+(688689).toString(16);
 const keyName='pharos-x402-agent-buyer-key';
 let current=null,wallet=null;
 const msg=t=>{$('agentMessage').textContent=t};
 function setWallet(a){wallet=a||null;$('wallet').textContent=wallet?
  'Buyer: '+wallet+' · Pharos Atlantic Testnet':'No wallet connected';}
 async function connect(){
  if(!window.ethereum)throw Error('An EVM wallet (MetaMask or compatible) is required for real testnet signing');
  const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
  if(!accounts?.length)throw Error('No wallet account connected');
  let chain=String(await window.ethereum.request({method:'eth_chainId'})).toLowerCase();
  if(chain!==CHAIN.toLowerCase()){
   try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN}]})}
   catch(e){
    if(e.code!==4902)throw e;
    await window.ethereum.request({method:'wallet_addEthereumChain',params:[{
     chainId:CHAIN,chainName:'Pharos Atlantic Testnet',
     rpcUrls:['https://atlantic.dplabs-internal.com'],
     nativeCurrency:{name:'PHRS',symbol:'PHRS',decimals:18},
     blockExplorerUrls:['https://atlantic.pharosscan.xyz']
    }]});
   }
  }
  const address=String(accounts[0]);setWallet(address);return address;
 }
 async function api(action,fields={}){
  const key=$('key').value.trim();
  const response=await fetch('/api/task',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action,accessKey:key,...fields})});
  const j=await response.json();
  if(!response.ok)throw Error(j.error||'Task API error: HTTP '+response.status);
  return j;
 }
 function selected(){
  if(!current)return null;
  return current.steps.find(s=>!['PAID'].includes(s.status))||null;
 }
 function view(job){
  current=job;$('manager').hidden=false;
  $('taskState').textContent=job.state;
  $('sBudget').textContent=(Number(job.budgetAtomic)/1e6).toFixed(3)+' USDC';
  $('sCap').textContent=(Number(job.priceCapAtomic)/1e6).toFixed(3)+' USDC';
  $('sSpent').textContent=job.spentUSDC+' USDC';
  $('sPurchases').textContent=job.totalPurchases;
  const body=$('rows');body.replaceChildren();
  for(const step of job.steps){
   const tr=body.insertRow();
   tr.insertCell().textContent=step.title;
   tr.insertCell().textContent=step.quotedUSDC?step.quotedUSDC+' USDC':'—';
   tr.insertCell().textContent=step.status;
   const rec=tr.insertCell();
   if(step.transactionHash){
    const a=document.createElement('a');a.href='https://atlantic.pharosscan.xyz/tx/'+step.transactionHash;
    a.target='_blank';a.rel='noopener noreferrer';a.textContent='Explorer TX';rec.appendChild(a);
   }else rec.textContent='No confirmed payment';
  }
  $('log').textContent=JSON.stringify(job.log,null,2);
  $('results').textContent=JSON.stringify(job.steps.map(s=>({
   resource:s.path,state:s.status,amountUSDC:s.quotedUSDC,
   bought:s.status==='PAID',transactionHash:s.transactionHash,
   paidData:s.status==='PAID'?s.data:null
  })),null,2);
  const step=selected();
  $('advance').disabled=job.state!=='RUNNING'||!step||step.status!=='PLANNED';
  $('pay').disabled=job.state!=='RUNNING'||step?.status!=='AWAITING_SIGNATURE';
  $('retry').disabled=job.state!=='RUNNING'||step?.status!=='FAILED_NO_CHARGE';
  $('reconcile').disabled=step?.status!=='NEEDS_RECONCILIATION'||!step.transactionHash;
  if(job.state==='COMPLETED')msg('COMPLETED: Both APIs purchased and on-chain receipts verified. Total '+job.spentUSDC+' test USDC.');
  else if(job.state.startsWith('STOPPED'))msg(job.stoppedReason||'Task stopped by budget guard. No additional signing.');
  else if(step?.status==='AWAITING_SIGNATURE')
   msg('Agent approved '+step.quotedUSDC+' USDC for '+step.title+'. Review the price and click Sign & pay approved step to authorize this ONE purchase.');
  else if(step?.reason)msg(step.status+': '+step.reason);
  else msg('Task '+job.state+'. Click Advance agent to discover the next paid API price.');
 }
 $('connect').onclick=async()=>{try{await connect()}catch(e){$('wallet').textContent=e.message}};
 $('scenario').onchange=()=>{
  if($('scenario').value==='budget-stop'){$('budget').value='0.002';$('cap').value='0.005';}
  else {$('budget').value='0.010';$('cap').value='0.005';}
 };
 $('create').onclick=async()=>{
  $('create').disabled=true;$('createMessage').textContent='Connecting wallet and saving private task…';
  try{
   const payer=await connect(),key=crypto.randomUUID();$('key').value=key;
   const result=await api('create',{payer,kind:$('scenario').value,
    budgetUSDC:$('budget').value,priceCapUSDC:$('cap').value});
   localStorage.setItem(keyName,key);
   view(result.job);
   $('createMessage').textContent='Created task. Save private task key. Agent can now price the first API.';
  }catch(e){$('createMessage').textContent='Creation failed: '+e.message}
  finally{$('create').disabled=false;}
 };
 $('open').onclick=async()=>{
  try{const result=await api('status');localStorage.setItem(keyName,$('key').value.trim());
   view(result.job);}catch(e){$('status').textContent='Cannot open: '+e.message}
 };
 $('refresh').onclick=async()=>{try{view((await api('status')).job)}catch(e){$('status').textContent=e.message}};
 $('copyKey').onclick=()=>navigator.clipboard.writeText($('key').value.trim()).then(()=>
  $('status').textContent='Private task key copied.').catch(()=>{$('status').textContent='Select and copy access key manually.'});
 $('advance').onclick=async()=>{
  $('advance').disabled=true;msg('Agent fetching 402 challenge and applying both spending limits…');
  try{const r=await api('next');view(r.job)}
  catch(e){msg('Could not quote next endpoint: '+e.message)}
  finally{if(current)view(current)}
 };
 function nonce(){return '0x'+Array.from(crypto.getRandomValues(new Uint8Array(32)))
  .map(x=>x.toString(16).padStart(2,'0')).join('')}
 $('pay').onclick=async()=>{
  const step=selected();
  if(!current||!step||step.status!=='AWAITING_SIGNATURE')return;
  $('pay').disabled=true;
  try{
   const account=await connect();
   if(account.toLowerCase()!==current.payer.toLowerCase())
    throw Error('Connected wallet is not the task buyer '+current.payer);
   const offer=step.quote?.offer;
   if(!offer||offer.network!=='eip155:688689'||offer.asset.toLowerCase()!==USDC.toLowerCase())
    throw Error('Invalid Atlantic USDC quote');
   if(!confirm('Sign a TESTNET authorization to spend '+step.quotedUSDC+' USDC for '+step.title+
    '? The facilitator may settle it on-chain. Remaining task budget: '+
    ((BigInt(current.budgetAtomic)-BigInt(current.spentAtomic))/1000000n).toString()+'+ USDC'))
    return;
   const now=Math.floor(Date.now()/1000);
   const authorization={from:account,to:offer.payTo,value:String(offer.amount),
    validAfter:String(now-30),validBefore:String(now+240),nonce:nonce()};
   const data={
    domain:{name:offer.extra.name,version:offer.extra.version,chainId:688689,
     verifyingContract:offer.asset},
    types:{
     EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},
      {name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}],
     TransferWithAuthorization:[
      {name:'from',type:'address'},{name:'to',type:'address'},
      {name:'value',type:'uint256'},{name:'validAfter',type:'uint256'},
      {name:'validBefore',type:'uint256'},{name:'nonce',type:'bytes32'}]
    },primaryType:'TransferWithAuthorization',message:authorization
   };
   msg('Approve EIP-712 authorization in your wallet. No private key is shared with this website.');
   const signature=await window.ethereum.request({
    method:'eth_signTypedData_v4',params:[account,JSON.stringify(data)]});
   const envelope={x402Version:2,resource:step.quote.resource,accepted:offer,
    payload:{signature,authorization}};
   msg('Signature accepted locally; submitting ONCE to merchant and verifying actual on-chain receipt…');
   const r=await api('pay',{stepId:step.id,paymentPayload:envelope});
   if(r.job)view(r.job);
   if(!r.ok&&r.warning)msg(r.warning);
   else if(r.job?.state==='RUNNING'&&r.job.steps.some(s=>s.status==='PLANNED')){
    const next=await api('next');
    view(next.job); // Automatic quote only; never automatic signing.
   }
  }catch(e){msg('Payment flow interrupted: '+e.message+
   '. If a signature may have reached the merchant, refresh task status BEFORE signing again.');}
  finally{if(current)view(current);}
 };
 $('retry').onclick=async()=>{const step=selected();if(!step)return;
  try{view((await api('retry',{stepId:step.id})).job)}
  catch(e){msg(e.message)}
 };
 $('reconcile').onclick=async()=>{const step=selected();if(!step)return;
  try{const result=await api('reconcile',{stepId:step.id});if(result.job)view(result.job);
   if(result.reason)msg(result.reason);
  }catch(e){msg(e.message)}
 };
 $('dryRun').onclick=async()=>{
  try{
   const r=await fetch('/api/demo');const data=await r.json();
   $('completeDemo').textContent=JSON.stringify(data.examples.completes,null,2);
   $('stopDemo').textContent=JSON.stringify(data.examples.budgetStops,null,2);
  }catch(e){$('completeDemo').textContent='Demo error: '+e.message}
 };
 if(window.ethereum?.on){
  window.ethereum.on('accountsChanged',()=>{setWallet(null);
   $('status').textContent='Wallet account changed. Reconnect to the task buyer before signing.';});
  window.ethereum.on('chainChanged',()=>{setWallet(null);
   $('status').textContent='Network changed. Switch back to Pharos Atlantic Testnet.';});
 }
 const saved=localStorage.getItem(keyName);
 if(saved){$('key').value=saved;$('open').click();}
})();
</script></body></html>`;
