import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  api,
  type AcademicRecord,
  type SchoolClass,
  type StudentDetail,
  type Teacher,
} from '../services/api'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { fullName } from '../utils/student'
import { ErrorState } from '../components/feedback'
import { YearSelect } from '../components/YearSelect'
import { AccountPage } from './pages/AccountPage'
import { PromotionModal } from './pages/PromotionModal'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { WorkspaceSidebar } from '../components/WorkspaceNavigation'
import { AuthScreen } from './pages/AuthPage'
import { ClassDetailPage, ClassList } from './pages/ClassesPage'
import { Dashboard } from './pages/OverviewPage'
import { StudentDetailPage, StudentList } from './pages/StudentsPage'
import { TeacherDetailPage, TeacherList } from './pages/TeachersPage'
import type { Area } from './types'

type FormKind = 'student' | 'student-alumni' | 'academic' | 'alumni' | 'class' | 'teacher'
type Toast = { message: string; tone: 'success' | 'error' } | null
type FormValues = Record<string, string>
type FormField = {
  name: string
  label: string
  type?: string
  required?: boolean
  multiline?: boolean
}

const accountEmailStorageKey = 'hiradb.accountEmail'

class AlumniAttachError extends Error {
  studentId: number

  constructor(studentId: number, cause: unknown) {
    super(cause instanceof Error ? cause.message : 'The alumni record could not be saved.')
    this.name = 'AlumniAttachError'
    this.studentId = studentId
  }
}

class StudentAcademicAttachError extends Error {
  studentId: number

  constructor(studentId: number, cause: unknown) {
    super(cause instanceof Error ? cause.message : 'The academic record could not be saved.')
    this.name = 'StudentAcademicAttachError'
    this.studentId = studentId
  }
}

const fieldsByKind: Record<FormKind, FormField[]> = {
  student: [
    { name: 'first_name', label: 'First name', required: true },
    { name: 'middle_name', label: 'Middle name' },
    { name: 'last_name', label: 'Last name', required: true },
    { name: 'admission_year', label: 'Admission year', type: 'number' },
    { name: 'father_name', label: "Father's name" },
    { name: 'mother_name', label: "Mother's name" },
    { name: 'guardian_name', label: 'Guardian name' },
    { name: 'guardian_phone', label: 'Guardian phone', type: 'tel' },
    { name: 'address', label: 'Address', multiline: true },
  ],
  'student-alumni': [
    { name: 'first_name', label: 'First name', required: true },
    { name: 'middle_name', label: 'Middle name' },
    { name: 'last_name', label: 'Last name', required: true },
    { name: 'admission_year', label: 'Admission year', type: 'number' },
    { name: 'father_name', label: "Father's name" },
    { name: 'mother_name', label: "Mother's name" },
    { name: 'guardian_name', label: 'Guardian name' },
    { name: 'guardian_phone', label: 'Guardian phone', type: 'tel' },
    { name: 'address', label: 'Address', multiline: true },
    { name: 'passing_year', label: 'Passing year', type: 'number' },
    { name: 'tag', label: 'Alumni tag' },
    { name: 'comment', label: 'Alumni comment', multiline: true },
  ],
  class: [
    { name: 'name', label: 'Class name', required: true },
    { name: 'description', label: 'Description', multiline: true },
  ],
  teacher: [
    { name: 'full_name', label: 'Full name', required: true },
    { name: 'email', label: 'Email address', type: 'email', required: true },
  ],
  academic: [
    { name: 'academic_year', label: 'Academic year', required: true },
    { name: 'class_name', label: 'Class name', required: true },
    { name: 'roll_number', label: 'Roll number' },
    { name: 'section', label: 'Section' },
    { name: 'status', label: 'Status', required: true },
  ],
  alumni: [
    { name: 'passing_year', label: 'Passing year', type: 'number' },
    { name: 'tag', label: 'Tag' },
    { name: 'comment', label: 'Comment', multiline: true },
  ],
}

