import {stagingConfiguration,getBearer,verifiedUser,respond,fail,SecurityError} from '../../lib/staging/security.js';
import {advancedCommand,executeAdvanced} from '../../lib/staging/advanced.js';
export default async function handler(req,res){
 try{const config=stagingConfiguration();if(!['P3','P4','P5','P6','ADAPTER','ONBOARDING','WORKFORCE','ADVANCED'].every(p=>process.env['QSWIPE_STAGING_'+p+'_ENABLED']==='true'))throw new SecurityError(503,'STAGING_ADVANCED_DISABLED');
 if(req.method!=='POST')throw new SecurityError(405,'METHOD_NOT_ALLOWED');if(!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type']??''))throw new SecurityError(415,'JSON_REQUIRED');
 const jwt=getBearer(req),command=advancedCommand(req.body);await verifiedUser(config,jwt);respond(res,200,await executeAdvanced(config,jwt,command));
 }catch(e){fail(res,e);}
}
