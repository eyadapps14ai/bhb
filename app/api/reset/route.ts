import {context,failure} from '@/lib/server-records';
import {SUPER_ADMIN} from '@/lib/access';
import {isSuperAdminLogin} from '@/lib/server-users';
import {resetPlan,resetCounts,resetBackup,resetData,lastReset} from '@/lib/server-reset';
// Reset data (Advanced settings, super admin only): plan (what goes, what stays), backup (download first), reset.
export async function POST(req:Request){try{const{db,owner,user}=await context(req);
 // Checked on the stored login too, not only the session, as for the other super admin powers.
 if(user.roleId!==SUPER_ADMIN||user.bootstrap||!(await isSuperAdminLogin(db,user.userId)))return Response.json({error:'Only a super admin can reset the data.'},{status:403});
 const body=await req.json() as {action?:string;confirm?:string;fingerprint?:string};
 if(body.action==='plan'||body.action==='backup'){const plan=await db.transaction(all=>resetPlan(db,all,owner));
  return Response.json(body.action==='plan'?{deleted:resetCounts(plan),kept:plan.kept,last:await lastReset(db,owner)}:resetBackup(plan,user))}
 if(body.action==='reset'){if(body.confirm!=='RESET')throw new Error('Type RESET to confirm.');if(typeof body.fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(body.fingerprint))throw new Error('Download the backup first, then reset.');
  const entry=await resetData(db,owner,user,body.fingerprint).catch((e:unknown)=>{if(e&&typeof e==='object'&&(e as {code?:string}).code==='55P03')throw new Error('Someone is saving records right now. Try the reset again in a moment.');throw e});console.info(JSON.stringify({event:'bhb-data-reset',...entry}));return Response.json(entry)}
 throw new Error('Unknown action.');}catch(e){return failure(e);}}
