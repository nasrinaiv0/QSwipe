import { stagingConfiguration,getBearer,verifiedUser,respond,fail,SecurityError } from '../../lib/staging/security.js';
import { approvalCommand,executeApproval } from '../../lib/staging/approvals.js';
export default async function handler(req,res){
 try{
   const config=stagingConfiguration();
   if(process.env.QSWIPE_STAGING_P3_ENABLED!=='true'||process.env.QSWIPE_STAGING_P4_ENABLED!=='true')throw new SecurityError(503,'STAGING_P4_DISABLED');
   if(req.method!=='POST')throw new SecurityError(405,'METHOD_NOT_ALLOWED');
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type']??''))throw new SecurityError(415,'JSON_REQUIRED');
   const jwt=getBearer(req),command=approvalCommand(req.body);
   await verifiedUser(config,jwt);
   respond(res,200,await executeApproval(config,jwt,command));
 }catch(error){fail(res,error);}
}
