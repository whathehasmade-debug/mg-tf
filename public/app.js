import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://movexxnyiruogvmlwrnm.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kEmxsuXD2UwTThCc1Cufag_zuuTJcHI'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const $ = id => document.getElementById(id)
let allCases = []
let sortField = null
let sortDirection = 'desc'
const authView = $('authView')
const mainView = $('mainView')
const caseDialog = $('caseDialog')

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) await enterApp(session)
  else authView.classList.remove('hidden')
}

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  $('authMsg').textContent = '로그인 중...'
  const { error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  })
  $('authMsg').textContent = error ? error.message : ''
})

$('signupBtn').addEventListener('click', async () => {
  const email = $('email').value.trim()
  const password = $('password').value
  if (!email || password.length < 6) {
    $('authMsg').textContent = '이메일과 6자 이상 비밀번호를 입력해 주세요.'
    return
  }
  $('authMsg').textContent = '계정 생성 중...'
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) $('authMsg').textContent = error.message
  else $('authMsg').textContent = data.session
    ? '관리자 계정이 생성되었습니다.'
    : '확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.'
})

supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session) await enterApp(session)
  else {
    mainView.classList.add('hidden')
    authView.classList.remove('hidden')
  }
})

async function enterApp(session) {
  authView.classList.add('hidden')
  mainView.classList.remove('hidden')
  $('userEmail').textContent = session.user.email || ''
  await loadCases()
}

$('logoutBtn').addEventListener('click', () => supabase.auth.signOut())

async function loadCases() {
  const { data, error } = await supabase
    .from('cases')
    .select('*, case_hearing_exams(*)')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error(error)
    if (error.code === '42501') {
      alert('접근 권한이 없습니다. 관리자에게 사용자 등록을 요청하세요.')
      await supabase.auth.signOut()
    }
    return
  }
  allCases = data || []
  render()
}

function render() {
  const q = $('searchInput').value.trim().toLowerCase()
  const selectedStatuses = getSelectedStatuses()
  const selectedCategories = getSelectedCategories()

  syncStatusOptions()

  let filtered = allCases.filter(c => {
    const hay = [c.name, c.introducer, c.branch, c.agency_contact, c.occupation, c.notes]
      .filter(Boolean).join(' ').toLowerCase()
    return (!q || hay.includes(q))
      && (!selectedStatuses.length || selectedStatuses.includes(c.status))
      && (!selectedCategories.length || selectedCategories.some(category => matchesCategory(c, category)))
  })

  if (sortField) {
    filtered = [...filtered].sort((a, b) => compareDateField(a, b, sortField, sortDirection))
  }

  updateSortIcons()

  $('caseRows').innerHTML = filtered.map(c => `
    <tr data-id="${c.id}">
      <td><strong>${esc(c.name)}</strong></td>
      <td>${esc(c.introducer)}</td>
      <td>${esc(c.branch)}</td>
      <td>${esc(c.agency_contact)}</td>
      <td>${fmt(c.filed_at)}</td>
      <td>${fmt(c.notice_at)}</td>
      <td>${categoryBadges(c)}</td>
      <td><span class="status-pill">${esc(c.status)}</span></td>
      <td>${esc(c.occupation)}</td>
    </tr>`).join('')

  $('emptyState').classList.toggle('hidden', filtered.length > 0)
  $('statTotal').textContent = allCases.length
  $('statApproved').textContent = allCases.filter(c => matchesCategory(c, 'approved')).length
  $('statDeniedGeneral').textContent = allCases.filter(c => matchesCategory(c, 'denied_general')).length
  $('statShortfallDenied').textContent = allCases.filter(c => matchesCategory(c, 'shortfall_denied')).length
  $('statShortfallReturned').textContent = allCases.filter(c => matchesCategory(c, 'shortfall_returned')).length
  $('statExpanded').textContent = allCases.filter(c => matchesCategory(c, 'expanded')).length
  $('statActive').textContent = allCases.filter(c => matchesCategory(c, 'active')).length

  document.querySelectorAll('#caseRows tr')
    .forEach(tr => tr.addEventListener('click', () => openCase(tr.dataset.id)))
}

$('searchInput').addEventListener('input', render)

document.querySelectorAll('.category-check').forEach(input => {
  input.addEventListener('change', () => {
    updateCategorySummary()
    render()
  })
})

