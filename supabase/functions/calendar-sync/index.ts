// Supabase Edge Function: deploy as calendar-sync; call on a schedule with a secret header.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SERVICE_ACCOUNT_JSON,
// GOOGLE_CALENDAR_ID, GOOGLE_CALENDAR_STARS_ID, GOOGLE_CALENDAR_E_ID, CALENDAR_SYNC_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
const enc = new TextEncoder();
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
function decodePem(pem: string) {
  const raw = atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,''));
  return Uint8Array.from(raw, c=>c.charCodeAt(0));
}
async function googleToken() {
  const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '{}');
  if (!sa.client_email || !sa.private_key) throw Error('Google service account secret is missing');
  const key = await crypto.subtle.importKey('pkcs8',decodePem(sa.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const now=Math.floor(Date.now()/1000);
  const header=base64url(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const payload=base64url(enc.encode(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/calendar.events',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500})));
  const input=header+'.'+payload;
  const signature=base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(input))));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+signature})});
  if(!response.ok)throw Error('Google OAuth token request failed: '+response.status);
  return (await response.json()).access_token as string;
}
const roomNames:Record<string,string>={a:'木地板 A',b:'木地板 B',stars:'群星室',e:'E 化教室'};
function calendarForRoom(roomId:string, main:string, stars:string, e:string){
  if(roomId==='a'||roomId==='b')return main;
  if(roomId==='stars')return stars;
  if(roomId==='e')return e;
  throw Error('Unknown booking room: '+roomId);
}
function eventId(id:string){return 'hillside'+id.replace(/-/g,'').toLowerCase();} // deterministic; avoids duplicates after retries
async function googleRequest(token:string,calendar:string,method:string,path:string,body?:unknown){
  const response=await fetch('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendar)+'/events'+path,{
    method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const text=await response.text();
  if(!response.ok)throw Object.assign(new Error('Google Calendar HTTP '+response.status+': '+text.slice(0,250)),{status:response.status});
  return text?JSON.parse(text):null;
}
Deno.serve(async req=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  const secret=Deno.env.get('CALENDAR_SYNC_SECRET');
  if(!secret||req.headers.get('x-calendar-sync-secret')!==secret)return new Response('Unauthorized',{status:401});
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),calendar=Deno.env.get('GOOGLE_CALENDAR_ID'),starsCalendar=Deno.env.get('GOOGLE_CALENDAR_STARS_ID'),eCalendar=Deno.env.get('GOOGLE_CALENDAR_E_ID');
  if(!url||!service||!calendar||!starsCalendar||!eCalendar)return new Response('Missing server configuration',{status:500});
  if(new Set([calendar,starsCalendar,eCalendar]).size!==3)return new Response('Calendar IDs must be distinct',{status:500});
  const db=createClient(url,service,{auth:{persistSession:false}});
  const {data:jobs,error}=await db.rpc('claim_booking_calendar_sync',{p_limit:10});
  if(error)return new Response('Claim failed: '+error.message,{status:500});
  if(!jobs?.length)return Response.json({processed:0});
  let token:string;
  try{token=await googleToken();}catch(e){for(const job of jobs)await db.rpc('complete_booking_calendar_sync',{p_booking_id:job.booking_id,p_desired_state:job.desired_state,p_event_id:job.google_event_id,p_error:String(e)});return Response.json({processed:0,failed:jobs.length},{status:502});}
  let succeeded=0,failed=0;
  for(const job of jobs){
    const id=job.google_event_id||eventId(job.booking_id);
    try{
      const targetCalendar=calendarForRoom(job.room_id,calendar,starsCalendar,eCalendar);
      if(job.desired_state==='create'){
        const event={id,summary:'山居學習中心｜'+(roomNames[job.room_id]||job.room_id)+'｜'+job.activity_name,
          description:'山居學習中心場地借用（核准）\n預約編號：'+job.booking_id,
          start:{dateTime:job.start_at,timeZone:'Asia/Taipei'},end:{dateTime:job.end_at,timeZone:'Asia/Taipei'}};
        try{await googleRequest(token,targetCalendar,'POST','',event);}
        catch(e){if((e as {status?:number}).status!==409)throw e;}
      }else{
        try{await googleRequest(token,targetCalendar,'DELETE','/'+encodeURIComponent(id));}
        catch(e){if((e as {status?:number}).status!==404 && (e as {status?:number}).status!==410)throw e;}
      }
      const {error}=await db.rpc('complete_booking_calendar_sync',{p_booking_id:job.booking_id,p_desired_state:job.desired_state,p_event_id:job.desired_state==='create'?id:null,p_error:null});
      if(error)throw error;
      succeeded++;
    }catch(e){
      failed++;
      await db.rpc('complete_booking_calendar_sync',{p_booking_id:job.booking_id,p_desired_state:job.desired_state,p_event_id:job.google_event_id,p_error:String(e)});
    }
  }
  return Response.json({processed:jobs.length,succeeded,failed});
});