function ModalForm({
  kind,
  mode,
  initial,
  onClose,
  onSave,
  classes,
  classesLoading,
  classesError,
  onLoadClasses,
}: {
  kind: FormKind
  mode: 'create' | 'edit'
  initial?: Record<string, unknown>
  onClose: () => void
  onSave: (values: FormValues, existingStudentId?: number) => Promise<void>
  classes: SchoolClass[]
  classesLoading: boolean
  classesError: string
  onLoadClasses: () => void
}) {
  const fields = fieldsByKind[kind]
  const [createdStudentId, setCreatedStudentId] = useState<number | undefined>()
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(fields.map((field) => {
    const value = initial?.[field.name]
    const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
    return [field.name, text || (field.name === 'status' ? 'active' : '')]
  })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rollLoading, setRollLoading] = useState(false)
  const [rollError, setRollError] = useState('')
  const rollEdited = useRef(false)
  const dialogRef = useDialogFocus(busy, onClose)

  useEffect(() => {
    if (kind !== 'student' || mode !== 'create' || !values.class_name || !values.academic_year) return
    let active = true
    async function suggestNextRoll() {
      try {
        let skip = 0
        let next = 1
        let manualRollRequired = false
        let page: StudentDetail[]
        do {
          const students = await api.listStudents({
            class_name: values.class_name,
            academic_year: values.academic_year,
            skip,
            limit: 100,
          })
          page = await Promise.all(students.map((student) => api.getStudent(student.id)))
          for (const student of page) {
            for (const record of student.academic_records) {
              if (record.class_name !== values.class_name || record.academic_year !== values.academic_year) continue
              const roll = record.roll_number?.trim()
              if (!roll) continue
              if (!/^\d+$/.test(roll) || !Number.isSafeInteger(Number(roll))) {
                manualRollRequired = true
                continue
              }
              next = Math.max(next, Number(roll) + 1)
            }
          }
          skip += students.length
        } while (page.length === 100)
        if (active && !rollEdited.current) {
          if (manualRollRequired) {
            setRollError('Existing roll numbers are not all numeric. Enter the next roll number manually.')
          } else {
            setValues((current) => ({ ...current, roll_number: String(next) }))
          }
        }
      } catch (reason) {
        if (active) setRollError(reason instanceof Error ? reason.message : 'Could not suggest the next roll number.')
      } finally {
        if (active) setRollLoading(false)
      }
    }
    const timer = window.setTimeout(() => void suggestNextRoll(), 300)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [kind, mode, values.academic_year, values.class_name])

  const title = kind === 'student-alumni' ? 'Add alumni student' : `${mode === 'create' ? 'Add' : 'Edit'} ${kind === 'academic' ? 'academic record' : kind === 'alumni' ? 'alumni record' : kind}`
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(values, createdStudentId)
      onClose()
    } catch (reason) {
      if (reason instanceof AlumniAttachError) {
        setCreatedStudentId(reason.studentId)
        setError(`Student record #${reason.studentId} was created, but its alumni record was not. Retry to add the alumni details without creating another student. (${reason.message})`)
        return
      }
      if (reason instanceof StudentAcademicAttachError) {
        setCreatedStudentId(reason.studentId)
        setError(`Student record #${reason.studentId} was created, but its class record was not. Retry to add the class and roll number without creating another student. (${reason.message})`)
        return
      }
      setError(reason instanceof Error ? reason.message : 'Could not save this record.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <section ref={dialogRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head"><div><span className="eyebrow">{mode === 'create' ? 'New record' : 'Update record'}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          {kind === 'student-alumni' ? (
            <div className="form-section-stack">
              <fieldset className="form-section"><legend>Student details</legend><div className="modal-fields">{fields.slice(0, 9).map((field) => <FormInput key={field.name} field={field} values={values} onChange={setValues} />)}</div></fieldset>
              <fieldset className="form-section"><legend>Alumni record</legend><div className="modal-fields">{fields.slice(9).map((field) => <FormInput key={field.name} field={field} values={values} onChange={setValues} />)}</div></fieldset>
            </div>
          ) : kind === 'student' && mode === 'create' ? (
            <div className="form-section-stack">
              <fieldset className="form-section"><legend>Student details</legend><div className="modal-fields">{fields.map((field) => <FormInput key={field.name} field={field} values={values} onChange={setValues} />)}</div></fieldset>
              <fieldset className="form-section">
                <legend>Class assignment (optional)</legend>
                <div className="modal-fields">
                  <label>Class<select value={values.class_name ?? ''} disabled={classesLoading} onChange={(event) => {
                    rollEdited.current = false
                    setRollError('')
                    setRollLoading(Boolean(event.target.value && values.academic_year))
                    setValues({ ...values, class_name: event.target.value, roll_number: '' })
                  }}><option value="">Add student without a class</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.name}>{schoolClass.name}</option>)}</select></label>
                  <label>Academic year<YearSelect value={values.academic_year ?? ''} required={Boolean(values.class_name)} disabled={!values.class_name} onChange={(value) => {
                    rollEdited.current = false
                    setRollError('')
                    setRollLoading(Boolean(values.class_name && value))
                    setValues({ ...values, academic_year: value, roll_number: '' })
                  }} /></label>
                  <label>Roll number<input value={values.roll_number ?? ''} required={Boolean(values.class_name)} disabled={!values.class_name || !values.academic_year} inputMode="numeric" onChange={(event) => {
                    rollEdited.current = true
                    setValues({ ...values, roll_number: event.target.value })
                  }} /></label>
                  {rollLoading && <p className="text-xs text-[#78847f]" role="status">Finding the next roll number…</p>}
                  {rollError && <ErrorState message={`Could not suggest a roll number: ${rollError}`} />}
                  {classesError && <ErrorState message={`Could not load classes: ${classesError}`} onRetry={onLoadClasses} />}
                  {!classesLoading && !classesError && classes.length === 0 && <p className="text-xs text-[#78847f]">No classes are available yet. Create a class first, or save this student without a class.</p>}
                </div>
              </fieldset>
            </div>
          ) : <div className="modal-fields">{fields.map((field) => <FormInput key={field.name} field={field} values={values} onChange={setValues} />)}</div>}
          {error && <ErrorState message={error} />}
          <div className="modal-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || rollLoading}>{busy ? 'Saving…' : rollLoading ? 'Finding roll number…' : createdStudentId !== undefined ? `Retry ${kind === 'student' ? 'class assignment' : 'alumni record'}` : kind === 'student-alumni' ? 'Create student and alumni' : mode === 'create' ? 'Create record' : 'Save changes'}</button></div>
        </form>
      </section>
    </div>
  )
}

