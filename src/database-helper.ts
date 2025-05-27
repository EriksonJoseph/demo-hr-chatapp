import { supabase } from './supabase'

export interface DatabaseQuery {
  type: 'SELECT' | 'COUNT' | 'AGGREGATE'
  table: string
  columns?: string[]
  conditions?: Record<string, any>
  joins?: string[]
  groupBy?: string[]
  orderBy?: { column: string; direction: 'asc' | 'desc' }[]
  limit?: number
}

export async function executeQuery(query: DatabaseQuery) {
  try {
    let supabaseQuery = supabase.from(query.table)

    // Apply select columns
    if (query.columns && query.columns.length > 0) {
      supabaseQuery = supabaseQuery.select(query.columns.join(', '))
    } else {
      supabaseQuery = supabaseQuery.select('*')
    }

    // Apply conditions
    if (query.conditions) {
      Object.entries(query.conditions).forEach(([key, value]) => {
        if (typeof value === 'string' && value.includes('%')) {
          supabaseQuery = supabaseQuery.ilike(key, value)
        } else {
          supabaseQuery = supabaseQuery.eq(key, value)
        }
      })
    }

    // Apply ordering
    if (query.orderBy) {
      query.orderBy.forEach(({ column, direction }) => {
        supabaseQuery = supabaseQuery.order(column, { ascending: direction === 'asc' })
      })
    }

    // Apply limit
    if (query.limit) {
      supabaseQuery = supabaseQuery.limit(query.limit)
    }

    const { data, error } = await supabaseQuery

    if (error) throw error
    return data
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

export async function getEmployeeSummary() {
  const { data, error } = await supabase
    .from('employees')
    .select(`
      emp_id,
      first_name,
      last_name,
      department,
      position,
      salary,
      status
    `)

  if (error) throw error
  return data
}

export async function getAttendanceByEmployee(empId: number, startDate?: string, endDate?: string) {
  let query = supabase
    .from('attendance')
    .select('*')
    .eq('emp_id', empId)
    .order('date', { ascending: false })

  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getDepartmentStats() {
  const { data, error } = await supabase
    .from('employees')
    .select('department')

  if (error) throw error
  
  const stats = data.reduce((acc: Record<string, number>, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1
    return acc
  }, {})

  return Object.entries(stats).map(([department, count]) => ({ department, count }))
}