$('clearCategoryFilter').addEventListener('click', () => {
  document.querySelectorAll('.category-check').forEach(input => { input.checked = false })
  updateCategorySummary()
  render()
})

$('clearStatusFilter').addEventListener('click', () => {
  document.querySelectorAll('.status-check').forEach(input => { input.checked = false })
  updateStatusSummary()
  render()
})

document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const field = btn.dataset.sort
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      sortField = field
      sortDirection = 'desc'
    }
    render()
  })
})

$('newCaseBtn').addEventListener('click', () => openCase())
$('closeDialog').addEventListener('click', () => caseDialog.close())
$('cancelBtn').addEventListener('click', () => caseDialog.close())

function openCase(id) {
  $('caseForm').reset()
  $('formMsg').textContent = ''
  $('caseId').value = ''
  $('dialogTitle').textContent = '사건 등록'
  $('deleteCaseBtn').classList.add('hidden')

  if (id) {
    const c = allCases.find(x => x.id === id)
    if (!c) return
    const e = Array.isArray(c.case_hearing_exams) ? c.case_hearing_exams[0] : c.case_hearing_exams
    $('caseId').value = c.id
    $('dialogTitle').textContent = c.name
    $('deleteCaseBtn').classList.remove('hidden')
    set('fName', c.name); set('fIntroducer', c.introducer); set('fBranch', c.branch)
    set('fAgencyContact', c.agency_contact); set('fFiledAt', c.filed_at); set('fNoticeAt', c.notice_at)
    set('fStatus', c.status); set('fOccupation', c.occupation)
    set('fApprovalMaterial', c.approval_material); set('fNotes', c.notes)
    $('fMagog').checked = !!c.tag_magog
    $('fCapital').checked = !!c.tag_capital
    $('fLawfirm').checked = !!c.tag_lawfirm
    $('fShortfall').checked = !!c.numeric_shortfall
    $('fExpanded').checked = !!c.expanded_exam

    if (e) {
      set('fInitialHospital', e.initial_hospital)
      set('fInitialValue', e.initial_value)
      set('fSpecialHospital', e.special_hospital)
      set('fSpecialValue', e.special_value)
      set('fScheduledAt', e.scheduled_at)
      set('fExamNotes', e.notes)
    }
  }
  caseDialog.showModal()
}

$('caseForm').addEventListener('submit', async (ev) => {
  ev.preventDefault()
  $('formMsg').textContent = '저장 중...'
  const id = $('caseId').value
  const payload = {
    name: $('fName').value.trim(),
    introducer: val('fIntroducer'),
    branch: val('fBranch'),
    agency_contact: cleanAgencyContact(val('fAgencyContact')),
    filed_at: val('fFiledAt'),
    notice_at: val('fNoticeAt'),
    status: $('fStatus').value,
    occupation: val('fOccupation'),
    approval_material: val('fApprovalMaterial'),
    notes: val('fNotes'),
    tag_magog: $('fMagog').checked,
    tag_capital: $('fCapital').checked,
    tag_lawfirm: $('fLawfirm').checked,
    numeric_shortfall: $('fShortfall').checked,
    expanded_exam: $('fExpanded').checked
  }

  const result = id
    ? await supabase.from('cases').update(payload).eq('id', id).select().single()
    : await supabase.from('cases').insert(payload).select().single()

  if (result.error) {
    $('formMsg').textContent = result.error.message
    return
  }

  const caseId = result.data.id
  const examPayload = {
    case_id: caseId,
    initial_hospital: val('fInitialHospital'),
    initial_value: val('fInitialValue'),
    special_hospital: val('fSpecialHospital'),
    special_value: val('fSpecialValue'),
    scheduled_at: val('fScheduledAt'),
    notes: val('fExamNotes')
  }

  const hasExam = Object.entries(examPayload).some(([k, v]) => k !== 'case_id' && !!v)
  if (hasExam) {
    const { error } = await supabase
      .from('case_hearing_exams')
      .upsert(examPayload, { onConflict: 'case_id' })
    if (error) {
      $('formMsg').textContent = '사건은 저장됐지만 특진정보 저장 실패: ' + error.message
      return
    }
  }

  caseDialog.close()
  await loadCases()
})

$('deleteCaseBtn').addEventListener('click', async () => {
  const id = $('caseId').value
  if (!id || !confirm('이 사건을 삭제할까요?')) return
  const { error } = await supabase.from('cases').delete().eq('id', id)
  if (error) $('formMsg').textContent = error.message
  else {
    caseDialog.close()
    await loadCases()
  }
})

