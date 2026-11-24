import {stagingConfiguration,getBearer,requireGet,verifiedUser,respond,fail,SecurityError} from '../../lib/staging/security.js';
import {inboxParams,listInbox} from '../../lib/staging/inbox.js';
export default async function handler(req,res){
 try{requireGet(req);const config=stagingConfiguration();
  if(!['P3','P4','P5','P6'].every(p=>process.env['QSWIPE_STAGING_'+p+'_ENABLED']==='true'))throw new SecurityError(503,'STAGING_P6_DISABLED');
  const jwt=getBearer(req),params=inboxParams(req.url);await verifiedUser(config,jwt);respond(res,200,await listInbox(config,jwt,params));
 }catch(e){fail(res,e);}
}
