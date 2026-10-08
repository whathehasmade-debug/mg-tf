import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://movexxnyiruogvmlwrnm.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kEmxsuXD2UwTThCc1Cufag_zuuTJcHI'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
const $ = id => document.getElementById(id)
let expandedCases = []

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
    '<tr>' +
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
}

$('expandedSearchInput').addEventListener('input', render)
$('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut()
  location.href = './index.html'
})

function fmt(v) { return v ? String(v).slice(0,10) : '' }
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]))
}

init()
