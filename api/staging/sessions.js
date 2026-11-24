import {stagingConfiguration,getBearer,requireGet,verifiedUser,respond,fail,SecurityError,validUuid} from '../../lib/staging/security.js';
import {listSessions} from '../../lib/staging/workspace.js';
export default async function handler(req,res){
 try{
   requireGet(req);
   const config=stagingConfiguration();
   if(process.env.QSWIPE_STAGING_P3_ENABLED!=='true'||process.env.QSWIPE_STAGING_P4_ENABLED!=='true'||process.env.QSWIPE_STAGING_P5_ENABLED!=='true')throw new SecurityError(503,'STAGING_P5_DISABLED');
   const jwt=getBearer(req);await verifiedUser(config,jwt);
   const id=validUuid(new URL(req.url,'https://qswipe.invalid').searchParams.get('roster_id'));
   respond(res,200,await listSessions(config,jwt,id));
 }catch(error){fail(res,error);}
}
