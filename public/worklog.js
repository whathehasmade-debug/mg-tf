import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://movexxnyiruogvmlwrnm.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kEmxsuXD2UwTThCc1Cufag_zuuTJcHI'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const $ = id => document.getElementById(id)
let entries = []
let mode = 'all'
const dialog = $('worklogDialog')

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    location.href = './index.html'
    return
  }

  $('userEmail').textContent = session.user.email || ''
  $('worklogView').classList.remove('hidden')
  await loadEntries()
}

async function loadEntries() {
  const { data, error } = await supabase
    .from('worklog_entries')
    .select('*')
    .order('week_start', { ascending: false })
    .order('source_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error(error)
    alert('업무일지를 불러오지 못했습니다.')
    return
  }

  entries = data || []
  render()
}

function visibleEntries() {
  const q = $('worklogSearch').value.trim().toLowerCase()
  return entries.filter(e => {
    const modeOk = mode === 'all' || (mode === 'pending' ? !e.completed : e.completed)
    const qOk = !q || String(e.content || '').toLowerCase().includes(q)
    return modeOk && qOk
  })
}

function render() {
  const all = entries.length
  const done = entries.filter(e => e.completed).length
  $('statAll').textContent = all
  $('statDone').textContent = done
  $('statPending').textContent = all - done

  const visible = visibleEntries()
  const ongoing = visible.filter(e => e.pinned)
  const normal = visible.filter(e => !e.pinned)

  $('ongoingWrap').classList.toggle('hidden', ongoing.length === 0)
  $('ongoingCount').textContent = ongoing.length ? ongoing.length + '건' : ''
  $('ongoingRows').innerHTML = ongoing.map(taskRow).join('')

  const groups = new Map()
  normal.forEach(e => {
    const key = e.week_start + '|' + e.week_end
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  })

  $('weekGroups').innerHTML = [...groups.entries()].map(([key, items]) => {
    const [start, end] = key.split('|')
    return '<section class="week-section">' +
      '<div class="week-head"><h2>' + weekLabel(start, end) + '</h2><div style="display:flex;align-items:center;gap:10px"><label class="check" style="font-size:12px"><input class="week-select-all" type="checkbox" data-week="' + esc(key) + '"' + (items.length && items.every(x => x.completed) ? ' checked' : '') + ' /> 전체선택</label><span class="week-count">' + items.length + '건</span></div></div>' +
      '<div class="task-list">' + items.map(taskRow).join('') + '</div>' +
    '</section>'
  }).join('')

  document.querySelectorAll('.task-check').forEach(input => {
    input.addEventListener('click', e => e.stopPropagation())
    input.addEventListener('change', () => toggleComplete(input.dataset.id, input.checked))
  })
  document.querySelectorAll('.task-content').forEach(el => {
    el.addEventListener('click', () => openTask(el.dataset.id))
  })
  document.querySelectorAll('.week-select-all').forEach(input => {
    const [start, end] = input.dataset.week.split('|')
    const weekItems = normal.filter(e => e.week_start === start && e.week_end === end)
    const doneCount = weekItems.filter(e => e.completed).length
    input.indeterminate = doneCount > 0 && doneCount < weekItems.length
    input.addEventListener('change', () => toggleWeek(start, end, input.checked))
  })

  $('worklogEmpty').classList.toggle('hidden', visible.length > 0)
}

function taskRow(e) {
  return '<div class="task-row ' + (e.completed ? 'completed' : '') + '">' +
    '<input class="task-check" type="checkbox" data-id="' + esc(e.id) + '"' + (e.completed ? ' checked' : '') + ' />' +
    '<div class="task-content" data-id="' + esc(e.id) + '">' + esc(e.content) + '</div>' +
    '<div class="task-meta">' + (e.pinned ? '<span class="pin-badge">계속 확인</span>' : '') + '</div>' +
  '</div>'
}

