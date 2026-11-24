import {createPersistentRoomService,createSupabaseStore} from './persistence.mjs';
import {encode} from 'uqr';
export function onlineConfig(env=process.env){
 const ref=env.QSWIPE_ROOMS_STAGING_REF,prod=env.QSWIPE_ROOMS_PRODUCTION_REF;
 if(env.VERCEL_ENV!=='preview'||env.QSWIPE_ROOMS_ONLINE!=='true'||!ref||!prod||!(/^[a-z0-9]{20}$/).test(ref)||!(/^[a-z0-9]{20}$/).test(prod)||ref===prod||env.QSWIPE_ROOMS_SUPABASE_URL!=='https://'+ref+'.supabase.co'||!/^sb_publishable_[A-Za-z0-9_-]{15,}$/.test(env.QSWIPE_ROOMS_PUBLISHABLE_KEY||'')||!/^[0-9a-f]{64}$/.test(env.QSWIPE_ROOMS_STORE_SECRET||'')||!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(env.QSWIPE_ROOMS_PREVIEW_ORIGIN||''))return null;
 return {origin:env.QSWIPE_ROOMS_SUPABASE_URL,key:env.QSWIPE_ROOMS_PUBLISHABLE_KEY,secret:env.QSWIPE_ROOMS_STORE_SECRET,preview:env.QSWIPE_ROOMS_PREVIEW_ORIGIN};
}
export function send(res,status,data){res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.status(status).json(data);}
const rate=new Map();
export function makeOnlineHandler({env=process.env,fetchImpl=fetch}={}){
 return async(req,res)=>{
 const cfg=onlineConfig(env);if(!cfg)return send(res,503,{error:'ROOMS_DISABLED'});
 if(req.method!=='POST')return send(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(req.headers.origin!==cfg.preview||req.headers.host!==new URL(cfg.preview).host||req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'ORIGIN_DENIED'});
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return send(res,415,{error:'JSON_REQUIRED'});
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);if(!body||Buffer.byteLength(JSON.stringify(body))>2048)throw Error();}catch{return send(res,400,{error:'INVALID_COMMAND'});}
 const now=Date.now(),ip=String(req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown').slice(0,100),key=ip+(['create','join'].includes(body.action)?':join':':api');for(const [k,v] of rate)if(v.until<=now)rate.delete(k);if(!rate.has(key)){if(rate.size>=2048)return send(res,429,{error:'SLOW_DOWN'});rate.set(key,{until:now+60000,count:0});}if(++rate.get(key).count>(key.endsWith(':join')?30:1500))return send(res,429,{error:'SLOW_DOWN'});
 try{const secret=/^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization||'')?.[1];const service=createPersistentRoomService(createSupabaseStore(cfg,fetchImpl));const result=await service.command(body,secret);if(result.state?.invite&&result.state.phase==='lobby'){const q=encode(cfg.preview+'/rooms/#join='+result.state.invite,{ecc:'M',border:4});let path='';for(let y=0;y<q.size;y++)for(let x=0;x<q.size;x++)if(q.data[y][x])path+='M'+x+' '+y+'h1v1h-1z';result.state.qr={size:q.size,path};}return send(res,200,result);}catch(e){return send(res,Number.isInteger(e.status)?e.status:503,{error:e.code||'ROOM_UNAVAILABLE'});}
 };
}
