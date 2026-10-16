import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient('https://urgmjidcjrglyfgoohtx.supabase.co','sb_publishable_-PohQjs2ygBfe4XzAydbFA_Jht2vfwF',{auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id);const form=$('bookingForm');let user=null;let lang=localStorage.getItem('hillside-language')==='en'?'en':'zh-TW';let policy=null;
const names={a:'木地板 A',b:'木地板 B',stars:'群星室',e:'E 化教室'};const englishNames={a:'Wood-floor Room A',b:'Wood-floor Room B',stars:'Star Room',e:'E-classroom'};const roomName=id=>(lang==='zh-TW'?names:englishNames)[id]||id;

/* 各場地飲食及白開水規範 */
const roomNotice = document.createElement('p');
roomNotice.id = 'roomNotice';
roomNotice.setAttribute('role', 'status');
roomNotice.style.margin = '8px 0 16px';
roomNotice.style.fontWeight = '600';
roomNotice.style.lineHeight = '1.7';

form.elements.room_id.closest('label').after(roomNotice);

async function updateRoomNotice() {
  const roomId = form.elements.room_id.value;

  if (!roomId) {
    roomNotice.textContent = '';
    return;
  }

  roomNotice.textContent = msg('正在讀取場地飲食規定…','Loading room food and drink rules…');

  const { data, error } = await db
    .from('rooms')
    .select('food_allowed, water_allowed')
    .eq('id', roomId)
    .single();

  if (form.elements.room_id.value !== roomId) return;

  if (error || !data ||
      data.food_allowed === null ||
      data.water_allowed === null) {
    roomNotice.textContent =
      msg('無法確認場地飲食規定，請洽管理單位。','Unable to confirm room food and drink rules. Please contact the center.');
    return;
  }

  const food = data.food_allowed
    ? msg('允許飲食','Food and drinks allowed')
    : msg('禁止飲食','No food or drinks');

  const water = data.water_allowed
    ? msg('允許飲用白開水','Plain water allowed')
    : msg('禁止飲用白開水','No plain water');

  roomNotice.textContent =
    msg(`場地規定：${food}、${water}。`, `Room rules: ${food}; ${water}. `) +
    (data.food_allowed
      ? msg('使用後請清理垃圾並恢復場地原狀。','Please clean up and restore the room after use.')
      : msg('請勿在場地內食用食品或飲用未經允許的飲料。','Do not consume food or unauthorized drinks in this room.'));
}

form.elements.room_id.addEventListener(
  'change',
  updateRoomNotice
);

const statuses={pending:'待審核',needs_info:'待補件',alternative_proposed:'建議替代時段',approved:'已核准',rejected:'未核准',cancelled:'已取消',completed:'已完成'};
const enStatuses={pending:'Pending review',needs_info:'More information needed',alternative_proposed:'Alternative proposed',approved:'Approved',rejected:'Rejected',cancelled:'Cancelled',completed:'Completed'};
const msg=(zh,en)=>lang==='zh-TW'?zh:en;
function applyStaticLanguage(){document.documentElement.lang=lang==='zh-TW'?'zh-Hant':'en';$('lang').textContent=lang==='zh-TW'?'EN':'中文';document.querySelectorAll('[data-zh]').forEach(el=>el.textContent=el.dataset[lang==='zh-TW'?'zh':'en']);document.querySelectorAll('[data-zh-placeholder]').forEach(el=>el.placeholder=el.dataset[lang==='zh-TW'?'zhPlaceholder':'enPlaceholder']);}
function show(id,s){$(id).textContent=s;}
function emailOK(email){return /^[^@\s]+@(?:[a-z0-9-]+\.)*nccu\.edu\.tw$/i.test(email||'');}
function isoLocal(date,time){return new Date(`${date}T${time}:00+08:00`).toISOString();}
function fmt(s){return new Intl.DateTimeFormat(lang==='zh-TW'?'zh-TW':'en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));}
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function makeTimes(){for(const key of ['start','end']){const sel=form.elements[key];sel.replaceChildren(new Option(msg('請選擇','Select'),''));for(let h=10;h<=21;h++)for(const m of [0,30]){if(h===21&&m)continue;const t=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;sel.add(new Option(t,t));}}}
function render(){const valid=user&&emailOK(user.email);$('login').hidden=!!user;$('logout').hidden=!user;$('email').value=user?.email||'';updateConflictButton();$('submit').textContent=valid?msg('送出雲端申請','Submit booking'):msg('請先以政大帳號登入','Sign in with NCCU account');show('authstatus',!user?msg('目前尚未登入。','Not signed in.'):valid?msg(`已登入：${user.email}（政大信箱格式符合）`,`Signed in: ${user.email} (NCCU email)`):msg(`已登入：${user.email}，但不是政大信箱，無法申請。`,`Signed in: ${user.email}, but NCCU email is required.`));if(user)loadMine();else show('mineResult',msg('請先登入。','Please sign in.'));}
async function check(){const {data,error}=await db.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')console.warn('Auth:',error.message);user=data?.user||null;render();}
$('login').onclick=async()=>{const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)show('authstatus',error.message);};
$('logout').onclick=async()=>{const {error}=await db.auth.signOut();if(error)show('authstatus',error.message);else{user=null;render();}};
db.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;render();});
async function loadPolicy(){const {data,error}=await db.from('policy_versions').select('version,content_zh,content_en').eq('active',true).maybeSingle();if(error){show('policy',msg('無法讀取借用規範：','Unable to load policy: ')+error.message);return;}policy=data;if(!data){show('policy',msg('尚未設定有效借用規範，無法申請。','No active booking policy.'));$('submit').disabled=true;return;}show('policy',`${msg('借用規範版本','Policy version')} ${data.version}\n\n${lang==='zh-TW'?data.content_zh:data.content_en}`);}
// Public monthly schedule: no applicant information is fetched or displayed.
const roomColors={a:'#B87968',b:'#658B83',stars:'#7C79A7',e:'#C49A4B'};
const pad=n=>String(n).padStart(2,'0');
const todayTW=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let calendarMonth=todayTW().slice(0,7), selectedDay=todayTW(), monthEvents=[], calendarDays=[], calendarDaysAvailable=false, scheduleSeq=0, loadedMonth='';
const isWeekend=date=>{const n=new Date(date+'T12:00:00Z').getUTCDay();return n===0||n===6;};
const calendarRecord=date=>calendarDays.find(d=>d.day===date);
function closedDayReason(date){
  if(isWeekend(date))return msg('週末不開放','Closed on weekends');
  if(calendarDaysAvailable){const record=calendarRecord(date);if(record&&record.is_workday===false)return msg('國定假日／非工作日','Public holiday / non-working day');}
  return '';
}
function eventOverlapsDay(e,date){
  const begin=new Date(isoLocal(date,'00:00')).getTime();
  return new Date(e.start_at).getTime()<begin+86400000&&new Date(e.end_at).getTime()>begin;
}
const selectedRooms=()=>Array.from(document.querySelectorAll('[data-room]:checked'),e=>e.dataset.room);
const monthDate=(ym,day)=>`${ym}-${pad(day)}`;
function changeMonth(delta){const [y,m]=calendarMonth.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1));calendarMonth=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`;selectedDay=monthDate(calendarMonth,1);loadSchedule();}
function paintCalendar(){const [year,month]=calendarMonth.split('-').map(Number);const days=new Date(Date.UTC(year,month,0)).getUTCDate();const offset=new Date(Date.UTC(year,month-1,1)).getUTCDay();const selected=new Set(selectedRooms());$('monthTitle').textContent=msg(`${year} 年 ${month} 月`,`${new Date(Date.UTC(year,month-1,1)).toLocaleDateString('en-US',{year:'numeric',month:'long',timeZone:'UTC'})}`);$('calendarWeekdays').replaceChildren(...(lang==='zh-TW'?['日','一','二','三','四','五','六']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat']).map(t=>node('span',t)));const grid=$('calendarGrid');grid.replaceChildren();for(let i=0;i<offset;i++){const empty=node('div','');empty.className='calendar-empty';grid.append(empty);}for(let day=1;day<=days;day++){const date=monthDate(calendarMonth,day);const cell=document.createElement('button');cell.type='button';cell.className='calendar-day'+(selectedDay===date?' active':'')+(date===todayTW()?' is-today':'');cell.setAttribute('aria-label',date);cell.setAttribute('aria-pressed',String(selectedDay===date));const reason=closedDayReason(date);if(reason){cell.classList.add('calendar-closed');cell.title=reason;cell.setAttribute('aria-label',date+' · '+reason);}cell.append(node('span',String(day)));if(reason){const badge=node('small',msg('不開放','Closed'));badge.className='calendar-closed-label';cell.append(badge);}const dots=document.createElement('div');dots.className='calendar-dots';for(const room of Object.keys(names)){if(monthEvents.some(e=>selected.has(room)&&e.room_id===room&&eventOverlapsDay(e,date))){const dot=document.createElement('span');dot.className='room-dot';dot.style.setProperty('--room-color',roomColors[room]);dot.title=roomName(room);dots.append(dot);}}cell.append(dots);cell.onclick=()=>{selectedDay=date;paintCalendar();paintDay();};grid.append(cell);}paintDay();}
function eventLocalDate(e){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.start_at));}
function localTime(s){return new Intl.DateTimeFormat(lang==='zh-TW'?'zh-TW':'en-US',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));}
function paintDay(){const selected=new Set(selectedRooms());$('dayTitle').textContent=msg(`${selectedDay.replaceAll('-','/')}｜借用時段`,`${selectedDay} | Reservations`);const root=$('scheduleResult');root.replaceChildren();const closedReason=closedDayReason(selectedDay);if(closedReason){const note=node('p',closedReason+' · '+msg('當日不開放場地借用。','Bookings are unavailable on this date.'));note.className='closed-day-notice';root.append(note);}if(!selected.size){root.textContent=msg('請至少勾選一間場地。','Select at least one room.');return;}if(loadedMonth!==calendarMonth){root.textContent=msg('正在讀取資料…','Loading…');return;}const entries=monthEvents.filter(e=>selected.has(e.room_id)&&eventOverlapsDay(e,selectedDay)).sort((a,b)=>a.start_at.localeCompare(b.start_at));if(!entries.length){if(!closedReason)root.textContent=msg('所選場地當日沒有已核准或停用時段；申請仍須經管理員審核。','No approved bookings or blocked times for selected rooms on this date; approval is still required.');return;}for(const e of entries){const row=document.createElement('div');row.className='calendar-entry';const dot=document.createElement('span');dot.className='room-dot';dot.style.setProperty('--room-color',roomColors[e.room_id]||'#888');row.append(dot,node('strong',roomName(e.room_id)),node('span',`${localTime(e.start_at)}–${localTime(e.end_at)}`),node('span',e.label==='已借用'?msg('已借用','Booked'):msg('不開放借用','Unavailable')));root.append(row);}}
async function loadSchedule(){const current=++scheduleSeq,month=calendarMonth;loadedMonth='';$('calendarStatus').textContent=msg('正在更新月曆…','Updating calendar…');paintCalendar();const [year,m]=month.split('-').map(Number);const next=new Date(Date.UTC(year,m,1));const nextMonth=`${next.getUTCFullYear()}-${pad(next.getUTCMonth()+1)}`;const from=isoLocal(`${month}-01`,'00:00'),to=isoLocal(`${nextMonth}-01`,'00:00');const [scheduleResponse,calendarResponse]=await Promise.all([db.rpc('public_schedule',{from_time:from,to_time:to}),db.from('calendar_days').select('day,is_workday').gte('day',month+'-01').lt('day',nextMonth+'-01')]);const {data,error}=scheduleResponse;if(current!==scheduleSeq)return;calendarDaysAvailable=!calendarResponse.error&&Array.isArray(calendarResponse.data)&&calendarResponse.data.length>0;calendarDays=calendarDaysAvailable?calendarResponse.data:[];if(error){$('calendarStatus').textContent=msg('月曆讀取失敗：','Calendar error: ')+error.message;$('scheduleResult').textContent=msg('無法取得借用時段，請重新整理。','Unable to load bookings. Please retry.');return;}monthEvents=Array.isArray(data)?data:[];loadedMonth=month;$('calendarStatus').textContent=calendarDaysAvailable?msg('灰色日期為週末或國定假日；色點代表已借用或停用時段。點選日期查看詳情。','Shaded dates are weekends or public holidays. Dots indicate booked or blocked times. Select a date for details.'):msg('週末已標示；國定假日資料暫時無法讀取，請依管理單位公告。色點代表已借用或停用時段。','Weekends are marked. Holiday data is unavailable; please check official notices. Dots show booked or blocked times.');paintCalendar();}
$('prevMonth').onclick=()=>changeMonth(-1);
$('nextMonth').onclick=()=>changeMonth(1);
$('todayMonth').onclick=()=>{calendarMonth=todayTW().slice(0,7);selectedDay=todayTW();loadSchedule();};
$('loadSchedule').onclick=loadSchedule;
document.querySelectorAll('[data-room]').forEach(box=>box.addEventListener('change',()=>{$('allRooms').checked=selectedRooms().length===4;paintCalendar();}));
$('allRooms').addEventListener('change',e=>{document.querySelectorAll('[data-room]').forEach(box=>box.checked=e.target.checked);paintCalendar();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadSchedule();});
window.addEventListener('focus',()=>{if(!document.hidden)loadSchedule();});

/* 即時檢查場地借用時段 */
let conflictCheckVersion = 0;
let timeConflict = false;
let checkingConflict = false;

const conflictHint = document.createElement('p');
conflictHint.id = 'conflictHint';
conflictHint.setAttribute('role', 'status');
conflictHint.setAttribute('aria-live', 'polite');
conflictHint.style.margin = '12px 0';
conflictHint.style.fontWeight = '600';

$('submit').before(conflictHint);

function updateConflictButton() {
  const validUser = user && emailOK(user.email);

  $('submit').disabled =
    !validUser || timeConflict || checkingConflict;
}

async function checkBookingConflict() {
  const version = ++conflictCheckVersion;

  const room = form.elements.room_id.value;
  const date = form.elements.date.value;
  const start = form.elements.start.value;
  const end = form.elements.end.value;

  timeConflict = false;
  checkingConflict = false;
  conflictHint.textContent = '';
  updateConflictButton();

  if (!room || !date || !start || !end) return;

  if (end <= start) {
    timeConflict = true;
    conflictHint.textContent =
      msg('結束時間必須晚於開始時間。',
          'End time must be after start time.');
    conflictHint.style.color = '#b42318';
    updateConflictButton();
    return;
  }

  checkingConflict = true;
  conflictHint.textContent =
    msg('正在檢查場地時段…', 'Checking availability…');
  conflictHint.style.color = '#666';
  updateConflictButton();

  try {
    const from = isoLocal(date, '00:00');

    const nextDay = new Date(
      new Date(from).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await db.rpc('public_schedule', {
      from_time: from,
      to_time: nextDay
    });

    if (version !== conflictCheckVersion) return;
    if (error) throw error;

    const requestedStart = new Date(isoLocal(date, start));
    const requestedEnd = new Date(isoLocal(date, end));

    const conflicts = (data || []).filter(item =>
      item.room_id === room &&
      new Date(item.start_at) < requestedEnd &&
      new Date(item.end_at) > requestedStart
    );

    timeConflict = conflicts.length > 0;

    if (timeConflict) {
      conflictHint.textContent = msg(
        '此時段已被借用或不開放借用，請重新選擇時間。',
        'This time is booked or unavailable. Please choose another time.'
      );
      conflictHint.style.color = '#b42318';
    } else {
      conflictHint.textContent = msg(
        '此時段目前沒有已核准預約或停用紀錄，仍須經管理員審核。',
        'No approved booking or closure found. Approval is still required.'
      );
      conflictHint.style.color = '#35745c';
    }

  } catch (error) {
    if (version !== conflictCheckVersion) return;

    // 無法確認時，不允許直接送出
    timeConflict = true;
    conflictHint.textContent = msg(
      '目前無法確認場地時段，請稍後重試。' + error.message,
      'Unable to check availability. Please retry. ' + error.message
    );
    conflictHint.style.color = '#b42318';

  } finally {
    if (version === conflictCheckVersion) {
      checkingConflict = false;
      updateConflictButton();
    }
  }
}

// 選擇場地、日期、開始或結束時間時，立即檢查
for (const key of ['room_id', 'date', 'start', 'end']) {
  form.elements[key].addEventListener(
    'change',
    checkBookingConflict
  );
}

// 登入狀態變化時，重新套用按鈕狀態
db.auth.onAuthStateChange(() => {
  setTimeout(updateConflictButton, 0);
});


// Present understandable, bilingual guidance without exposing raw database errors.
function bookingErrorMessage(error) {
  const raw=String(error?.message||'');
  if (/weekend bookings are not allowed/i.test(raw)) return msg(
    '申請未送出：系統將所選日期判定為週末。若您選的是週一至週五，這可能是日期判斷異常；請勿反覆送出，請將日期、時間及此訊息提供山居學習中心協助確認。',
    'Request not submitted: the system classified your selected date as a weekend. If you selected Monday–Friday, this may be a date-validation error. Please contact Hillside Learning Center with your selected date and time.'
  );
  if (/working days|business days|advance|too late|minimum notice/i.test(raw)) return msg(
    '申請未送出：未符合提前申請期限，請至少提前 3 個工作天選擇借用日期。',
    'Request not submitted: please choose a date at least 3 working days in advance.'
  );
  if (/conflict|overlap|already booked|unavailable|blocked/i.test(raw)) return msg(
    '申請未送出：此場地時段可能已被預約或停用，請重新選擇時段。',
    'Request not submitted: this room may already be booked or unavailable. Please choose another time.'
  );
  if (/holiday/i.test(raw)) return msg(
    '申請未送出：所選日期可能為不開放借用的假日，請改選其他日期。',
    'Request not submitted: the selected date may be a non-booking holiday. Please choose another date.'
  );
  if (/jwt|session|not authenticated|unauthorized|permission denied/i.test(raw)) return msg(
    '申請未送出：登入狀態已失效或權限不足，請重新使用政大 Google 帳號登入。',
    'Request not submitted: your session has expired or access is restricted. Please sign in again with your NCCU Google account.'
  );
  return msg(
    '目前無法確認申請是否成功。請先到「我的申請」查看紀錄，若沒有新紀錄再聯絡山居學習中心（02-82375665），避免重複送出。',
    'We could not confirm the submission. Check My Bookings first; if there is no new record, contact Hillside Learning Center (02-82375665) before trying again.'
  );
}
let submittingBooking = false;

form.onsubmit = async e => {
  e.preventDefault();

  // 避免重複點擊送出
  if (submittingBooking) return;

  // 送出前再次查詢最新場地時段
  await checkBookingConflict();

  if (timeConflict || checkingConflict) {
    show('formstatus', msg(
      '所選時段不可借用，或目前無法確認場地狀態，請重新選擇時間。',
      'The selected time is unavailable or could not be verified.'
    ));
    return;
  }

  // 檢查完成後才繼續執行原本的送出流程
if(!user||!emailOK(user.email)){show('formstatus',msg('請先以政大帳號登入。','NCCU login required.'));return;}if(!policy){show('formstatus',msg('借用規範尚未載入。','Policy is not loaded.'));return;}const v=Object.fromEntries(new FormData(form));if(!v.start||!v.end||v.end<=v.start){show('formstatus',msg('結束時間必須晚於開始時間。','End time must be after start time.'));return;}const start=isoLocal(v.date,v.start),end=isoLocal(v.date,v.end);if((new Date(end)-new Date(start))>4*3600000){show('formstatus',msg('每次最多借用 4 小時。','Maximum 4 hours.'));return;}if (v.start < '10:00' || v.end > '21:00') {
  show(
    'formstatus',
    msg(
      '借用時間限 10:00–21:00。',
      'Booking hours are 10:00–21:00.'
    )
  );
  return;
}if(!form.elements.consent.checked){show('formstatus',msg('請先同意借用規範。','Please accept the policy.'));return;}const payload={applicant_name:v.applicant_name.trim(),applicant_identity:v.applicant_identity,applicant_number:v.applicant_number.trim(),applicant_phone:v.applicant_phone.trim(),applicant_unit:v.applicant_unit.trim(),room_id:v.room_id,activity_name:v.activity_name.trim(),purpose:v.purpose.trim(),attendee_count:Number(v.attendee_count),equipment_needs:v.equipment_needs?.trim()||null,start_at:start,end_at:end,special_reason:v.special_reason?.trim()||null,consent:true,language:lang};$('submit').disabled=true;show('formstatus',msg('正在送出至 Supabase…','Submitting to Supabase…'));try{submittingBooking = true;
const {data,error}=await db.rpc('submit_booking',{payload});if(error)throw error;show('formstatus',msg(`申請已成功送出！申請編號：${data}。目前為「待審核」，尚未核准；可至「我的申請」查看進度。`,`Booking request submitted! Reference: ${data}. Status: Pending review (not approved). Check My Bookings for updates.`));form.reset();$('email').value=user.email;await loadMine();await loadSchedule();}catch(error){show('formstatus',bookingErrorMessage(error));}finally{
  submittingBooking = false;
  render();
}};
async function loadMine(){if(!user)return;show('mineResult',msg('讀取中…','Loading…'));const {data,error}=await db.from('bookings').select('id,room_id,activity_name,start_at,end_at,status,review_reason,created_at').eq('applicant_id',user.id).order('created_at',{ascending:false}).limit(100);if(error){show('mineResult',msg('讀取失敗：','Failed to load: ')+error.message);return;}const root=$('mineResult');root.replaceChildren();if(!data?.length){root.textContent=msg('目前沒有申請紀錄。','No bookings yet.');return;}for(const b of data){const div=document.createElement('div');div.className='entry';div.append(node('strong',`${names[b.room_id]||b.room_id} · ${b.activity_name}`),node('div',`${fmt(b.start_at)} — ${fmt(b.end_at)}`),node('div',msg('狀態：','Status: ')+(lang==='zh-TW'?statuses[b.status]:enStatuses[b.status]||b.status)));if(b.review_reason)div.append(node('div',msg('審核說明：','Review note: ')+b.review_reason));if(['pending','needs_info','alternative_proposed','approved'].includes(b.status)&&new Date(b.start_at)>new Date()){const btn=node('button',msg('取消申請','Cancel booking'));btn.type='button';btn.onclick=async()=>{if(!confirm(msg('確定要取消這筆申請嗎？','Cancel this booking?')))return;btn.disabled=true;const {error}=await db.rpc('cancel_booking',{booking_id:b.id});if(error){alert(error.message);btn.disabled=false;}else await loadMine();};div.append(btn);}root.append(div);}}
$('refreshMine').onclick=loadMine;
$('lang').onclick=()=>{lang=lang==='zh-TW'?'en':'zh-TW';localStorage.setItem('hillside-language',lang==='zh-TW'?'zh':'en');applyStaticLanguage();const languageTexts={notice:['系統測試中：申請與審核資料已連接 Supabase，Google Calendar 同步及通知尚未完成。送出申請不代表核准。','TEST SYSTEM: Applications and reviews are connected to Supabase. Google Calendar sync and notifications are not yet available. Submission is not approval.'],headline:['留一段時間，給自在學習的空間。','A space to learn, on your own terms.'],intro:['政大 Google 登入 · 雲端預約申請 · 查詢個人紀錄','NCCU Google login · Online applications · My bookings'],scheduleTitle:['場地借用時段','Room availability'],scheduleHint:['僅顯示已核准與停用時段，不顯示其他人的申請資料。','Only approved reservations and room blocks are visible.'],allRoomsText:['全部場地','All rooms'],applyTitle:['申請借用','Apply for a room'],
applyHint:[
  '限政大信箱登入；借用須至少提前 3 個工作天，最多可預約未來 30 個日曆天。借用時間 10:00–21:00，每次最多 4 小時，以 30 分鐘為單位。所有申請均須審核。',
  'NCCU login required. Apply at least 3 working days ahead, up to 30 calendar days in advance. Booking hours: 10:00–21:00. Maximum 4 hours per booking, in 30-minute increments. All applications require approval.'
],
};for(const [id,arr] of Object.entries(languageTexts))$(id).textContent=arr[lang==='zh-TW'?0:1];makeTimes();updateRoomNotice();loadPolicy();render();loadSchedule();};
applyStaticLanguage();
for(const [id,arr] of Object.entries({headline:['留一段時間，給自在學習的空間。','A space to learn, on your own terms.'],intro:['政大 Google 登入 · 雲端預約申請 · 查詢個人紀錄','NCCU Google login · Online applications · My bookings'],scheduleTitle:['場地借用時段','Room availability'],scheduleHint:['僅顯示已核准與停用時段，不顯示其他人的申請資料。','Only approved reservations and room blocks are visible.'],allRoomsText:['全部場地','All rooms'],applyTitle:['申請借用','Apply for a room'],applyHint:['限政大信箱登入；借用須至少提前 3 個工作天，最多可預約未來 30 個日曆天。借用時間 10:00–21:00，每次最多 4 小時，以 30 分鐘為單位。所有申請均須審核。','NCCU login required. Apply at least 3 working days ahead, up to 30 calendar days in advance. Booking hours: 10:00–21:00. Maximum 4 hours per booking, in 30-minute increments. All applications require approval.']}))$(id).textContent=arr[lang==='zh-TW'?0:1];
makeTimes();form.elements.date.min=todayTW();loadPolicy();loadSchedule();check();