async function toggleWeek(start, end, completed) {
  const targets = visibleEntries().filter(e => !e.pinned && e.week_start === start && e.week_end === end)
  if (!targets.length) return

  const ids = targets.map(e => e.id)
  const { error } = await supabase
    .from('worklog_entries')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .in('id', ids)

  if (error) {
    alert('주간 전체선택 저장에 실패했습니다.')
    await loadEntries()
    return
  }

  entries.forEach(item => {
    if (ids.includes(item.id)) {
      item.completed = completed
      item.completed_at = completed ? new Date().toISOString() : null
    }
  })
  render()
}

async function toggleComplete(id, completed) {
  const { error } = await supabase
    .from('worklog_entries')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    alert('완료 상태 저장에 실패했습니다.')
    await loadEntries()
    return
  }

  const target = entries.find(e => e.id === id)
  if (target) {
    target.completed = completed
    target.completed_at = completed ? new Date().toISOString() : null
  }
  render()
}

function openNew() {
  $('worklogForm').reset()
  $('wId').value = ''
  $('worklogDialogTitle').textContent = '업무 추가'
  $('deleteWorklogBtn').classList.add('hidden')
  $('worklogMsg').textContent = ''

  const latest = entries.slice().sort((a,b) => String(b.week_start).localeCompare(String(a.week_start)))[0]
  if (latest) {
    $('wWeekStart').value = latest.week_start
    $('wWeekEnd').value = latest.week_end
  }

  dialog.showModal()
}

function openTask(id) {
  const e = entries.find(x => x.id === id)
  if (!e) return

  $('worklogForm').reset()
  $('wId').value = e.id
  $('wWeekStart').value = e.week_start || ''
  $('wWeekEnd').value = e.week_end || ''
  $('wContent').value = e.content || ''
  $('wPinned').checked = !!e.pinned
  $('wCompleted').checked = !!e.completed
  $('worklogDialogTitle').textContent = '업무 수정'
  $('deleteWorklogBtn').classList.remove('hidden')
  $('worklogMsg').textContent = ''
  dialog.showModal()
}

$('worklogForm').addEventListener('submit', async e => {
  e.preventDefault()

  const id = $('wId').value
  const payload = {
    week_start: $('wWeekStart').value,
    week_end: $('wWeekEnd').value,
    content: $('wContent').value.trim(),
    pinned: $('wPinned').checked,
    completed: $('wCompleted').checked,
    completed_at: $('wCompleted').checked ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }

  if (!payload.content) return
  $('worklogMsg').textContent = '저장 중...'

  let result
  if (id) {
    result = await supabase.from('worklog_entries').update(payload).eq('id', id)
  } else {
    result = await supabase.from('worklog_entries').insert(payload)
  }

  if (result.error) {
    $('worklogMsg').textContent = result.error.message
    return
  }

  dialog.close()
  await loadEntries()
})

$('deleteWorklogBtn').addEventListener('click', async () => {
  const id = $('wId').value
  if (!id) return
  if (!confirm('이 업무를 삭제할까요?')) return

  const { error } = await supabase.from('worklog_entries').delete().eq('id', id)
  if (error) {
    $('worklogMsg').textContent = error.message
    return
  }

  dialog.close()
  await loadEntries()
})

document.querySelectorAll('.view-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode
    document.querySelectorAll('.view-switch button').forEach(x => x.classList.toggle('active', x === btn))
    render()
  })
})

$('worklogSearch').addEventListener('input', render)


$('newTaskBtn').addEventListener('click', openNew)
$('closeWorklogDialog').addEventListener('click', () => dialog.close())
$('cancelWorklogBtn').addEventListener('click', () => dialog.close())
$('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut()
  location.href = './index.html'
})

function weekLabel(start, end) {
  return shortDate(start) + ' ~ ' + shortDate(end)
}
function shortDate(v) {
  if (!v) return ''
  const [y,m,d] = String(v).split('-')
  return y.slice(2) + '.' + m + '.' + d + '.'
}
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]))
}

init()
