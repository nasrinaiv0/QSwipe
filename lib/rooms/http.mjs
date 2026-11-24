import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {encode} from 'uqr';
import {createRoomService} from './service.mjs';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.json':'application/json'};
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(body));}
function qr(text){const q=encode(text,{ecc:'M',border:4});let path='';for(let y=0;y<q.size;y++)for(let x=0;x<q.size;x++)if(q.data[y][x])path+='M'+x+' '+y+'h1v1h-1z';return {size:q.size,path};}
export function createRoomHttpServer({root=resolve('dist'),service=createRoomService(),allowedOrigin,now=Date.now}={}){
 const limits=new Map();root=resolve(root);
 function rate(req,join){const t=now();for(const [k,v] of limits)if(v.until<=t)limits.delete(k);const key=(req.socket.remoteAddress||'unknown')+(join?':join':':api');let v=limits.get(key);if(!v){if(limits.size>=2048)return false;v={until:t+60000,count:0};limits.set(key,v);}return ++v.count<=(join?30:1500);}
 const server=createServer(async(req,res)=>{
  try{
   const host=req.headers.host||'',local=/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host);
   const origin=allowedOrigin||(local?'http://'+host:null);
   if(!origin||new URL(origin).host!==host)return json(res,403,{error:'HOST_DENIED'});
   const url=new URL(req.url,origin);
   if(url.origin!==origin)return json(res,400,{error:'INVALID_PATH'});
   if(url.pathname==='/api/rooms/health'&&req.method==='GET')return json(res,200,{available:true,mode:'temporary-staging'});
   if(url.pathname==='/api/rooms/command'){
    if(req.method!=='POST')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
    if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'ORIGIN_DENIED'});
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'JSON_REQUIRED'});
    if(!rate(req,false))return json(res,429,{error:'SLOW_DOWN'});
    if(Number(req.headers['content-length'])>2048)return json(res,413,{error:'BODY_TOO_LARGE'});
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2048){req.destroy();return;}chunks.push(chunk);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(res,400,{error:'INVALID_JSON'});}
    if(['create','join'].includes(body?.action)&&!rate(req,true))return json(res,429,{error:'SLOW_DOWN'});
    const bearer=/^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization||'')?.[1];
    const result=await service.command(body,bearer);
    if(result.state?.invite&&result.state.phase==='lobby')result.state.qr=qr(origin+'/rooms/#join='+result.state.invite);
    return json(res,200,result);
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
   let path=decodeURIComponent(url.pathname);if(path.endsWith('/'))path+='index.html';
   const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))return json(res,404,{error:'NOT_FOUND'});
   const type=mime[extname(file)];if(!type)return json(res,404,{error:'NOT_FOUND'});
   let info;try{info=await stat(file);}catch{return json(res,404,{error:'NOT_FOUND'});}if(!info.isFile())return json(res,404,{error:'NOT_FOUND'});
   const headers={'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
   if(path.startsWith('/rooms/')){headers['Content-Security-Policy']=csp;headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()';}
   res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch(e){if(!res.headersSent)json(res,Number.isInteger(e.status)?e.status:500,{error:typeof e.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'ROOM_UNAVAILABLE'});else res.end();}
 });
 server.requestTimeout=10000;server.headersTimeout=5000;server.keepAliveTimeout=5000;
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.env.QSWIPE_ROOM_STAGING!=='1'||process.env.NODE_ENV==='production'||process.env.VERCEL_ENV==='production'){console.error('Room server is isolated staging only.');process.exit(1);}
 const port=Number(process.env.PORT||4174);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 const stateFile=process.env.QSWIPE_ROOM_STATE_FILE;let service;
 if(stateFile){const {createPersistentRoomService,createFileStore}=await import('./persistence.mjs');service=createPersistentRoomService(createFileStore(resolve(stateFile)));}
 createRoomHttpServer(service?{service}:{}).listen(port,'127.0.0.1',()=>console.log('QSwipe staging rooms listening on loopback:'+port));
}
