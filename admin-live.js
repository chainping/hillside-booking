
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Publishable key only. Never place service_role or Google Client Secret here.
const db = createClient(
  'https://urgmjidcjrglyfgoohtx.supabase.co',
  'sb_publishable_-PohQjs2ygBfe4XzAydbFA_Jht2vfwF',
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  }
);

const $ = id => document.getElementById(id);

const names = {
  a: '木地板 A',
  b: '木地板 B',
  stars: '群星室',
  e: 'E 化教室'
};

const labels = {
  pending: '待審核',
  needs_info: '待補件',
  alternative_proposed: '建議替代時段',
  approved: '已核准',
  rejected: '未核准',
  cancelled: '已取消',
  completed: '已完成'
};

const reviewable = new Set([
  'pending',
  'needs_info',
  'alternative_proposed'
]);

let user = null;
let bookings = [];
let authorized = false;
let requestVersion = 0;

const node = (tag, value, className) => {
  const el = document.createElement(tag);
  el.textContent = value == null ? '—' : String(value);
  if (className) el.className = className;
  return el;
};

const fmt = value => value
  ? new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value))
  : '—';

const short = value =>
  value == null || value === '' ? '—' : String(value);

function field(root, name, value) {
  const d = document.createElement('div');
  d.append(node('b', name), node('span', short(value)));
  root.append(d);
}

function setAuth(message) {
  $('authStatus').textContent = message;
}

function clearPrivate() {
  authorized = false;
  bookings = [];
  $('adminContent').hidden = true;
  $('bookingList').replaceChildren();
  $('summary').replaceChildren();
  $('blockList').replaceChildren();
  $('blockStatus').textContent = '';
}

async function load() {
  if (!user) return;

  const version = ++requestVersion;
  clearPrivate();
  $('refresh').disabled = true;
  setAuth('正在檢查管理員權限及讀取申請資料…');

  try {
    // The database RPC checks is_admin(auth.uid()).
    const { data, error } = await db.rpc('admin_bookings');

    if (version !== requestVersion) return;
    if (error) throw error;

    authorized = true;
    bookings = Array.isArray(data) ? data : [];
    $('adminContent').hidden = false;

    setAuth(
      `管理員權限驗證通過 · ${user.email} · ` +
      `已載入 ${bookings.length} 筆（最多 500 筆）`
    );

    render();
    await loadBlocks();

  } catch (error) {
    if (version !== requestVersion) return;

    clearPrivate();
    setAuth(
      '無法開啟管理後台：' + error.message +
      '。請確認帳號已列入 admin_members，' +
      '且資料庫有 admin_bookings() RPC。'
    );

  } finally {
    if (version === requestVersion) {
      $('refresh').disabled = false;
    }
  }
}

