export const BUILD_VERSION='pharos-x402-agent-buyer-2026-11-05-v5';
export const NETWORK='eip155:688689';
export const CHAIN_ID=688689;
export const SELLER_DEFAULT='https://x402-paywalled-api.trantanlong2411.workers.dev';
export const USDC='0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B';
export const RPC_DEFAULT='https://atlantic.dplabs-internal.com';
export const EXPLORER='https://atlantic.pharosscan.xyz/tx/';
export const ROUTES=[
 {id:'insights',path:'/api/insights',name:'Network insights',description:'Use network insights to inform the task'},
 {id:'report',path:'/api/report',name:'Analytics report',description:'Retrieve the premium summary and finish the task'}
];
export const ZERO='0x0000000000000000000000000000000000000000';
export function config(env={}){
 const raw=String(env.SELLER_ORIGIN||SELLER_DEFAULT);
 const parsed=new URL(raw);
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)
  throw Error('Seller must be an HTTPS origin without credentials or query');
 return {seller:parsed.origin,rpc:String(env.ATLANTIC_RPC_URL||RPC_DEFAULT)};
}
