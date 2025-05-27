import { supabase } from './supabase';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export interface DatabaseQuery {
  type: 'SELECT' | 'COUNT' | 'AGGREGATE'
  table: string
  columns?: string[]
  conditions?: Record<string, unknown>
  joins?: string[]
  groupBy?: string[]
  orderBy?: { column: string; direction: 'asc' | 'desc' }[]
  limit?: number
}

function parseSQLiteDate(dateInputStr: string): string {
  // Check if the input is already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInputStr)) {
    // Validate if it's a real date, then return
    const d = new Date(dateInputStr);
    if (!isNaN(d.getTime())) {
        // Re-format to ensure consistency, e.g., if input was '2023-1-5'
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
  }

  const now = new Date(); // Base for 'now' calculations
  const targetDate = new Date(now); // Work with a copy

  // Normalize to lowercase for easier matching
  const lowerDateStr = dateInputStr.toLowerCase();

  if (lowerDateStr === "date('now')" || lowerDateStr === "date('now', 'localtime')") {
    // Current date is already set in targetDate
  } else {
    const modifierMatch = lowerDateStr.match(/date\('now',\s*'(.+?)'\)/);
    if (modifierMatch && modifierMatch[1]) {
      const modifier = modifierMatch[1];
      const numMatch = modifier.match(/(-?\d+)\s*(month|months|day|days)/);

      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        const unit = numMatch[2].startsWith('month') ? 'month' : 'day';

        if (unit === 'month') {
          targetDate.setMonth(targetDate.getMonth() + num);
        } else if (unit === 'day') {
          targetDate.setDate(targetDate.getDate() + num);
        }
      } else if (modifier === 'start of month') {
        targetDate.setDate(1);
      } else {
        console.warn(`Unsupported date modifier in '${dateInputStr}': ${modifier}`);
      }
    } else {
      console.warn(`Unparseable date string: ${dateInputStr}. Returning current date.`);
    }
  }

  // Format to YYYY-MM-DD
  const year = targetDate.getFullYear();
  const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
  const day = targetDate.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function executeSubquery(subquery: string): Promise<number[]> {
  // Expect subqueries like: SELECT emp_id FROM employees WHERE ...
  if (!subquery.toLowerCase().startsWith("select emp_id from employees where")) {
    throw new Error(`Unsupported subquery structure: ${subquery}`);
  }

  let supabaseQuery = supabase.from('employees').select('emp_id');
  let conditionsFound = false;

  // Try to match first_name LIKE '%...%'
  const firstNameMatch = subquery.match(/first_name\s+LIKE\s+'%(.+?)%'/i);
  if (firstNameMatch && firstNameMatch[1]) {
    supabaseQuery = supabaseQuery.ilike('first_name', `%${firstNameMatch[1]}%`);
    conditionsFound = true;
  }

  // Try to match last_name LIKE '%...%'
  const lastNameMatch = subquery.match(/last_name\s+LIKE\s+'%(.+?)%'/i);
  if (lastNameMatch && lastNameMatch[1]) {
    supabaseQuery = supabaseQuery.ilike('last_name', `%${lastNameMatch[1]}%`);
    conditionsFound = true;
  }
  
  // If no specific LIKE conditions for names were found, the subquery might be more complex than expected
  // or it's a different kind of subquery not yet supported for direct execution here.
  if (!conditionsFound) {
     // Check for a simple emp_id = value if that's a pattern we expect from AI
     const empIdDirectMatch = subquery.match(/emp_id\s*=\s*(\d+)/i);
     if (empIdDirectMatch && empIdDirectMatch[1]) {
        supabaseQuery = supabaseQuery.eq('emp_id', parseInt(empIdDirectMatch[1],10));
        conditionsFound = true;
     } else {
        throw new Error(`Unsupported subquery conditions: ${subquery}`);
     }
  }

  const { data, error } = await supabaseQuery;

  if (error) {
    console.error('Error executing subquery:', error);
    throw error;
  }

  return data ? data.map((item: { emp_id: number }) => item.emp_id) : [];
}