function render() {
  if (!authorized) return;

  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => reviewable.has(b.status)).length,
    approved: bookings.filter(b => b.status === 'approved').length,
    rejected: bookings.filter(b => b.status === 'rejected').length
  };

  $('summary').replaceChildren();

  for (const [name, key] of [
    ['已載入', 'all'],
    ['待處理', 'pending'],
    ['已核准', 'approved'],
    ['未核准', 'rejected']
  ]) {
    const div = node('div', '', 'stat');
    div.append(
      node('span', name),
      node('strong', counts[key])
    );
    $('summary').append(div);
  }

  const filter = $('filter').value;
  const query = $('search').value.trim().toLocaleLowerCase();

  const list = bookings.filter(b =>
    (
      filter === 'all' ||
      (
        filter === 'reviewable'
          ? reviewable.has(b.status)
          : b.status === filter
      )
    ) &&
    (
      !query ||
      [
        b.applicant_name,
        b.activity_name,
        b.applicant_email,
        b.applicant_unit,
        b.room_id,
        names[b.room_id]
      ].some(s =>
        String(s || '').toLocaleLowerCase().includes(query)
      )
    )
  );

  $('listStatus').textContent =
    `目前顯示 ${list.length} 筆申請。`;

  $('bookingList').replaceChildren();

  if (!list.length) {
    $('bookingList').append(
      node('p', '沒有符合條件的申請。', 'empty')
    );
    return;
  }

  for (const b of list) {
    const card = document.createElement('article');
    card.className = 'booking-card';

    card.append(
      node(
        'h3',
        `${names[b.room_id] || b.room_id} · ${short(b.activity_name)}`
      )
    );

    card.append(
      node(
        'span',
        labels[b.status] || b.status,
        `tag ${b.status}`
      )
    );

    const info = document.createElement('div');
    info.className = 'meta';
    info.style.marginTop = '14px';

    for (const [key, value] of [
      ['借用開始', fmt(b.start_at)],
      ['借用結束', fmt(b.end_at)],
      ['申請人', b.applicant_name],
      ['政大信箱', b.applicant_email],
      ['身分', b.applicant_identity],
      ['學號／職員編號', b.applicant_number],
      ['電話', b.applicant_phone],
      ['系所／單位', b.applicant_unit],
      ['人數', b.attendee_count],
      ['活動目的', b.purpose],
      ['設備需求', b.equipment_needs],
      ['特殊借用原因', b.special_reason],
      ['申請時間', fmt(b.created_at)],
      ['審核說明', b.review_reason],
      ['審核時間', fmt(b.reviewed_at)],
      ['申請編號', b.id]
    ]) {
      field(info, key, value);
    }

    card.append(info);

    if (reviewable.has(b.status)) {
      const box = document.createElement('div');
      box.className = 'review-box';

      box.append(node('strong', '審核操作'));

      const reason = document.createElement('textarea');
      reason.rows = 2;
      reason.maxLength = 2000;
      reason.placeholder =
        '駁回或要求補件時，必須填寫原因；核准時可選填備註';
      reason.setAttribute('aria-label', '審核原因');

      box.append(reason);

      const actions = document.createElement('div');
      actions.className = 'actions';

      for (const [decision, title] of [
        ['approved', '核准'],
        ['needs_info', '要求補件'],
        ['rejected', '駁回']
      ]) {
        const btn = node('button', title);
        btn.type = 'button';

        if (decision !== 'approved') {
          btn.className = 'outline';
        }

        btn.onclick = async () => {
          const note = reason.value.trim();

          if (decision !== 'approved' && !note) {
            alert('請先填寫審核原因。');
            reason.focus();
            return;
          }

          if (!confirm(
            `確定要「${title}」這筆申請？\n` +
            `${names[b.room_id] || b.room_id} · ${fmt(b.start_at)}\n` +
            '此操作會立即寫入真實資料庫。'
          )) return;

          actions.querySelectorAll('button').forEach(
            el => el.disabled = true
          );

          $('listStatus').textContent = '正在寫入審核結果…';

          const { error } = await db.rpc('review_booking', {
            booking_id: b.id,
            decision,
            reason: note || null
          });

         if (error) {
  const isConflict =
    error.code === '23P01' ||
    error.message?.includes('approved_bookings_no_overlap');

  const message = isConflict
    ? '這間教室在所選時段已有其他核准預約，無法重複核准。請駁回此申請，或與申請人協調其他時段。'
    : '審核失敗：' + error.message;

  alert(message);

  actions.querySelectorAll('button').forEach(
    el => el.disabled = false
  );

  $('listStatus').textContent = '審核失敗，資料未更新。';
  return;
}

          await load();
        };

        actions.append(btn);
      }

      box.append(actions);
      card.append(box);

    } else if (
      b.status === 'approved' &&
      new Date(b.start_at).getTime() > Date.now()
    ) {
      const box = document.createElement('div');
      box.className = 'review-box';

      box.append(node('strong', '已核准預約管理'));

      box.append(node(
        'p',
        '取消後會釋出預約時段；Google 日曆是否完成同步，請另行確認。',
        'private-notice'
      ));

      const actions = document.createElement('div');
      actions.className = 'actions';

      const btn = node('button', '取消預約', 'outline');
      btn.type = 'button';
      btn.style.borderColor = '#b42318';
      btn.style.color = '#b42318';

      btn.onclick = async () => {
        const message =
          `確定取消這筆預約嗎？\n\n` +
          `場地：${names[b.room_id] || b.room_id}\n` +
          `活動：${short(b.activity_name)}\n` +
          `開始：${fmt(b.start_at)}\n` +
          `結束：${fmt(b.end_at)}\n\n` +
          '取消後會釋出時段，且無法直接復原。';

        if (!confirm(message)) return;

        btn.disabled = true;
        btn.textContent = '正在取消…';
        $('listStatus').textContent = '正在取消預約…';

        try {
          const { error } = await db.rpc('cancel_booking', {
            booking_id: b.id
          });

          if (error) throw error;

          alert(
            '預約已取消！請另行確認 Google 日曆活動是否同步移除。'
          );

          await load();

        } catch (error) {
          alert(
            '取消未完成：' +
            (error?.message || String(error))
          );

          btn.disabled = false;
          btn.textContent = '取消預約';
          $('listStatus').textContent =
            '請確認預約狀態後再操作。';
        }
      };

      actions.append(btn);
      box.append(actions);
      card.append(box);

    } else {
      card.append(node(
        'p',
        '此申請目前不是可審核狀態。',
        'private-notice'
      ));
    }

    $('bookingList').append(card);
  }
}

