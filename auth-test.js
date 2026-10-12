import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://urgmjidcjrglyfgoohtx.supabase.co', 'sb_publishable_-PohQjs2ygBfe4XzAydbFA_Jht2vfwF', { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
const status = document.getElementById('status');
const login = document.getElementById('login');
const logout = document.getElementById('logout');
const refresh = document.getElementById('refresh');
function render(session) {
 const user = session?.user;
 const email = user?.email || '';
 const isNccu = /^[^@\s]+@(?:[a-z0-9-]+\.)*nccu\.edu\.tw$/i.test(email);
 login.hidden = !!user;
 logout.hidden = !user;
 status.textContent = !user ? '目前尚未登入。請按「使用 Google 登入」。' : `已登入：${email}\n政大信箱格式：${isNccu ? '符合' : '不符合'}\n帳號 ID：${user.id}${isNccu ? '' : '\n注意：此帳號不可提交政大場地申請。'}`;
}
async function check() {
 status.textContent = '正在確認登入狀態…';
 const { data, error } = await supabase.auth.getSession();
 if(error) {status.textContent = '取得登入狀態失敗：'+error.message;return;}
 render(data.session);
}
login.addEventListener('click',async()=>{
 login.disabled = true;
 const {error} = await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin + window.location.pathname}});
 if(error) {status.textContent = 'Google 登入啟動失敗：'+error.message;login.disabled=false;}
});
logout.addEventListener('click',async()=>{
 const {error} = await supabase.auth.signOut();
 if(error)status.textContent='登出失敗：'+error.message;else await check();
});
refresh.addEventListener('click',check);
supabase.auth.onAuthStateChange((_event,session)=>render(session));
login.disabled=false;
check();
