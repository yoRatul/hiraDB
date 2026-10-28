export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
).replace(/\/+$/, '')
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '')

export interface Student {
  id: number
  first_name: string
  middle_name: string | null
  last_name: string
  father_name: string | null
  mother_name: string | null
  guardian_name: string | null
  guardian_phone: string | null
  address: string | null
  admission_year: number | null
}

export interface AcademicRecord {
  id: number
  student_id: number
  academic_year: string
  class_name: string
  roll_number: string | null
  section: string | null
  status: string
}

export interface AlumniRecord {
  student_id: number
  passing_year: number | null
  tag: string | null
  comment: string | null
}

export interface StudentDetail extends Student {
  academic_records: AcademicRecord[]
  alumni: AlumniRecord | null
}

export interface StudentWithAlumni {
  student: Student
  alumni: AlumniRecord | null
}

export interface StudentCreate {
  first_name: string
  middle_name?: string | null
  last_name: string
  father_name?: string | null
  mother_name?: string | null
  guardian_name?: string | null
  guardian_phone?: string | null
  address?: string | null
  admission_year?: number | null
}

export interface StudentUpdate {
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  father_name?: string | null
  mother_name?: string | null
  guardian_name?: string | null
  guardian_phone?: string | null
  address?: string | null
  admission_year?: number | null
}

export interface AcademicRecordCreate {
  academic_year: string
  class_name: string
  roll_number?: string | null
  section?: string | null
  status?: string
  student_id: number
}

export interface AcademicRecordUpdate {
  academic_year?: string | null
  class_name?: string | null
  roll_number?: string | null
  section?: string | null
  status?: string | null
}

export interface AlumniCreate {
  passing_year?: number | null
  tag?: string | null
  comment?: string | null
  student_id: number
}

export interface AlumniUpdate {
  passing_year?: number | null
  tag?: string | null
  comment?: string | null
}

export interface Teacher {
  id: number
  full_name: string
  email: string
}

export interface TeacherCreate {
  full_name: string
  email: string
}

export interface TeacherUpdate {
  full_name?: string | null
  email?: string | null
}

export interface SchoolClass {
  id: number
  name: string
  description: string | null
}

export interface ClassCreate {
  name: string
  description?: string | null
}

export interface ClassUpdate {
  name?: string | null
  description?: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface UserCreate extends LoginRequest {}

export interface UserRead {
  id: number
  email: string
  is_active: boolean
}

export interface Token {
  access_token: string
  token_type: string
}

export interface StudentFilters {
  skip?: number
  limit?: number
  student_id?: number
  alumni_id?: number
  academic_year?: string
  class_name?: string
  guardian_name?: string
  guardian_phone?: string
  query?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function messageFromPayload(payload: unknown): string {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return ''

  const detail = (payload as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item)
        const error = item as { loc?: unknown[]; msg?: unknown }
        const location = Array.isArray(error.loc) ? error.loc.slice(1).join('.') : ''
        return [location, typeof error.msg === 'string' ? error.msg : 'Invalid value']
          .filter(Boolean)
          .join(': ')
      })
      .join(' · ')
  }
  return ''
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  baseUrl = API_BASE_URL,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(`Could not connect to the API at ${API_BASE_URL}. Check that the backend is running.`, 0)
  }

  if (response.status === 204) {
    if (!response.ok) throw new ApiError('The request could not be completed.', response.status)
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  let payload: unknown
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json()
    } catch {
      throw new ApiError('The API returned an unreadable JSON response.', response.status)
    }
  } else {
    payload = await response.text()
  }

  if (!response.ok) {
    const detail = messageFromPayload(payload)
    throw new ApiError(detail || `Request failed with status ${response.status}.`, response.status)
  }

  return payload as T
}

function queryString(params: object): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).trim() !== '') query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

async function listAll<T>(listPage: (skip: number, limit: number) => Promise<T[]>): Promise<T[]> {
  const pageSize = 100
  const results: T[] = []
  for (let skip = 0; ; skip += pageSize) {
    const page = await listPage(skip, pageSize)
    results.push(...page)
    if (page.length < pageSize) return results
  }
}

