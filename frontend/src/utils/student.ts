import type { Student } from '../services/api'

export function fullName(student: Student): string {
  return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
}
