import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../services/api'
import App from './App'

vi.mock('../services/api', () => ({
  api: {
    listAllStudents: vi.fn(),
    listAllClasses: vi.fn(),
    listAllTeachers: vi.fn(),
    listStudents: vi.fn(),
    listStudentsWithAlumni: vi.fn(),
    listClasses: vi.fn(),
    listTeachers: vi.fn(),
    getClass: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    createStudent: vi.fn(),
    createAcademicRecord: vi.fn(),
    createAlumni: vi.fn(),
    getStudent: vi.fn(),
  },
}))

afterEach(() => {
  cleanup()
  localStorage.removeItem('hiradb.accountEmail')
})

async function signInToWorkspace(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(api.login).mockResolvedValue({ access_token: 'unused-by-this-api', token_type: 'bearer' })
  render(<App />)
  await user.type(screen.getByLabelText('Email address'), 'staff@example.com')
  await user.type(screen.getByLabelText('Password'), 'test-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('navigation', { name: 'Main navigation' })
  await user.click(screen.getByRole('button', { name: 'Overview' }))
}

describe('school workspace', () => {
  it('shows dashboard counts derived from API results', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([
      { id: 1, first_name: 'Amina', middle_name: null, last_name: 'Rahman', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: 2024 },
      { id: 2, first_name: 'Rafi', middle_name: null, last_name: 'Khan', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: 2025 },
    ])
    vi.mocked(api.listAllClasses).mockResolvedValue([{ id: 1, name: 'Class 4', description: null }])
    vi.mocked(api.listAllTeachers).mockResolvedValue([
      { id: 1, full_name: 'Sara Ali', email: 'sara@example.com' },
      { id: 2, full_name: 'Noor Islam', email: 'noor@example.com' },
      { id: 3, full_name: 'Imran Das', email: 'imran@example.com' },
    ])

    const user = userEvent.setup()
    await signInToWorkspace(user)

    expect(await screen.findByText('A clear view of your school.')).toBeTruthy()
    expect(screen.getByText('2', { selector: 'strong' })).toBeTruthy()
    expect(screen.getByText('1', { selector: 'strong' })).toBeTruthy()
    expect(screen.getByText('3', { selector: 'strong' })).toBeTruthy()
    expect(api.listAllStudents).toHaveBeenCalledOnce()
  })

  it('keeps available dashboard counts visible when one list endpoint fails', async () => {
    vi.mocked(api.listAllStudents).mockRejectedValue(new Error('Internal Server Error'))
    vi.mocked(api.listAllClasses).mockResolvedValue([{ id: 1, name: 'Class 4', description: null }])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])

    const user = userEvent.setup()
    await signInToWorkspace(user)

    expect((await screen.findByRole('alert')).textContent).toContain('student count: Internal Server Error')
    expect(screen.getByText('—', { selector: 'strong' })).toBeTruthy()
    expect(screen.getByText('1', { selector: 'strong' })).toBeTruthy()
    expect(screen.getByText('0', { selector: 'strong' })).toBeTruthy()
  })

  it('shows only sign-in and registration to unsigned visitors', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    const user = userEvent.setup()

    render(<App />)
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    expect(screen.queryByText('A clear view of your school.')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Create an account' }))

    expect(screen.getByRole('heading', { name: 'Create your account.' })).toBeTruthy()
    expect(screen.getByLabelText('Email address').getAttribute('type')).toBe('email')
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password')
  })

  it('signs the user in after registration and opens the overview', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.register).mockResolvedValue({ id: 8, email: 'new@example.com', is_active: true })
    vi.mocked(api.login).mockResolvedValue({ access_token: 'unused-by-this-api', token_type: 'bearer' })
    const user = userEvent.setup()

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    await user.type(screen.getByLabelText('Email address'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'secure-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('A clear view of your school.')).toBeTruthy()
    expect(api.register).toHaveBeenCalledWith({ email: 'new@example.com', password: 'secure-password' })
    expect(api.login).toHaveBeenCalledWith({ email: 'new@example.com', password: 'secure-password' })
    expect(localStorage.getItem('hiradb.accountEmail')).toBe('new@example.com')
    expect(screen.queryByRole('heading', { name: 'Your account' })).toBeNull()
  })

  it('shows account menu and clears the remembered sign-in on sign-out', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.login).mockResolvedValue({ access_token: 'unused-by-this-api', token_type: 'bearer' })
    const user = userEvent.setup()

    render(<App />)
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com')
    await user.type(screen.getByLabelText('Password'), 'valid-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('A clear view of your school.')).toBeTruthy()
    expect(api.login).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'valid-password' })
    expect(localStorage.getItem('hiradb.accountEmail')).toBe('admin@example.com')
    await user.click(screen.getByRole('button', { name: 'Account' }))
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Signed-in account profile' })).getAllByText('admin@example.com').length).toBe(2)
    await user.click(screen.getByRole('button', { name: 'Account menu for admin@example.com' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Good to see you.' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    expect(localStorage.getItem('hiradb.accountEmail')).toBeNull()
  })

  it('restores a remembered sign-in after the app is reopened', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.login).mockResolvedValue({ access_token: 'unused-by-this-api', token_type: 'bearer' })
    const user = userEvent.setup()

    const app = render(<App />)
    await user.type(screen.getByLabelText('Email address'), 'returning@example.com')
    await user.type(screen.getByLabelText('Password'), 'secure-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('navigation', { name: 'Main navigation' })
    app.unmount()
    render(<App />)

    expect(await screen.findByText('A clear view of your school.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Account menu for returning@example.com' })).toBeTruthy()
    expect(api.login).toHaveBeenCalledOnce()
  })

  it('does not show an account profile when sign-in fails', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.login).mockRejectedValue(new Error('Invalid credentials'))
    const user = userEvent.setup()

    render(<App />)
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Invalid credentials')
    expect(screen.queryByRole('heading', { name: 'Your account' })).toBeNull()
  })

  it('keeps keyboard focus in the student form and closes on Escape', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listStudents).mockResolvedValue([])
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Add student' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('First name'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a class roster from the card and defaults the roster to the current year', async () => {
    const schoolClass = { id: 8, name: 'Grade 4', description: 'Primary class' }
    const nextClass = { id: 9, name: 'Grade 5', description: 'Upper primary' }
    const student = {
      id: 41,
      first_name: 'Amina',
      middle_name: null,
      last_name: 'Rahman',
      father_name: null,
      mother_name: null,
      guardian_name: null,
      guardian_phone: null,
      address: null,
      admission_year: 2022,
    }
    const year = String(new Date().getFullYear())
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([schoolClass, nextClass])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listClasses).mockResolvedValue([schoolClass, nextClass])
    vi.mocked(api.getClass).mockImplementation(async (id) => id === 8 ? schoolClass : nextClass)
    vi.mocked(api.listStudents).mockResolvedValue([student])
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Classes' }))
    const classCard = await screen.findByRole('button', { name: 'View Grade 4 students' })
    expect(classCard.textContent).toContain(year)
    await user.click(classCard)

    expect(await screen.findByRole('heading', { name: 'Grade 4' })).toBeTruthy()
    const yearSelect = screen.getByLabelText('Filter by academic year') as HTMLSelectElement
    expect(yearSelect.value).toBe(year)
    expect(api.listStudents).toHaveBeenCalledWith({
      class_name: 'Grade 4',
      academic_year: year,
      skip: 0,
      limit: 25,
    })
    await user.click(screen.getByRole('button', { name: 'Grade 5' }))
    expect(await screen.findByRole('heading', { name: 'Grade 5' })).toBeTruthy()
    expect(api.getClass).toHaveBeenCalledWith(9)
  })

  it('searches the full class directory by name and description', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([
      { id: 8, name: 'Grade 4', description: 'Primary learners' },
      { id: 9, name: 'Grade 5', description: 'Upper primary' },
    ])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listStudents).mockResolvedValue([])
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Classes' }))
    await screen.findByRole('button', { name: 'View Grade 4 students' })
    await user.type(screen.getByRole('searchbox', { name: 'Search classes' }), 'upper')

    expect(await screen.findByRole('button', { name: 'View Grade 5 students' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'View Grade 4 students' })).toBeNull()
    expect(screen.getByText('1 class')).toBeTruthy()
  })

  it('searches the full teacher directory by name or email', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([
      { id: 3, full_name: 'Sara Ali', email: 'sara@example.com' },
      { id: 4, full_name: 'Noor Islam', email: 'noor@example.com' },
    ])
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Teachers' }))
    await screen.findByText('Sara Ali')
    await user.type(screen.getByRole('searchbox', { name: 'Search teachers' }), 'noor@example.com')

    expect(await screen.findByText('Noor Islam')).toBeTruthy()
    expect(screen.queryByText('Sara Ali')).toBeNull()
    expect(screen.getByText('1 teacher')).toBeTruthy()
  })

  it('applies student search to the backend and offers a clear-filters action', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([{ id: 8, name: 'Grade 4', description: null }])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listStudentsWithAlumni).mockResolvedValue([])
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Students' }))
    const search = await screen.findByRole('searchbox', { name: 'Search students' })
    await user.type(search, 'Amina')

    expect(await screen.findByText(/Search: “Amina”/)).toBeTruthy()
    await waitFor(() => {
      expect(api.listStudentsWithAlumni).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'Amina' }))
    })
    await user.selectOptions(screen.getByLabelText('Class'), 'Grade 4')
    await user.selectOptions(screen.getByLabelText('Academic year'), '2026')
    await user.click(screen.getByText('More filters'))
    await user.type(screen.getByLabelText('Guardian name'), 'Nadia')
    expect(await screen.findByRole('button', { name: 'Remove Guardian: Nadia filter' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Remove Guardian: Nadia filter' }))
    expect((screen.getByLabelText('Guardian name') as HTMLInputElement).value).toBe('')
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect((search as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
  })

  it('assigns a new student to a class and suggests the next roll for that class and year', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([{ id: 8, name: 'Class 7', description: null }])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listStudentsWithAlumni).mockResolvedValue([])
    vi.mocked(api.listStudents).mockResolvedValue([
      { id: 21, first_name: 'Nila', middle_name: null, last_name: 'Sen', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: 2020 },
      { id: 22, first_name: 'Omar', middle_name: null, last_name: 'Ali', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: 2020 },
    ])
    vi.mocked(api.getStudent)
      .mockResolvedValueOnce({
        id: 21, first_name: 'Nila', middle_name: null, last_name: 'Sen', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: 2020,
        academic_records: [{ id: 1, student_id: 21, academic_year: '2026', class_name: 'Class 7', roll_number: '1', section: null, status: 'active' }],
        alumni: null,
      })
      .mockResolvedValueOnce({
        id: 22, first_name: 'Omar', middle_name: null, last_name: 'Ali', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: 2020,
        academic_records: [{ id: 2, student_id: 22, academic_year: '2026', class_name: 'Class 7', roll_number: '9', section: null, status: 'active' }],
        alumni: null,
      })
    vi.mocked(api.createStudent).mockResolvedValue({
      id: 23, first_name: 'Pia', middle_name: null, last_name: 'Das', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: null,
    })
    vi.mocked(api.createAcademicRecord).mockResolvedValue({
      id: 3, student_id: 23, academic_year: '2026', class_name: 'Class 7', roll_number: '10', section: null, status: 'active',
    })
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Add student' }))
    const dialog = within(screen.getByRole('dialog'))
    const currentYear = new Date().getFullYear()
    expect(within(dialog.getByLabelText('Academic year')).getByRole('option', { name: String(currentYear) })).toBeTruthy()
    await user.type(dialog.getByLabelText('First name'), 'Pia')
    await user.type(dialog.getByLabelText('Last name'), 'Das')
    await user.selectOptions(dialog.getByLabelText('Class'), 'Class 7')
    await user.selectOptions(dialog.getByLabelText('Academic year'), '2026')

    expect(await dialog.findByDisplayValue('10')).toBeTruthy()
    await user.click(dialog.getByRole('button', { name: 'Create record' }))

    expect(api.createAcademicRecord).toHaveBeenCalledWith(23, {
      student_id: 23,
      academic_year: '2026',
      class_name: 'Class 7',
      roll_number: '10',
      section: null,
      status: 'active',
    })
  })

  it('previews and promotes students from class 3 to class 4 with assigned rolls and preserved history', async () => {
    const classes = [{ id: 3, name: '3', description: null }, { id: 4, name: '4', description: null }]
    const sourceStudent = {
      id: 30,
      first_name: 'Asha',
      middle_name: null,
      last_name: 'Roy',
      father_name: null,
      mother_name: null,
      guardian_name: null,
      guardian_phone: null,
      address: null,
      admission_year: 2020,
      academic_records: [{ id: 301, student_id: 30, academic_year: '2026', class_name: '3', roll_number: '7', section: 'A', status: 'active' }],
      alumni: null,
    }
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue(classes)
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listClasses).mockResolvedValue(classes)
    vi.mocked(api.listStudents).mockImplementation(async (filters = {}) => filters.class_name === '3' && filters.academic_year === '2026'
      ? [sourceStudent]
      : [])
    vi.mocked(api.getStudent).mockResolvedValue(sourceStudent)
    vi.mocked(api.createAcademicRecord).mockResolvedValue({
      id: 401,
      student_id: 30,
      academic_year: '2027',
      class_name: '4',
      roll_number: '1',
      section: null,
      status: 'active',
    })
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Classes' }))
    await user.click(await screen.findByRole('button', { name: /Promote students/ }))
    const dialog = within(screen.getByRole('dialog'))
    await user.selectOptions(dialog.getByLabelText('Current class'), '3')
    await user.selectOptions(dialog.getByLabelText('Next class'), '4')
    await user.selectOptions(dialog.getByLabelText('Current academic year'), '2026')
    await user.selectOptions(dialog.getByLabelText('Next academic year'), '2027')
    await user.click(dialog.getByRole('button', { name: 'Review students' }))

    expect(await dialog.findByText('Asha Roy')).toBeTruthy()
    expect(dialog.getByText('7')).toBeTruthy()
    const nextRoll = dialog.getByLabelText('Next roll number for Asha Roy') as HTMLInputElement
    expect(nextRoll.value).toBe('1')
    await user.clear(nextRoll)
    await user.type(nextRoll, '12')
    await user.click(dialog.getByRole('button', { name: 'Promote reviewed students' }))

    expect(api.createAcademicRecord).toHaveBeenCalledWith(30, {
      student_id: 30,
      class_name: '4',
      academic_year: '2027',
      roll_number: '12',
      section: null,
      status: 'active',
    })
    expect(api.getStudent).toHaveBeenCalledWith(30)
    expect(await screen.findByText(/1 new academic record added; previous class records are kept/)).toBeTruthy()
  })

  it('offers current student, alumni record, and all student views', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listStudents).mockResolvedValue([])
    vi.mocked(api.listStudentsWithAlumni).mockResolvedValue([
      {
        student: { id: 1, first_name: 'Current', middle_name: null, last_name: 'Learner', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: 2025 },
        alumni: null,
      },
      {
        student: { id: 2, first_name: 'Former', middle_name: null, last_name: 'Learner', father_name: null, mother_name: null, guardian_name: null, guardian_phone: null, address: null, admission_year: 2020 },
        alumni: { student_id: 2, passing_year: 2024, tag: 'Graduate', comment: null },
      },
    ])
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Students' }))
    expect(await screen.findByText('Current Learner')).toBeTruthy()
    expect(screen.queryByText('Former Learner')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Alumni record' }))
    expect(await screen.findByText('Former Learner')).toBeTruthy()
    expect(screen.queryByText('Current Learner')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'All student' }))
    expect(await screen.findByText('All student')).toBeTruthy()
    expect(api.listStudents).toHaveBeenCalled()
  })

  it('creates a student with full student details and then attaches alumni details', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listStudentsWithAlumni).mockResolvedValue([])
    vi.mocked(api.createStudent).mockResolvedValue({
      id: 45,
      first_name: 'Nadia',
      middle_name: 'A',
      last_name: 'Rahman',
      father_name: 'Karim Rahman',
      mother_name: 'Saira Rahman',
      guardian_name: 'Karim Rahman',
      guardian_phone: '5550100',
      address: '12 School Road',
      admission_year: 2005,
    })
    vi.mocked(api.createAlumni).mockResolvedValue({
      student_id: 45,
      passing_year: 2017,
      tag: 'Graduate',
      comment: 'Science program',
    })
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Add alumni' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('heading', { name: 'Add alumni student' })).toBeTruthy()
    await user.type(dialog.getByLabelText('First name'), 'Nadia')
    await user.type(dialog.getByLabelText('Middle name'), 'A')
    await user.type(dialog.getByLabelText('Last name'), 'Rahman')
    await user.selectOptions(dialog.getByLabelText('Admission year'), '2005')
    await user.type(dialog.getByLabelText("Father's name"), 'Karim Rahman')
    await user.type(dialog.getByLabelText("Mother's name"), 'Saira Rahman')
    await user.type(dialog.getByLabelText('Guardian name'), 'Karim Rahman')
    await user.type(dialog.getByLabelText('Guardian phone'), '5550100')
    await user.type(dialog.getByLabelText('Address'), '12 School Road')
    await user.selectOptions(dialog.getByLabelText('Passing year'), '2017')
    await user.type(dialog.getByLabelText('Alumni tag'), 'Graduate')
    await user.type(dialog.getByLabelText('Alumni comment'), 'Science program')
    await user.click(screen.getByRole('button', { name: 'Create student and alumni' }))

    expect(api.createStudent).toHaveBeenCalledWith({
      first_name: 'Nadia',
      middle_name: 'A',
      last_name: 'Rahman',
      father_name: 'Karim Rahman',
      mother_name: 'Saira Rahman',
      guardian_name: 'Karim Rahman',
      guardian_phone: '5550100',
      address: '12 School Road',
      admission_year: 2005,
    })
    expect(api.createAlumni).toHaveBeenCalledWith(45, {
      student_id: 45,
      passing_year: 2017,
      tag: 'Graduate',
      comment: 'Science program',
    })
  })

  it('retries alumni creation without duplicating a student after a partial failure', async () => {
    vi.mocked(api.listAllStudents).mockResolvedValue([])
    vi.mocked(api.listAllClasses).mockResolvedValue([])
    vi.mocked(api.listAllTeachers).mockResolvedValue([])
    vi.mocked(api.listStudentsWithAlumni).mockResolvedValue([])
    vi.mocked(api.createStudent).mockResolvedValue({
      id: 52,
      first_name: 'Iman',
      middle_name: null,
      last_name: 'Ali',
      father_name: null,
      mother_name: null,
      guardian_name: null,
      guardian_phone: null,
      address: null,
      admission_year: null,
    })
    vi.mocked(api.createAlumni)
      .mockRejectedValueOnce(new Error('Alumni service unavailable'))
      .mockResolvedValueOnce({ student_id: 52, passing_year: null, tag: null, comment: null })
    const user = userEvent.setup()

    await signInToWorkspace(user)
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Add alumni' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('First name'), 'Iman')
    await user.type(dialog.getByLabelText('Last name'), 'Ali')
    await user.click(dialog.getByRole('button', { name: 'Create student and alumni' }))

    expect((await dialog.findByRole('alert')).textContent).toContain('Student record #52 was created')
    expect(dialog.getByRole('button', { name: 'Retry alumni record' })).toBeTruthy()
    await user.click(dialog.getByRole('button', { name: 'Retry alumni record' }))

    expect(api.createStudent).toHaveBeenCalledOnce()
    expect(api.createAlumni).toHaveBeenCalledTimes(2)
    expect(api.createAlumni).toHaveBeenLastCalledWith(52, expect.objectContaining({ student_id: 52 }))
  })
})
