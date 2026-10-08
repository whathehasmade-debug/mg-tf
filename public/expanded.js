import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://movexxnyiruogvmlwrnm.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kEmxsuXD2UwTThCc1Cufag_zuuTJcHI'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
const $ = id => document.getElementById(id)

let expandedCases = []
const dialog = $('expandedDialog')

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    location.href = './index.html'
    return
  }

  $('userEmail').textContent = session.user.email || ''
  $('expandedView').classList.remove('hidden')
  await loadExpandedCases()
}

async function loadExpandedCases() {
  const { data, error } = await supabase
    .from('expanded_cases')
    .select('*')
    .order('filed_at', { ascending: false, nullsFirst: false })

  if (error) {
    console.error(error)
    alert('확대특진 자료를 불러오지 못했습니다.')
    return
  }

  expandedCases = data || []
  render()
}

function render() {
  const q = $('expandedSearchInput').value.trim().toLowerCase()
  const filtered = expandedCases.filter(c => {
    const hay = [c.name, c.introducer].filter(Boolean).join(' ').toLowerCase()
    return !q || hay.includes(q)
  })

  $('expandedRows').innerHTML = filtered.map(c =>
    '<tr data-id="' + esc(c.id) + '">' +
      '<td>' + esc(c.name) + '</td>' +
      '<td>' + esc(c.introducer) + '</td>' +
      '<td>' + fmt(c.filed_at) + '</td>' +
      '<td>' + esc(c.status) + '</td>' +
      '<td>' + esc(c.initial_hospital) + '</td>' +
      '<td>' + esc(c.initial_value) + '</td>' +
      '<td>' + esc(c.special_hospital) + '</td>' +
      '<td>' + esc(c.special_value) + '</td>' +
      '<td>' + fmt(c.scheduled_at) + '</td>' +
      '<td>' + esc(c.notes) + '</td>' +
    '</tr>'
  ).join('')

  $('expandedCount').textContent = expandedCases.length
  $('expandedEmpty').classList.toggle('hidden', filtered.length > 0)

  document.querySelectorAll('#expandedRows tr').forEach(tr => {
    tr.addEventListener('click', () => openExpanded(tr.dataset.id))
  })
}

function openExpanded(id) {
  $('expandedForm').reset()
  $('expandedFormMsg').textContent = ''
  $('expandedId').value = ''
  $('expandedDialogTitle').textContent = '확대특진 등록'
  $('deleteExpandedBtn').classList.add('hidden')

  if (id) {
    const c = expandedCases.find(x => x.id === id)
    if (!c) return

    $('expandedId').value = c.id
    $('expandedDialogTitle').textContent = c.name
    $('deleteExpandedBtn').classList.remove('hidden')

    set('eName', c.name)
    set('eIntroducer', c.introducer)
    set('eBranch', c.branch)
    set('eAgencyContact', c.agency_contact)
    set('eFiledAt', c.filed_at)
    set('eStatus', c.status)
    set('eInitialHospital', c.initial_hospital)
    set('eInitialValue', c.initial_value)
    set('eSpecialHospital', c.special_hospital)
    set('eSpecialValue', c.special_value)
    set('eScheduledAt', c.scheduled_at)
    set('eNotes', c.notes)
  }

  dialog.showModal()
}

$('newExpandedBtn').addEventListener('click', () => openExpanded())
$('closeExpandedDialog').addEventListener('click', () => dialog.close())
$('cancelExpandedBtn').addEventListener('click', () => dialog.close())

$('expandedForm').addEventListener('submit', async e => {
  e.preventDefault()
  $('expandedFormMsg').textContent = '저장 중...'

  const id = $('expandedId').value
  const payload = {
    name: $('eName').value.trim(),
    introducer: val('eIntroducer'),
    branch: val('eBranch'),
    agency_contact: val('eAgencyContact'),
    filed_at: val('eFiledAt'),
    status: val('eStatus'),
    initial_hospital: val('eInitialHospital'),
    initial_value: val('eInitialValue'),
    special_hospital: val('eSpecialHospital'),
    special_value: val('eSpecialValue'),
    scheduled_at: val('eScheduledAt'),
    notes: val('eNotes'),
    updated_at: new Date().toISOString()
  }

  const result = id
    ? await supabase.from('expanded_cases').update(payload).eq('id', id)
    : await supabase.from('expanded_cases').insert(payload)

  if (result.error) {
    $('expandedFormMsg').textContent = result.error.message
    return
  }

  dialog.close()
  await loadExpandedCases()
})

$('deleteExpandedBtn').addEventListener('click', async () => {
  const id = $('expandedId').value
  if (!id || !confirm('이 확대특진 사건을 삭제할까요?')) return

  const { error } = await supabase.from('expanded_cases').delete().eq('id', id)
  if (error) {
    $('expandedFormMsg').textContent = error.message
    return
  }

  dialog.close()
  await loadExpandedCases()
})

$('expandedSearchInput').addEventListener('input', render)

$('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut()
  location.href = './index.html'
})

function val(id) {
  const v = $(id).value.trim()
  return v || null
}

function set(id, v) {
  $(id).value = v ?? ''
}

function fmt(v) {
  return v ? String(v).slice(0, 10) : ''
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]))
}

init()
