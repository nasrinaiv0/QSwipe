import { stagingConfiguration, getBearer, verifiedUser, respond, fail, SecurityError } from '../../lib/staging/security.js';
import { attendanceCommand, executeAttendance } from '../../lib/staging/attendance.js';
export default async function handler(req,res){
  try{
    const config=stagingConfiguration();
    if(process.env.QSWIPE_STAGING_P3_ENABLED!=='true')throw new SecurityError(503,'STAGING_P3_DISABLED');
    if(req.method!=='POST')throw new SecurityError(405,'METHOD_NOT_ALLOWED');
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type']??''))throw new SecurityError(415,'JSON_REQUIRED');
    const jwt=getBearer(req);
    const command=attendanceCommand(req.body);
    await verifiedUser(config,jwt);
    respond(res,200,await executeAttendance(config,jwt,command));
  }catch(error){fail(res,error);}
}