// Convert Taiwan local datetime to UTC.
function taiwanISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('請填寫完整日期與時間');
  }

  const d = new Date(value + ':00+08:00');

  if (!Number.isFinite(d.getTime())) {
    throw new Error('日期時間無效');
  }

  return d.toISOString();
}

async function loadBlocks() {
  if (!authorized) return;

  const current = requestVersion;
  $('blockStatus').textContent = '正在讀取停用紀錄…';

  const { data, error } = await db.rpc('admin_room_blocks');

  if (current !== requestVersion || !authorized) return;

  if (error) {
    $('blockStatus').textContent =
      '讀取失敗：' + error.message +
      '。請先執行提供的 admin_room_blocks SQL。';
    return;
  }

  const blocks = Array.isArray(data) ? data : [];

  $('blockStatus').textContent =
    `已載入 ${blocks.length} 筆停用紀錄（最近最多 200 筆）。`;

  $('blockList').replaceChildren();

  if (!blocks.length) {
    $('blockList').append(
      node('p', '目前沒有停用紀錄。', 'empty')
    );
    return;
  }

  for (const b of blocks) {
    const card = document.createElement('article');
    card.className = 'booking-card';

    card.append(
      node('h3', names[b.room_id] || b.room_id)
    );

    const meta = document.createElement('div');
    meta.className = 'meta';

    for (const [key, value] of [
      ['開始時間', fmt(b.start_at)],
      ['結束時間', fmt(b.end_at)],
      ['內部原因', b.internal_reason],
      ['建立時間', fmt(b.created_at)]
    ]) {
      field(meta, key, value);
    }

    card.append(meta);
    
    // 解除場地停用
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.style.marginTop = '16px';

    const removeBtn = node('button', '解除停用', 'outline');
    removeBtn.type = 'button';
    removeBtn.style.borderColor = '#b42318';
    removeBtn.style.color = '#b42318';

    removeBtn.onclick = async () => {
      const message =
        `確定要解除這筆場地停用嗎？\n\n` +
        `場地：${names[b.room_id] || b.room_id}\n` +
        `開始：${fmt(b.start_at)}\n` +
        `結束：${fmt(b.end_at)}\n` +
        `原因：${short(b.internal_reason)}\n\n` +
        '解除後，學生端將不再顯示這筆停用時段。';

      if (!confirm(message)) return;

      removeBtn.disabled = true;
      removeBtn.textContent = '正在解除…';

      try {
        const { error } = await db.rpc('delete_room_block', {
          p_block_id: b.id
        });

        if (error) throw error;

        await loadBlocks();
        alert('停用已解除！請重新整理學生端日曆確認。');

      } catch (error) {
        alert(
          '解除失敗：' +
          (error?.message || String(error))
        );

        removeBtn.disabled = false;
        removeBtn.textContent = '解除停用';
      }
    };

    actions.append(removeBtn);
    card.append(actions);

    $('blockList').append(card);
  }
}