function FormInput({
  field,
  values,
  onChange,
}: {
  field: FormField
  values: FormValues
  onChange: (values: FormValues) => void
}) {
  if (field.name === 'academic_year' || field.name === 'admission_year' || field.name === 'passing_year') {
    return (
      <label>{field.label}
        <YearSelect
          value={values[field.name] ?? ''}
          required={field.required}
          onChange={(value) => onChange({ ...values, [field.name]: value })}
        />
      </label>
    )
  }
  return (
    <label>{field.label}{field.multiline
      ? <textarea required={field.required} rows={3} value={values[field.name] ?? ''} onChange={(event) => onChange({ ...values, [field.name]: event.target.value })} />
      : <input type={field.type ?? 'text'} required={field.required} value={values[field.name] ?? ''} onChange={(event) => onChange({ ...values, [field.name]: event.target.value })} />}
    </label>
  )
}

function initialValues(item?: object): Record<string, unknown> | undefined {
  return item ? { ...(item as Record<string, unknown>) } : undefined
}

export default function App() {
  const [area, setArea] = useState<Area>('dashboard')
  const [studentId, setStudentId] = useState<number | null>(null)
  const [classId, setClassId] = useState<number | null>(null)
  const [teacherId, setTeacherId] = useState<number | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(() => localStorage.getItem(accountEmailStorageKey))
  const [accountOpen, setAccountOpen] = useState(false)
  const [modal, setModal] = useState<{ kind: FormKind; mode: 'create' | 'edit'; item?: Record<string, unknown>; studentId?: number } | null>(null)
  const [promotionOpen, setPromotionOpen] = useState(false)
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [classOptionsLoading, setClassOptionsLoading] = useState(false)
  const [classOptionsError, setClassOptionsError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<Toast>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!promotionOpen) return
    void api.listAllClasses().then(setClasses).catch((reason: unknown) => {
      setToast({ message: reason instanceof Error ? reason.message : 'Could not load classes for promotion.', tone: 'error' })
    })
  }, [promotionOpen])

  const loadClassOptions = useCallback(async () => {
    setClassOptionsLoading(true)
    setClassOptionsError('')
    try {
      setClasses(await api.listAllClasses())
    } catch (reason) {
      setClassOptionsError(reason instanceof Error ? reason.message : 'Could not load classes.')
    } finally {
      setClassOptionsLoading(false)
    }
  }, [])

  const navigate = useCallback((next: Area) => {
    setArea(next)
    setStudentId(null)
    setClassId(null)
    setTeacherId(null)
    setAuthMode(null)
    setAccountOpen(false)
  }, [])

  function openAccount() {
    if (authMode) {
      setAuthMode(null)
      return
    }
    setStudentId(null)
    setClassId(null)
    setTeacherId(null)
    setAuthMode(null)
    if (signedInEmail) setAccountOpen(true)
    else setAuthMode('login')
  }

  function signOut() {
    localStorage.removeItem(accountEmailStorageKey)
    setSignedInEmail(null)
    setAuthMode('login')
    setAccountOpen(false)
    setToast({ message: 'You have signed out of this browser session.', tone: 'success' })
  }

  function showError(reason: unknown): never {
    const message = reason instanceof Error ? reason.message : 'The request could not be completed.'
    setToast({ message, tone: 'error' })
    throw reason instanceof Error ? reason : new Error(message)
  }

  function openForm(kind: FormKind, mode: 'create' | 'edit', item?: object, selectedStudentId?: number) {
    if (kind === 'student' && mode === 'create') void loadClassOptions()
    setModal({ kind, mode, item: initialValues(item), studentId: selectedStudentId })
  }

  const refresh = () => setRefreshKey((key) => key + 1)

  async function saveForm(values: FormValues, existingStudentId?: number) {
    if (!modal) return
    const { kind, mode, item, studentId: selectedStudentId } = modal
    try {
      if (kind === 'student-alumni') {
        if (mode !== 'create') throw new Error('Alumni students can only be created from this form.')
        const student = existingStudentId === undefined
          ? await api.createStudent({
            first_name: values.first_name.trim(),
            middle_name: values.middle_name.trim() || null,
            last_name: values.last_name.trim(),
            father_name: values.father_name.trim() || null,
            mother_name: values.mother_name.trim() || null,
            guardian_name: values.guardian_name.trim() || null,
            guardian_phone: values.guardian_phone.trim() || null,
            address: values.address.trim() || null,
            admission_year: values.admission_year ? Number(values.admission_year) : null,
          })
          : { id: existingStudentId }
        try {
          await api.createAlumni(student.id, {
            student_id: student.id,
            passing_year: values.passing_year ? Number(values.passing_year) : null,
            tag: values.tag.trim() || null,
            comment: values.comment.trim() || null,
          })
        } catch (reason) {
          throw new AlumniAttachError(student.id, reason)
        }
        setStudentId(student.id)
      } else if (kind === 'student') {
        const hasClass = Boolean(values.class_name?.trim())
        const hasAcademicYear = Boolean(values.academic_year?.trim())
        if (hasClass !== hasAcademicYear) throw new Error('Choose both a class and academic year, or leave both blank.')
        if (existingStudentId !== undefined && !hasClass) throw new Error('This student was already created. Choose a class and academic year to finish the class assignment.')
        const body = {
          first_name: values.first_name.trim(),
          middle_name: values.middle_name.trim() || null,
          last_name: values.last_name.trim(),
          father_name: values.father_name.trim() || null,
          mother_name: values.mother_name.trim() || null,
          guardian_name: values.guardian_name.trim() || null,
          guardian_phone: values.guardian_phone.trim() || null,
          address: values.address.trim() || null,
          admission_year: values.admission_year ? Number(values.admission_year) : null,
        }
        if (mode === 'create') {
          const student = existingStudentId === undefined ? await api.createStudent(body) : { id: existingStudentId }
          if (hasClass && hasAcademicYear) {
            try {
              await api.createAcademicRecord(student.id, {
                student_id: student.id,
                class_name: values.class_name.trim(),
                academic_year: values.academic_year.trim(),
                roll_number: values.roll_number.trim() || null,
                section: null,
                status: 'active',
              })
            } catch (reason) {
              throw new StudentAcademicAttachError(student.id, reason)
            }
          }
        } else await api.updateStudent(Number(item?.id), body)
      } else if (kind === 'class') {
        const body = { name: values.name.trim(), description: values.description.trim() || null }
        if (mode === 'create') await api.createClass(body)
        else await api.updateClass(Number(item?.id), body)
      } else if (kind === 'teacher') {
        const body = { full_name: values.full_name.trim(), email: values.email.trim() }
        if (mode === 'create') await api.createTeacher(body)
        else await api.updateTeacher(Number(item?.id), body)
      } else if (kind === 'academic') {
        const body = {
          academic_year: values.academic_year.trim(),
          class_name: values.class_name.trim(),
          roll_number: values.roll_number.trim() || null,
          section: values.section.trim() || null,
          status: values.status.trim(),
        }
        if (mode === 'create') {
          if (selectedStudentId === undefined) throw new Error('A student is required for an academic record.')
          await api.createAcademicRecord(selectedStudentId, { ...body, student_id: selectedStudentId })
        }
        else await api.updateAcademicRecord(Number(item?.id), body)
      } else {
        if (selectedStudentId === undefined) throw new Error('A student is required for an alumni record.')
        const body = {
          passing_year: values.passing_year ? Number(values.passing_year) : null,
          tag: values.tag.trim() || null,
          comment: values.comment.trim() || null,
        }
        if (mode === 'create') await api.createAlumni(selectedStudentId, { ...body, student_id: selectedStudentId })
        else await api.updateAlumni(selectedStudentId, body)
      }
      const label = kind === 'student-alumni' ? 'Student and alumni record' : kind === 'academic' ? 'Academic record' : kind === 'alumni' ? 'Alumni record' : kind[0].toUpperCase() + kind.slice(1)
      setToast({ message: `${label} ${mode === 'create' ? 'created' : 'updated'} successfully.`, tone: 'success' })
      refresh()
    } catch (reason) {
      showError(reason)
    }
  }

  async function deleteItem(kind: 'student' | 'class' | 'teacher' | 'academic', item: StudentDetail | SchoolClass | Teacher | AcademicRecord) {
    const label = kind === 'student' ? fullName(item as StudentDetail) : kind === 'academic' ? `the ${((item as AcademicRecord).class_name)} academic record` : kind === 'class' ? (item as SchoolClass).name : (item as Teacher).full_name
    if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) return
    try {
      if (kind === 'student') await api.deleteStudent(item.id)
      else if (kind === 'class') await api.deleteClass(item.id)
      else if (kind === 'teacher') await api.deleteTeacher(item.id)
      else await api.deleteAcademicRecord(item.id)
      setToast({ message: `${kind === 'academic' ? 'Academic record' : kind[0].toUpperCase() + kind.slice(1)} deleted.`, tone: 'success' })
      if (kind === 'student') { setStudentId(null); setArea('students') }
      if (kind === 'class') { setClassId(null); setArea('classes') }
      if (kind === 'teacher') { setTeacherId(null); setArea('teachers') }
      refresh()
    } catch (reason) {
      setToast({ message: reason instanceof Error ? reason.message : 'Could not delete the record.', tone: 'error' })
    }
  }

  if (!signedInEmail) {
    return (
      <div className="auth-landing">
        <AuthScreen
          mode={authMode ?? 'login'}
          onModeChange={setAuthMode}
          onSignIn={(email) => {
            localStorage.setItem(accountEmailStorageKey, email)
            setSignedInEmail(email)
            setAuthMode(null)
            setAccountOpen(false)
            setArea('dashboard')
            setToast({ message: authMode === 'register' ? 'Account created. You are signed in.' : 'Sign-in successful.', tone: 'success' })
          }}
          onBack={() => setAuthMode('login')}
        />
        {toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}><span aria-hidden="true">{toast.tone === 'success' ? '✓' : '!'}</span>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>}
      </div>
    )
  }

  return (
    <div className="app-shell flex min-h-screen">
      <WorkspaceSidebar
        area={area}
        hasSubpage={studentId !== null || classId !== null || teacherId !== null}
        authMode={authMode}
        accountOpen={accountOpen}
        onNavigate={navigate}
        onAccount={openAccount}
      />
      <div className="main-column ml-[248px] min-h-screen w-[calc(100%-248px)] max-[760px]:ml-0 max-[760px]:w-[calc(100%-66px)] max-[520px]:w-[calc(100%-55px)]">
        <WorkspaceHeader
          area={area}
          authMode={authMode}
          accountEmail={signedInEmail}
          breadcrumb={accountOpen ? 'Account' : studentId !== null ? 'Student profile' : classId !== null ? 'Class details' : teacherId !== null ? 'Teacher profile' : null}
          onAccountClick={openAccount}
          onSignOut={signOut}
        />
        <main className="main-content mx-auto min-h-[calc(100vh-67px)] w-full max-w-[1414px] px-[42px] pt-[43px] pb-[25px] max-[1100px]:px-[27px] max-[760px]:min-h-[calc(100vh-59px)] max-[760px]:px-[17px] max-[760px]:pt-[29px] max-[760px]:pb-[21px] max-[520px]:px-3 max-[520px]:pt-6 max-[520px]:pb-[18px]">
          {authMode ? <AuthScreen
            mode={authMode}
            onModeChange={setAuthMode}
            onSignIn={(email) => {
              localStorage.setItem(accountEmailStorageKey, email)
              setSignedInEmail(email)
              setAuthMode(null)
              setAccountOpen(false)
              setArea('dashboard')
              setToast({ message: 'Sign-in successful.', tone: 'success' })
            }}
            onBack={() => setAuthMode(null)}
          /> : accountOpen && signedInEmail ? <AccountPage email={signedInEmail} onSignOut={signOut} /> :
            studentId !== null ? <StudentDetailPage
              studentId={studentId}
              onBack={() => setStudentId(null)}
              onEdit={(item) => openForm('student', 'edit', item)}
              onDelete={(item) => void deleteItem('student', item)}
              onAddRecord={(id) => openForm('academic', 'create', undefined, id)}
              onEditRecord={(item) => openForm('academic', 'edit', item)}
              onDeleteRecord={(item) => void deleteItem('academic', item)}
              onAddAlumni={(id) => openForm('alumni', 'create', undefined, id)}
              onEditAlumni={(item) => openForm('alumni', 'edit', item, item.student_id)}
              refreshKey={refreshKey}
            /> : classId !== null ? <ClassDetailPage
              classId={classId}
              onBack={() => setClassId(null)}
              onSelectClass={(item) => setClassId(item.id)}
              onEdit={(item) => openForm('class', 'edit', item)}
              onDelete={(item) => void deleteItem('class', item)}
              refreshKey={refreshKey}
            /> : teacherId !== null ? <TeacherDetailPage
              teacherId={teacherId}
              onBack={() => setTeacherId(null)}
              onEdit={(item) => openForm('teacher', 'edit', item)}
              onDelete={(item) => void deleteItem('teacher', item)}
              refreshKey={refreshKey}
            /> : area === 'dashboard' ? <Dashboard onNavigate={navigate} refreshKey={refreshKey} /> :
              area === 'students' ? <StudentList onOpen={(item) => setStudentId(item.id)} onCreate={() => openForm('student', 'create')} onCreateAlumni={() => openForm('student-alumni', 'create')} refreshKey={refreshKey} /> :
                area === 'classes' ? <ClassList onOpen={(item) => setClassId(item.id)} onCreate={() => openForm('class', 'create')} onPromote={() => setPromotionOpen(true)} refreshKey={refreshKey} /> :
                  <TeacherList onOpen={(item) => setTeacherId(item.id)} onCreate={() => openForm('teacher', 'create')} refreshKey={refreshKey} />}
          <footer className="app-footer"><span>hiraDB <i>·</i> School records, thoughtfully organized.</span><span>Connected to your configured API</span></footer>
        </main>
      </div>
      {modal && <ModalForm key={`${modal.kind}-${modal.mode}-${modal.item?.id ?? 'new'}`} kind={modal.kind} mode={modal.mode} initial={modal.item} onClose={() => setModal(null)} onSave={saveForm} classes={classes} classesLoading={modal.kind === 'student' && modal.mode === 'create' && classOptionsLoading} classesError={classOptionsError} onLoadClasses={() => void loadClassOptions()} />}
      {promotionOpen && <PromotionModal
        classes={classes}
        onClose={() => setPromotionOpen(false)}
        onComplete={(count) => {
          setToast({ message: `Promotion complete. ${count} new academic record${count === 1 ? '' : 's'} added; previous class records are kept.`, tone: 'success' })
          refresh()
          setPromotionOpen(false)
        }}
      />}
      {toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}><span aria-hidden="true">{toast.tone === 'success' ? '✓' : '!'}</span>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>}
    </div>
  )
}