export async function executeQuery(query: DatabaseQuery) {
  try {
    
    // Handle subqueries first
    const conditions = { ...query.conditions }
    for (const [key, condition] of Object.entries(conditions)) {
      if (
        condition &&
        typeof condition === 'object' &&
        'operator' in condition &&
        'value' in condition &&
        (condition as { operator: string; value: unknown }).operator === '=' &&
        typeof (condition as { operator: string; value: unknown }).value === 'string' &&
        ((condition as { value: string }).value.startsWith('(SELECT') &&
        (condition as { value: string }).value.endsWith(')'))
      ) {
        const subquery = (condition.value as string).slice(1, -1) // Remove parentheses
        conditions[key] = {
          operator: 'in',
          value: await executeSubquery(subquery)
        }
      }
    }
    
    const initialBuilder = supabase.from(query.table);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let finalQuery: PostgrestFilterBuilder<any, any, any>;

    // Apply select columns
    if (query.columns && query.columns.length > 0) {
      finalQuery = initialBuilder.select(query.columns.join(', '));
    } else {
      finalQuery = initialBuilder.select('*');
    }

    // Apply conditions
    if (conditions) {
      for (const [key, condition] of Object.entries(conditions)) {
        if (condition && typeof condition === 'object' && 'operator' in condition && 'value' in condition) {
          const { operator, value } = condition as { operator: string; value: unknown };
          
          switch (operator.toUpperCase()) {
            case '=':
              if (value === null) {
                finalQuery = finalQuery.is(key, null);
              } else if (value !== undefined) {
                finalQuery = finalQuery.eq(key, value);
              }
              break;
            case 'IN':
              finalQuery = finalQuery.in(key, Array.isArray(value) ? value : [value]);
              break;
            case 'LIKE':
              finalQuery = finalQuery.ilike(key, `%${value}%`);
              break;
            case 'BETWEEN':
              // For BETWEEN, value should be a string with AND separated values
              if (typeof value === 'string') {
                const [startStr, endStr] = value.split(' AND ').map((v: string) => v.trim());
              const startDate = parseSQLiteDate(startStr);
              const endDate = parseSQLiteDate(endStr);
                finalQuery = finalQuery.gte(key, startDate).lte(key, endDate);
              } else {
                console.warn(`Unsupported value type for BETWEEN operator: ${typeof value} for key ${key}`);
                // Optionally, throw an error or handle as a non-match
              }
              break;
            case '>':
              finalQuery = finalQuery.gt(key, value);
              break;
            case '>=':
              finalQuery = finalQuery.gte(key, value);
              break;
            case '<':
              finalQuery = finalQuery.lt(key, value);
              break;
            case '<=':
              finalQuery = finalQuery.lte(key, value);
              break;
            case '!=':
            case '<>':
              if (value === null) {
                finalQuery = finalQuery.not(key, 'is', null);
              } else {
                finalQuery = finalQuery.neq(key, value);
              }
              break;
            default:
              console.warn(`Unsupported operator: ${operator}`);
              if (value !== undefined) {
                finalQuery = finalQuery.eq(key, value);
              }
          }
        } else {
          // Fallback to simple equality check for non-object conditions
          if (condition !== undefined) {
            finalQuery = finalQuery.eq(key, condition);
          }
        }
      }
    }

    // Apply ordering
    if (query.orderBy) {
      query.orderBy.forEach(({ column, direction }) => {
        finalQuery = finalQuery.order(column, { ascending: direction === 'asc' });
      });
    }

    // Apply limit
    if (query.limit) {
      finalQuery = finalQuery.limit(query.limit);
    }
    
    const result = await finalQuery;
    const data = result?.data
    const error = result?.error

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
  
  const stats = data.reduce((acc: Record<string, number>, emp: { department: string }) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1
    return acc
  }, {})

  return Object.entries(stats).map(([department, count]) => ({ department, count }))
}