// Batch all-room closure: database RPC validates conflicts atomically.
$('batchBlockForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!authorized) return;
  const button = $('batchSubmit');
  const status = $('batchStatus');
  const kind = $('batchType').value;
  const note = $('batchNote').value.trim();
  const start = $('batchStart').value;
  const end = $('batchEnd').value;
  const allowed = ['寒假閉館', '暑假閉館', '臨時閉館', '其他全館停用'];
  if (!allowed.includes(kind)) {
    status.textContent = '請選擇有效的閉館類型。';
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    status.textContent = '請確認開始及結束日期，結束日期不可早於開始日期。';
    return;
  }
  const reason = note ? kind + '｜' + note : kind;
  if (reason.length > 300) {
    status.textContent = '閉館原因過長，請縮短補充說明。';
    return;
  }
  if (!confirm(
    '確定設定全部四個場地閉館？\n\n' +
    '類型：' + kind + '\n' +
    '日期：' + start + ' 至 ' + end + '（含結束日）\n' +
    '場地：木地板 A、木地板 B、群星室、E 化教室\n' +
    '原因：' + reason + '\n\n' +
    '將立即寫入正式資料庫；如有預約或活動衝突，整批不會建立。'
  )) return;
  button.disabled = true;
  status.textContent = '正在檢查衝突並建立全館閉館紀錄…';
  try {
    const { data, error } = await db.rpc('create_all_room_blocks', {
      p_start_date: start,
      p_end_date: end,
      p_reason: reason
    });
    if (error) throw error;
    const ids = Array.isArray(data) ? data : [];
    status.textContent = '全館閉館已建立，共 ' + ids.length + ' 筆場地紀錄。';
    $('batchBlockForm').reset();
    await loadBlocks();
    status.textContent = '全館閉館已建立，共 ' + ids.length + ' 筆場地紀錄。請至學生端日曆確認。';
  } catch (error) {
    const raw = error?.message || String(error);
    const readable = raw.includes('Conflicts with approved booking')
      ? '所選期間已有核准預約，請先處理衝突預約。'
      : raw.includes('Conflicts with external calendar event')
      ? '所選期間與 Google Calendar 外部活動衝突，請先確認活動。'
      : raw.includes('Conflicts with existing room block')
      ? '所選期間已有場地停用紀錄，請先檢查現有設定。'
      : raw.includes('Admin required')
      ? '目前帳號沒有管理員權限。'
      : raw.includes('Could not find the function')
      ? '找不到批次閉館函式，請確認 Supabase SQL 已成功建立。'
      : '設定失敗：' + raw;
    status.textContent = readable + ' 本次未新增批次閉館紀錄。';
  } finally {
    button.disabled = false;
  }
});

$('blockRefresh').onclick = loadBlocks;

$('blockForm').addEventListener('submit', async event => {
  event.preventDefault();

  if (!authorized) return;

  const btn = $('blockSubmit');

  try {
    const room = $('blockRoom').value;
    const reason = $('blockReason').value.trim();
    const start = taiwanISO($('blockStart').value);
    const end = taiwanISO($('blockEnd').value);

    if (!reason) {
      throw new Error('請填寫停用原因');
    }

    if (new Date(end) <= new Date(start)) {
      throw new Error('結束時間必須晚於開始時間');
    }

    if (!confirm(
      `確定新增停用時段？\n` +
      `場地：${names[room]}\n` +
      `開始：${fmt(start)}\n` +
      `結束：${fmt(end)}\n` +
      `原因：${reason}\n\n` +
      '將立即寫入正式資料庫；可在停用紀錄中解除。'
    )) return;

    btn.disabled = true;
    $('blockStatus').textContent = '正在新增停用時段…';

    const { error } = await db.rpc('create_room_block', {
      p_room: room,
      p_start: start,
      p_end: end,
      p_reason: reason
    });

    if (error) throw error;

    $('blockStatus').textContent = '停用時段已建立。';
    $('blockForm').reset();

    await loadBlocks();

    alert(
      '停用時段已建立，請到學生公開日曆確認顯示。'
    );

  } catch (error) {
    $('blockStatus').textContent =
      '新增失敗：' +
      (error?.message || String(error));

  } finally {
    btn.disabled = false;
  }
});

$('filter').addEventListener('change', render);
$('search').addEventListener('input', render);
$('refresh').onclick = load;

$('login').onclick = async () => {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + location.pathname
    }
  });

  if (error) {
    setAuth('登入失敗：' + error.message);
  }
};

$('logout').onclick = async () => {
  requestVersion++;
  clearPrivate();

  const { error } = await db.auth.signOut();

  if (error) {
    setAuth('登出失敗：' + error.message);
  } else {
    user = null;
    $('login').hidden = false;
    $('logout').hidden = true;
    $('refresh').hidden = true;
    setAuth('已登出。');
  }
};

async function init() {
  const { data, error } = await db.auth.getUser();

  if (error && error.name !== 'AuthSessionMissingError') {
    setAuth('驗證登入狀態失敗：' + error.message);
  }

  user = data?.user || null;

  $('login').hidden = !!user;
  $('logout').hidden = !user;
  $('refresh').hidden = !user;

  if (user) {
    await load();
  } else {
    setAuth('請使用已授權的政大 Google 帳號登入。');
  }
}

init();
