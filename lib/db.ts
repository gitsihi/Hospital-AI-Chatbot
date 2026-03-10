import { promises as fs } from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'database')
const LOGS_PATH = path.join(process.cwd(), 'logs')

export async function readJsonFile<T>(filename: string, folder: 'database' | 'logs' = 'database'): Promise<T> {
  const basePath = folder === 'database' ? DB_PATH : LOGS_PATH
  const filePath = path.join(basePath, filename)
  const data = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(data) as T
}

export async function writeJsonFile<T>(filename: string, data: T, folder: 'database' | 'logs' = 'database'): Promise<void> {
  const basePath = folder === 'database' ? DB_PATH : LOGS_PATH
  const filePath = path.join(basePath, filename)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

// Builds a rich text snapshot of all DB data to inject into the AI system prompt
export async function buildHospitalContext(): Promise<string> {
  const [doctorsData, deptData, insuranceData, servicesData] = await Promise.all([
    readJsonFile<{ doctors: Doctor[] }>('doctors.json'),
    readJsonFile<DepartmentsData>('departments.json'),
    readJsonFile<{ insurancePartners: Insurance[] }>('insurance.json'),
    readJsonFile<{ services: Service[] }>('services.json'),
  ])

  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dateStr = today.toISOString().split('T')[0]

  const doctorLines = doctorsData.doctors.map(d => {
    const todaySlots = d.availability[dayName] ?? []
    const weekSummary = Object.entries(d.availability)
      .filter(([, slots]) => slots.length > 0)
      .map(([day, slots]) => `${day}: ${slots.join(', ')}`)
      .join(' | ')
    return `- ${d.name} | ${d.specialty} | ${d.department} | Room ${d.roomNumber} | Fee $${d.consultationFee} | Today (${dayName}) slots: [${todaySlots.join(', ') || 'none'}] | Full week: ${weekSummary}`
  }).join('\n')

  const deptLines = deptData.departments.map(d =>
    `- ${d.name}: ${d.description} | Location: ${d.location} | Phone: ${d.phone}`
  ).join('\n')

  const visitHours = deptData.visitingHours
  const visitLines = `General – Weekdays: ${visitHours.general.weekdays}, Weekends: ${visitHours.general.weekends}\nICU – ${visitHours.icu.allowed}, max ${visitHours.icu.maxVisitors} visitors. ${visitHours.icu.notes}`

  const insLines = insuranceData.insurancePartners.map(i =>
    `- ${i.name} (${i.networkType}): covers [${i.proceduresCovered.join(', ')}] at ${i.coveragePercentage}% | Contact: ${i.contactNumber}`
  ).join('\n')

  const svcLines = servicesData.services.map(s =>
    `- ${s.name} (id: ${s.id}) | ${s.department} | Duration: ${s.duration} min | Base price: $${s.basePrice}`
  ).join('\n')

  return `
TODAY: ${dayName}, ${dateStr}

=== DOCTORS & AVAILABILITY ===
${doctorLines}

=== DEPARTMENTS ===
${deptLines}

=== VISITING HOURS ===
${visitLines}

=== INSURANCE PARTNERS ===
${insLines}

=== SERVICES & PRICING ===
${svcLines}
`.trim()
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string
  name: string
  specialty: string
  department: string
  departmentId: string
  consultationFee: number
  roomNumber: string
  availability: Record<string, string[]>
}

export interface Department {
  id: string
  name: string
  description: string
  location: string
  phone: string
}

export interface DepartmentsData {
  departments: Department[]
  visitingHours: {
    general: {
      weekdays: string
      weekends: string
    }
    icu: {
      allowed: string
      maxVisitors: number
      notes: string
    }
  }
}

export interface Insurance {
  id: string
  name: string
  proceduresCovered: string[]
  coveragePercentage: number
  networkType: string
  contactNumber: string
}

export interface Service {
  id: string
  name: string
  department: string
  departmentId: string
  description: string
  duration: number
  basePrice: number
}

export interface Appointment {
  id: string
  patientName: string
  patientPhone: string
  patientEmail: string
  doctorId: string
  doctorName: string
  date: string
  time: string
  service: string
  status: 'scheduled' | 'completed' | 'cancelled'
  createdAt: string
}

export interface UnansweredQuery {
  id: string
  query: string
  reason: string
  timestamp: string
}

export interface CallbackTicket {
  id: string
  patientName: string
  patientPhone: string
  patientEmail: string
  querySummary: string
  department: string
  status: 'pending' | 'resolved' | 'in-progress'
  createdAt: string
  resolvedAt?: string
}

export interface User {
  id: string
  username: string
  email?: string
  password: string
  role: string
  name: string
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ChatSession {
  email: string
  messages: ChatMessage[]
  lastUpdated: string
}
