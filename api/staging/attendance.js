import { stagingConfiguration, getBearer, verifiedUser, respond, fail, SecurityError } from '../../lib/staging/security.js';
import { encode } from 'uqr';
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
    const data=await executeAttendance(config,jwt,command);
    if(command.p_action==='issue' && process.env.QSWIPE_STAGING_ADAPTER_ENABLED==='true'){
      const qr=encode(data.token,{ecc:'M',border:0});
      if(qr.size<21||qr.size>81||qr.data.length!==qr.size)throw new SecurityError(502,'INVALID_QR_MATRIX');
      data.qr=qr.data.map(row=>Array.from(row,x=>x?'1':'0').join(''));
    }
    respond(res,200,data);
  }catch(error){fail(res,error);}
}