function getSelectedStatuses() {
  return [...document.querySelectorAll('.status-check:checked')].map(input => input.value)
}

function updateStatusSummary() {
  const selected = getSelectedStatuses()
  const summary = $('statusSummary')
  if (!selected.length) {
    summary.textContent = '전체 진행상황'
    return
  }
  summary.textContent = selected.length === 1
    ? selected[0]
    : selected.length + '개 진행상황 선택'
}

function getSelectedCategories() {
  return [...document.querySelectorAll('.category-check:checked')].map(input => input.value)
}

function updateCategorySummary() {
  const selected = getSelectedCategories()
  const summary = $('categorySummary')
  if (!selected.length) {
    summary.textContent = '전체 구분'
    return
  }
  const labels = {
    approved: '승인',
    denied_general: '불승인',
    shortfall_denied: '수치미달(불승인)',
    shortfall_returned: '수치미달(반려)',
    expanded: '확대특진',
    active: '진행중'
  }
  summary.textContent = selected.length === 1
    ? labels[selected[0]]
    : selected.length + '개 구분 선택'
}

function isActiveCase(c) {
  const s = String(c.status || '')
  return ['접수대기','접수완료','특진예정','특진중','특진완료'].includes(s)
    || s.includes('(진행)')
}

function matchesCategory(c, category) {
  if (!category) return true
  const s = String(c.status || '')
  if (category === 'approved') return s.startsWith('승인')
  if (category === 'denied_general') return !c.numeric_shortfall && s.startsWith('불승인')
  if (category === 'shortfall_denied') return !!c.numeric_shortfall && s.startsWith('불승인')
  if (category === 'shortfall_returned') return !!c.numeric_shortfall && s.startsWith('반려')
  if (category === 'expanded') return !!c.expanded_exam
  if (category === 'active') return isActiveCase(c)
  return true
}

function categoryBadges(c) {
  const badges = []
  const s = String(c.status || '')
  if (s.startsWith('승인')) badges.push('승인')
  if (!c.numeric_shortfall && s.startsWith('불승인')) badges.push('불승인')
  if (c.numeric_shortfall && s.startsWith('불승인')) badges.push('수치미달(불승인)')
  if (c.numeric_shortfall && s.startsWith('반려')) badges.push('수치미달(반려)')
  if (c.expanded_exam) badges.push('확대특진')
  if (!badges.length && isActiveCase(c)) badges.push('진행중')
  return badges.map(x => '<span class="category-pill">' + esc(x) + '</span>').join(' ')
}

function syncStatusOptions() {
  const box = $('statusOptionsBox')
  const current = new Set(getSelectedStatuses())
  const statuses = [...new Set(allCases.map(c => c.status).filter(Boolean))]
    .sort((a,b) => String(a).localeCompare(String(b), 'ko'))

  const signature = statuses.join('|')
  if (box.dataset.signature === signature) {
    updateStatusSummary()
    return
  }

  box.dataset.signature = signature
  box.innerHTML = statuses.map(status => {
    const checked = current.has(status) ? ' checked' : ''
    return '<label><input type="checkbox" class="status-check" value="' +
      esc(status) + '"' + checked + ' /> ' + esc(status) + '</label>'
  }).join('')

  document.querySelectorAll('.status-check').forEach(input => {
    input.addEventListener('change', () => {
      updateStatusSummary()
      render()
    })
  })

  updateStatusSummary()
}

function compareDateField(a, b, field, direction) {
  const av = a[field]
  const bv = b[field]

  if (!av && !bv) return 0
  if (!av) return 1
  if (!bv) return -1

  const cmp = String(av).localeCompare(String(bv))
  return direction === 'asc' ? cmp : -cmp
}

function updateSortIcons() {
  const filed = $('sortFiledIcon')
  const notice = $('sortNoticeIcon')
  if (filed) filed.textContent = sortField === 'filed_at' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'
  if (notice) notice.textContent = sortField === 'notice_at' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'
}

function cleanAgencyContact(v) {
  if (!v) return null
  const cleaned = String(v)
    .replace(/\s*\/.*$/, '')
    .replace(/\s*0505-[0-9-]+/g, '')
    .trim()
  return cleaned || null
}

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