export const api = {
  register: (body: UserCreate) =>
    request<UserRead>('/auth/register', { method: 'POST', body }),
  login: (body: LoginRequest) =>
    request<Token>('/auth/login', { method: 'POST', body }),
  listStudents: (filters: StudentFilters = {}) =>
    request<Student[]>(`/students/${queryString(filters)}`),
  listAllStudents: () => listAll((skip, limit) => api.listStudents({ skip, limit })),
  listStudentsWithAlumni: async (
    filters: Omit<StudentFilters, 'skip' | 'limit'> = {},
  ): Promise<StudentWithAlumni[]> => {
    const students = await listAll((skip, limit) => api.listStudents({ ...filters, skip, limit }))
    const results: StudentWithAlumni[] = []
    const batchSize = 20
    for (let index = 0; index < students.length; index += batchSize) {
      const batch = students.slice(index, index + batchSize)
      const alumniRecords = await Promise.all(batch.map((student) => api.getAlumni(student.id)))
      results.push(...batch.map((student, position) => ({
        student,
        alumni: alumniRecords[position],
      })))
    }
    return results
  },
  searchStudents: (q: string) =>
    request<Student[]>(`/students/search${queryString({ q })}`),
  getStudent: (id: number) => request<StudentDetail>(`/students/${id}`),
  createStudent: (body: StudentCreate) =>
    request<Student>('/students/', { method: 'POST', body }),
  updateStudent: (id: number, body: StudentUpdate) =>
    request<Student>(`/students/${id}`, { method: 'PATCH', body }),
  deleteStudent: (id: number) =>
    request<void>(`/students/${id}`, { method: 'DELETE' }),
  listAcademicHistory: (studentId: number) =>
    request<AcademicRecord[]>(`/students/${studentId}/academic-history`),
  createAcademicRecord: (studentId: number, body: AcademicRecordCreate) =>
    request<AcademicRecord>(`/students/${studentId}/academic-history`, { method: 'POST', body }),
  updateAcademicRecord: (id: number, body: AcademicRecordUpdate) =>
    request<AcademicRecord>(`/students/academic-history/${id}`, { method: 'PATCH', body }),
  deleteAcademicRecord: (id: number) =>
    request<void>(`/students/academic-history/${id}`, { method: 'DELETE' }),
  getAlumni: (studentId: number) =>
    request<AlumniRecord | null>(`/students/${studentId}/alumni`),
  createAlumni: (studentId: number, body: AlumniCreate) =>
    request<AlumniRecord>(`/students/${studentId}/alumni`, { method: 'POST', body }),
  updateAlumni: (studentId: number, body: AlumniUpdate) =>
    request<AlumniRecord>(`/students/${studentId}/alumni`, { method: 'PATCH', body }),
  promoteStudents: (params: {
    current_class: string
    next_class: string
    current_year: string
    next_year: string
  }) =>
    request<AcademicRecord[]>(`/students/promote${queryString(params)}`, { method: 'POST' }),
  listTeachers: (skip = 0, limit = 100) =>
    request<Teacher[]>(`/teachers/${queryString({ skip, limit })}`),
  listAllTeachers: () => listAll((skip, limit) => api.listTeachers(skip, limit)),
  getTeacher: (id: number) => request<Teacher>(`/teachers/${id}`),
  createTeacher: (body: TeacherCreate) =>
    request<Teacher>('/teachers/', { method: 'POST', body }),
  updateTeacher: (id: number, body: TeacherUpdate) =>
    request<Teacher>(`/teachers/${id}`, { method: 'PATCH', body }),
  deleteTeacher: (id: number) =>
    request<void>(`/teachers/${id}`, { method: 'DELETE' }),
  listClasses: (skip = 0, limit = 100) =>
    request<SchoolClass[]>(`/classes/${queryString({ skip, limit })}`),
  listAllClasses: () => listAll((skip, limit) => api.listClasses(skip, limit)),
  getClass: (id: number) => request<SchoolClass>(`/classes/${id}`),
  createClass: (body: ClassCreate) =>
    request<SchoolClass>('/classes/', { method: 'POST', body }),
  updateClass: (id: number, body: ClassUpdate) =>
    request<SchoolClass>(`/classes/${id}`, { method: 'PATCH', body }),
  deleteClass: (id: number) =>
    request<void>(`/classes/${id}`, { method: 'DELETE' }),
  healthCheck: () => request<Record<string, string>>('/health', {}, API_ORIGIN),
}
