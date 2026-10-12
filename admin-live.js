import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Publishable key only. Never place service_role, sb_secret_ or Google Client Secret in a browser.
const db=createClient('https://urgmjidcjrglyfgoohtx.supabase.co','sb_publishable_-PohQjs2ygBfe4XzAydbFA_Jht2vfwF',{auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id);
const names={a:'木地板 A',b:'木地板 B',stars:'群星室',e:'E 化教室'};
const labels={pending:'待審核',needs_info:'待補件',alternative_proposed:'建議替代時段',approved:'已核准',rejected:'未核准',cancelled:'已取消',completed:'已完成'};
const reviewable=new Set(['pending','needs_info','alternative_proposed']);
let user=null,bookings=[],authorized=false,requestVersion=0;
const node=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value==null?'—':String(value);if(className)el.className=className;return el;};
const fmt=v=>v?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—';
const short=v=>v==null||v===''?'—':String(v);
function field(root,name,value){const d=document.createElement('div');d.append(node('b',name),node('span',short(value)));root.append(d);}
function setAuth(message){$('authStatus').textContent=message;}
function clearPrivate(){authorized=false;bookings=[];$('adminContent').hidden=true;$('bookingList').replaceChildren();$('summary').replaceChildren();}
async function load(){if(!user)return;const version=++requestVersion;clearPrivate();$('refresh').disabled=true;setAuth('正在檢查管理員權限及讀取申請資料…');
 try{
  // SECURITY DEFINER RPC enforces is_admin(auth.uid()) on the database server.
  const {data,error}=await db.rpc('admin_bookings');
  if(version!==requestVersion)return;
  if(error)throw error;
  authorized=true;bookings=Array.isArray(data)?data:[];$('adminContent').hidden=false;
  setAuth(`管理員權限驗證通過 · ${user.email} · 已載入 ${bookings.length} 筆（最多 500 筆）`);render();
 }catch(error){if(version!==requestVersion)return;clearPrivate();setAuth('無法開啟管理後台：'+error.message+'。請確認帳號已列入 admin_members，且資料庫有 admin_bookings() RPC。');}
 finally{if(version===requestVersion)$('refresh').disabled=false;}}
function render(){if(!authorized)return;const counts={all:bookings.length,pending:bookings.filter(b=>reviewable.has(b.status)).length,approved:bookings.filter(b=>b.status==='approved').length,rejected:bookings.filter(b=>b.status==='rejected').length};$('summary').replaceChildren();for(const [name,key] of [['已載入','all'],['待處理','pending'],['已核准','approved'],['未核准','rejected']]){const div=node('div','', 'stat');div.append(node('span',name),node('strong',counts[key]));$('summary').append(div);}
 const filter=$('filter').value,query=$('search').value.trim().toLocaleLowerCase();const list=bookings.filter(b=>(filter==='all'||(filter==='reviewable'?reviewable.has(b.status):b.status===filter))&&(!query||[b.applicant_name,b.activity_name,b.applicant_email,b.applicant_unit,b.room_id,names[b.room_id]].some(s=>String(s||'').toLocaleLowerCase().includes(query))));
 $('listStatus').textContent=`目前顯示 ${list.length} 筆申請。`;$('bookingList').replaceChildren();if(!list.length){$('bookingList').append(node('p','沒有符合條件的申請。','empty'));return;}
 for(const b of list){const card=document.createElement('article');card.className='booking-card';card.append(node('h3',`${names[b.room_id]||b.room_id} · ${short(b.activity_name)}`));card.append(node('span',labels[b.status]||b.status,`tag ${b.status}`));const info=document.createElement('div');info.className='meta';info.style.marginTop='14px';for(const [k,v] of [['借用開始',fmt(b.start_at)],['借用結束',fmt(b.end_at)],['申請人',b.applicant_name],['政大信箱',b.applicant_email],['身分',b.applicant_identity],['學號／職員編號',b.applicant_number],['電話',b.applicant_phone],['系所／單位',b.applicant_unit],['人數',b.attendee_count],['活動目的',b.purpose],['設備需求',b.equipment_needs],['特殊借用原因',b.special_reason],['申請時間',fmt(b.created_at)],['審核說明',b.review_reason],['審核時間',fmt(b.reviewed_at)],['申請編號',b.id]])field(info,k,v);card.append(info);
 if(reviewable.has(b.status)){const box=document.createElement('div');box.className='review-box';box.append(node('strong','審核操作'));const reason=document.createElement('textarea');reason.rows=2;reason.maxLength=2000;reason.placeholder='駁回或要求補件時，必須填寫原因；核准時可選填備註';reason.setAttribute('aria-label','審核原因');box.append(reason);const actions=document.createElement('div');actions.className='actions';for(const [decision,title] of [['approved','核准'],['needs_info','要求補件'],['rejected','駁回']]){const btn=node('button',title);btn.type='button';if(decision!=='approved')btn.className='outline';btn.onclick=async()=>{const note=reason.value.trim();if(decision!=='approved'&&!note){alert('請先填寫審核原因。');reason.focus();return;}if(!confirm(`確定要「${title}」這筆申請？\n${names[b.room_id]||b.room_id} · ${fmt(b.start_at)}\n此操作會立即寫入真實資料庫。`))return;actions.querySelectorAll('button').forEach(el=>el.disabled=true);$('listStatus').textContent='正在寫入審核結果…';const {error}=await db.rpc('review_booking',{booking_id:b.id,decision,reason:note||null});if(error){alert('審核失敗：'+error.message);actions.querySelectorAll('button').forEach(el=>el.disabled=false);$('listStatus').textContent='審核失敗，資料未更新。';return;}await load();};actions.append(btn);}box.append(actions);card.append(box);}else card.append(node('p','此申請目前不是可審核狀態。','private-notice'));
 $('bookingList').append(card);}}
$('filter').addEventListener('change',render);$('search').addEventListener('input',render);$('refresh').onclick=load;
$('login').onclick=async()=>{const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)setAuth('登入失敗：'+error.message);};
$('logout').onclick=async()=>{requestVersion++;clearPrivate();const {error}=await db.auth.signOut();if(error)setAuth('登出失敗：'+error.message);else{user=null;$('login').hidden=false;$('logout').hidden=true;$('refresh').hidden=true;setAuth('已登出。');}};
async function init(){const {data,error}=await db.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')setAuth('驗證登入狀態失敗：'+error.message);user=data?.user||null;$('login').hidden=!!user;$('logout').hidden=!user;$('refresh').hidden=!user;if(user)await load();else setAuth('請使用已授權的政大 Google 帳號登入。');}
init();
