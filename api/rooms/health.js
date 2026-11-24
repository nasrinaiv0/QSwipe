import {onlineConfig,send} from '../../lib/rooms/online.mjs';
import {createSupabaseStore} from '../../lib/rooms/persistence.mjs';
export default async function handler(req,res){const cfg=onlineConfig();if(!cfg||req.method!=='GET'||req.headers.host!==new URL(cfg.preview).host)return send(res,503,{available:false});try{const s=await createSupabaseStore(cfg).load();return send(res,200,{available:Array.isArray(s?.rooms),mode:'staging-persistent'});}catch{return send(res,503,{available:false});}}
