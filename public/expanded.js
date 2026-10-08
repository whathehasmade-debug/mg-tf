import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://movexxnyiruogvmlwrnm.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kEmxsuXD2UwTThCc1Cufag_zuuTJcHI'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
const $ = id => document.getElementById(id)
let expandedCases = []
const expandedDialog = $('expandedDialog')

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

  document.querySelectorAll('#expandedRows tr').forEach(tr => {
    tr.addEventListener('click', () => openExpanded(tr.dataset.id))
  })

  $('expandedCount').textContent = expandedCases.length
  $('expandedEmpty').classList.toggle('hidden', filtered.length > 0)
}

function openExpanded(id) {
  const c = expandedCases.find(x => x.id === id)
  if (!c) return

  $('expandedForm').reset()
  $('expandedFormMsg').textContent = ''
  $('eId').value = c.id
  $('expandedDialogTitle').textContent = c.name

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

  expandedDialog.showModal()
}

$('expandedForm').addEventListener('submit', async e => {
  e.preventDefault()

  const id = $('eId').value
  if (!id) return

  $('expandedFormMsg').textContent = '저장 중...'

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

  const { error } = await supabase
    .from('expanded_cases')
    .update(payload)
    .eq('id', id)

  if (error) {
    $('expandedFormMsg').textContent = error.message
    return
  }

  expandedDialog.close()
  await loadExpandedCases()
})

$('closeExpandedDialog').addEventListener('click', () => expandedDialog.close())
$('cancelExpandedBtn').addEventListener('click', () => expandedDialog.close())
$('expandedSearchInput').addEventListener('input', render)
$('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut()
  location.href = './index.html'
})

function val(id) {
  const v = $(id).value.trim()
  return v || null
}
function set(id, v) { $(id).value = v ?? '' }
function fmt(v) { return v ? String(v).slice(0,10) : '' }
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]))
}

init()
