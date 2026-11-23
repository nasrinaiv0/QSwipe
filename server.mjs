import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root=resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{
  let path;
  try { const url=new URL(req.url,'http://localhost'); path=decodeURIComponent(url.pathname); } catch {res.writeHead(400);return res.end('Bad request');}
  if(path==='/'||path==='/index.html')path='/index.html';
  if(!/^\/[\w./-]+$/.test(path)||path.includes('..')){res.writeHead(404);return res.end('Not found');}
  const filename=resolve(root,'.'+path);
  if(!filename.startsWith(root+'/')){res.writeHead(404);return res.end('Not found');}
  try{const data=await readFile(filename);res.writeHead(200,{'Content-Type':types[extname(filename)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log(`QSwipe demo: http://localhost:${port}`));
