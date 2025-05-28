import { supabase } from './supabase';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export interface DatabaseQuery {
  type: 'SELECT' | 'COUNT' | 'AGGREGATE'
  table: string
  columns?: string[]
  conditions?: Record<string, unknown>
  conditionLogic?: 'AND' | 'OR'  // Default is 'AND' if not specified
  joins?: string[]
  groupBy?: string[]
  orderBy?: { column: string; direction: 'asc' | 'desc' }[]
  limit?: number
}

function parseSQLiteDate(dateInputStr: string): string {
  // Clean input of any surrounding select statements or parentheses that might be artifacts
  const cleanedDateInput = dateInputStr.replace(/^\(SELECT\s+|\s*\)$/gi, '').trim();
  const normalizedInput = cleanedDateInput.toUpperCase();
  
  // Get the current date for reference
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  // Check if the input is already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedInput)) {
    // Parse the date components
    const [yearStr, monthStr, dayStr] = normalizedInput.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    
    // Check if this might be a partial date that needs year correction
    // We'll assume that if the year is not the current year and the date is valid in the current year,
    // then it's a partial date input where we should use the current year
    if (year !== currentYear) {
      // Create a tentative date with current year and input month/day
      const tentativeDate = new Date(currentYear, month - 1, day);
      if (!isNaN(tentativeDate.getTime())) {
        // If this is a valid date AND it's not more than 6 months in the future
        // (this helps avoid incorrectly assuming future dates)
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(currentMonth + 6);
        
        if (tentativeDate <= sixMonthsFromNow) {
          // Return the date with the current year
          return `${currentYear}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`;
        }
      }
    }
    
    // If we didn't apply year correction, return the formatted date as is
    const d = new Date(normalizedInput);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  let targetDate = new Date(); // Use current date as base

  // Handle CURRENT_DATE and CURRENT_DATE with interval
  const intervalMatch = normalizedInput.match(/^CURRENT_DATE\s*([+-])\s*INTERVAL\s*'(\d+)\s+(DAY|DAYS)'$/);
  if (normalizedInput === 'CURRENT_DATE') {
    // Already set to current date
  } else if (intervalMatch) {
    const operator = intervalMatch[1];
    const value = parseInt(intervalMatch[2], 10);
    const unit = intervalMatch[3]; // DAY or DAYS

    if (unit === 'DAY' || unit === 'DAYS') {
      if (operator === '+') {
        targetDate.setDate(targetDate.getDate() + value);
      } else if (operator === '-') {
        targetDate.setDate(targetDate.getDate() - value);
      }
    }
  } else {
    // Fallback for other SQLite-like date functions (simplified)
    const lowerDateStr = normalizedInput.toLowerCase();
    if (lowerDateStr === "date('now')" || lowerDateStr === "date('now', 'localtime')") {
      // Current date is already set
    } else {
      const modifierMatch = lowerDateStr.match(/date\('now',\s*'([+-]?\d+\s*(?:day|days|month|months))'\)/);
      if (modifierMatch && modifierMatch[1]) {
        const modifier = modifierMatch[1];
        const numMatch = modifier.match(/([+-]?\d+)\s*(day|days|month|months)/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          const unit = numMatch[2].startsWith('month') ? 'month' : 'day';
          if (unit === 'month') {
            targetDate.setMonth(targetDate.getMonth() + num);
          } else {
            targetDate.setDate(targetDate.getDate() + num);
          }
        }
      } else {
        console.warn(`Unparseable date string: ${dateInputStr}. Returning current date.`);
        // Keep targetDate as current date if unparseable
      }
    }
  }

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
    
    // Special handling for AGGREGATE query type
    if (query.type === 'AGGREGATE') {
      if (!query.columns || query.columns.length === 0) {
        throw new Error('Columns must be specified for aggregate queries');
      }
      
      // We need to handle aggregate functions like SUM, AVG, COUNT, etc.
      // The column format should be like ['SUM(total_hours)']
      // --- Start of RPC specific handling for get_average_salary ---
      let detectedAvgSalaryAlias: string | undefined = undefined;
      const avgSalaryColumn = query.columns?.find(col => typeof col === 'string' && col.toUpperCase().replace(/\s/g, '').startsWith('AVG(SALARY)'));

      if (avgSalaryColumn) {
        const aliasMatch = avgSalaryColumn.match(/AS\s+(\w+)/i);
        if (aliasMatch && aliasMatch[1]) {
          detectedAvgSalaryAlias = aliasMatch[1];
        }
      }

      if (
        query.table.toLowerCase() === 'employees' &&
        avgSalaryColumn && // AVG(salary) must be present
        query.columns && query.columns.length === 1 && query.columns[0].toUpperCase().replace(/\s/g, '').includes('AVG(SALARY)') &&
        (!query.conditions || Object.keys(query.conditions).length === 0) && // No conditions for simple average
        (!query.groupBy || query.groupBy.length === 0) &&
        (!query.orderBy || query.orderBy.length === 0) &&
        !query.limit
      ) {
        console.log('Calling RPC get_average_salary');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_average_salary');

        if (rpcError) {
          console.error('RPC get_average_salary error:', rpcError);
          throw new Error(`RPC Error: ${rpcError.message}`);
        }
        console.log('RPC get_average_salary data:', rpcData);
        // RPC returns [{ avg_salary: number }]
        // Map to expected structure using the detected alias or default 'avg_salary'
        if (rpcData && rpcData.length > 0 && rpcData[0] && rpcData[0].avg_salary !== null) {
          const aliasToUse = detectedAvgSalaryAlias || 'avg_salary'; // Default to 'avg_salary' if no alias
          return [{ [aliasToUse]: parseFloat(String(rpcData[0].avg_salary)) }];
        }
        // If rpcData[0].avg_salary is null (e.g., no employees), return it as null under the alias
        if (rpcData && rpcData.length > 0 && rpcData[0] && rpcData[0].avg_salary === null) {
            const aliasToUse = detectedAvgSalaryAlias || 'avg_salary';
            return [{ [aliasToUse]: null }];
        }
        return []; // Return empty array if RPC returns no data or unexpected structure
      }
      // --- End of RPC specific handling for get_average_salary ---

      // --- Start of RPC specific handling for get_department_with_highest_avg_salary ---
      let detectedDeptAvgSalaryAlias: string | undefined = undefined;
      const deptAvgSalaryColumn = query.columns?.find(col => typeof col === 'string' && col.toUpperCase().replace(/\s/g, '').includes('AVG(SALARY)'));

      if (deptAvgSalaryColumn) {
        const aliasMatch = deptAvgSalaryColumn.match(/AS\s+(\w+)/i); // Attempt to find an alias for AVG(salary)
        if (aliasMatch && aliasMatch[1]) {
          detectedDeptAvgSalaryAlias = aliasMatch[1];
        }
      }
      
      // Check for 'department' column explicitly
      const departmentColumnExists = query.columns?.some(col => typeof col === 'string' && col.toLowerCase().replace(/\s/g, '') === 'department');

      if (
        query.table.toLowerCase() === 'employees' &&
        departmentColumnExists && // 'department' column must be selected
        deptAvgSalaryColumn &&    // 'AVG(salary)' must be selected
        query.columns && query.columns.length === 2 && // Expecting 'department' and 'AVG(salary)'
        (!query.conditions || Object.keys(query.conditions).length === 0) && // No specific conditions for this RPC
        query.orderBy && query.orderBy.length === 1 &&
        (
          query.orderBy[0].column.toUpperCase().replace(/\s/g, '') === 'AVG(SALARY)' || // Order by AVG(salary)
          (detectedDeptAvgSalaryAlias && query.orderBy[0].column.toLowerCase() === detectedDeptAvgSalaryAlias.toLowerCase()) // Or order by its alias
        ) &&
        query.orderBy[0].direction.toLowerCase() === 'desc' &&
        query.limit === 1
      ) {
        console.log('Calling RPC get_department_with_highest_avg_salary');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_department_with_highest_avg_salary');

        if (rpcError) {
          console.error('RPC get_department_with_highest_avg_salary error:', rpcError);
          throw new Error(`RPC Error: ${rpcError.message}`);
        }
        console.log('RPC get_department_with_highest_avg_salary data:', rpcData);
        // RPC returns [{ department: string, avg_salary: number }]
        // Map to expected structure, using detected alias for avg_salary if present
        if (rpcData && rpcData.length > 0 && rpcData[0]) {
          const aliasForAvg = detectedDeptAvgSalaryAlias || 'avg_salary'; // Default if no alias
          return [{ 
            department: rpcData[0].department, 
            [aliasForAvg]: parseFloat(String(rpcData[0].avg_salary)) 
          }];
        }
        return []; // Return empty array if RPC returns no data or unexpected structure
      }
      // --- End of RPC specific handling for get_department_with_highest_avg_salary ---

      // --- Start of RPC specific handling for SUM(total_hours) on attendance ---
      if (
        query.table.toLowerCase() === 'attendance' &&
        query.columns && query.columns.length === 1 &&
        query.columns[0].toLowerCase().replace(/\s/g, '') === 'sum(total_hours)' &&
        conditions &&
        conditions.emp_id && typeof conditions.emp_id === 'object' && 'value' in conditions.emp_id &&
        conditions.date && typeof conditions.date === 'object' && 'operator' in conditions.date && 
        (conditions.date as { operator: string }).operator.toUpperCase() === 'BETWEEN' &&
        'value' in conditions.date 
      ) {
        const empIdValue = (conditions.emp_id as { value: unknown }).value;
        const dateConditionValue = (conditions.date as { value: string }).value;
        
        const empId = typeof empIdValue === 'string' ? parseInt(empIdValue, 10) : empIdValue as number;

        if (typeof empId === 'number' && !isNaN(empId) && typeof dateConditionValue === 'string') {
          const dateParts = dateConditionValue.split(/\s+AND\s+/i).map((v: string) => v.trim());
          if (dateParts.length === 2) {
            const startDate = parseSQLiteDate(dateParts[0]);
            const endDate = parseSQLiteDate(dateParts[1]);

            console.log(`Calling RPC get_employee_work_hours with emp_id: ${empId}, start: ${startDate}, end: ${endDate}`);

            const { data: rpcData, error: rpcError } = await supabase.rpc('get_employee_work_hours', {
              employee_id: empId,
              start_date_param: startDate,
              end_date_param: endDate,
            });

            if (rpcError) {
              console.error('RPC get_employee_work_hours error:', rpcError);
              throw new Error(`RPC Error: ${rpcError.message}`);
            }

            console.log('RPC get_employee_work_hours data:', rpcData);

            const resultAlias = 'sum_total_hours'; // Expected alias for SUM(total_hours)
            let totalHours = 0;
            if (rpcData && rpcData.length > 0 && rpcData[0].total_worked_hours !== null) {
              // Ensure total_worked_hours is treated as a number
              totalHours = parseFloat(String(rpcData[0].total_worked_hours));
            }
            
            return [{ [resultAlias]: totalHours }];
          }
        }
      }
      // --- End of RPC specific handling for get_employee_work_hours ---

      // --- Start of RPC specific handling for get_employee_with_most_absences ---
      let detectedCountAliasForAbsence: string | undefined = undefined;
      const countColumnAbsence = query.columns?.find(col => typeof col === 'string' && col.toUpperCase().startsWith('COUNT(*)'));

      if (countColumnAbsence) {
        const aliasMatch = countColumnAbsence.match(/AS\s+(\w+)/i);
        if (aliasMatch && aliasMatch[1]) {
          detectedCountAliasForAbsence = aliasMatch[1];
        }
      }

      if (
        query.type === 'AGGREGATE' &&
        query.table === 'attendance' &&
        detectedCountAliasForAbsence && // Alias must be found and match orderBy
        query.columns && query.columns.includes('emp_id') && query.columns.includes(countColumnAbsence!) &&
        query.conditions &&
        query.conditions.status &&
        typeof query.conditions.status === 'object' &&
        (query.conditions.status as { operator: string; value: unknown }).operator === '=' &&
        (query.conditions.status as { operator: string; value: unknown }).value === 'absent' &&
        query.orderBy &&
        query.orderBy.length === 1 &&
        query.orderBy[0].column.toLowerCase() === detectedCountAliasForAbsence.toLowerCase() &&
        query.limit === 1
      ) {
        console.log('Calling RPC get_employee_with_most_absences');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_employee_with_most_absences');

        if (rpcError) {
          console.error('RPC get_employee_with_most_absences error:', rpcError);
          throw new Error(`RPC Error: ${rpcError.message}`);
        }
        console.log('RPC get_employee_with_most_absences data:', rpcData);
        // RPC returns [{ emp_id: number, absence_count: number }]
        // Map to expected structure using the detected alias
        if (rpcData && rpcData.length > 0 && detectedCountAliasForAbsence) {
          return [{ emp_id: rpcData[0].emp_id, [detectedCountAliasForAbsence]: rpcData[0].absence_count }];
        }
        return rpcData; // Should be an empty array if no data, or handle as appropriate
      }

      // --- Start of RPC specific handling for get_employee_with_most_leave ---
      let detectedSumDaysAliasForLeave: string | undefined = undefined;
      let empIdColumnExistsForLeave = false;
      let sumDaysColumnExistsForLeave = false;

      if (query.table.toLowerCase() === 'leave_requests' && query.columns && query.columns.length === 2) {
        empIdColumnExistsForLeave = query.columns.some(col => col.toLowerCase().includes('emp_id'));
        
        const sumColumnDefinition = query.columns.find(col => 
            col.toLowerCase().replace(/\s/g, '').startsWith('sum(days)')
        );

        if (sumColumnDefinition) {
            sumDaysColumnExistsForLeave = true;
            const parts = sumColumnDefinition.split(/\s+as\s+/i);
            if (parts.length > 1) {
                detectedSumDaysAliasForLeave = parts[1].trim().toLowerCase();
            }
        }
      }

      if (
        query.table.toLowerCase() === 'leave_requests' &&
        empIdColumnExistsForLeave &&
        sumDaysColumnExistsForLeave &&
        detectedSumDaysAliasForLeave && // Ensure an alias was found for SUM(days)
        query.orderBy && query.orderBy.length === 1 && 
        query.orderBy[0].column.toLowerCase() === detectedSumDaysAliasForLeave && // Check against the detected alias
        query.orderBy[0].direction.toLowerCase() === 'desc' &&
        query.limit === 1
      ) {
        console.log('Calling RPC get_employee_with_most_leave');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_employee_with_most_leave');

        if (rpcError) {
          console.error('RPC get_employee_with_most_leave error:', rpcError);
          throw new Error(`RPC Error: ${rpcError.message}`);
        }

        console.log('RPC get_employee_with_most_leave data:', rpcData);
        // The RPC returns { emp_id, total_leave_days }
        // The queryStructure expects { emp_id, [detectedSumDaysAliasForLeave] } 
        // The RPC returns { emp_id, total_leave_days }
        // We use detectedSumDaysAliasForLeave which was matched against query.orderBy[0].column

        if (rpcData && rpcData.length > 0) {
          // Map total_leave_days from RPC to the alias expected by queryStructure (detectedSumDaysAliasForLeave)
          return [{ 
            emp_id: rpcData[0].emp_id, 
            [detectedSumDaysAliasForLeave]: parseFloat(String(rpcData[0].total_leave_days)) 
          }];
        } else {
          return []; // No employee found or no leave taken
        }
      }
      // --- End of RPC specific handling for get_employee_with_most_leave ---

      // Original aggregate handling (if not handled by RPC)
      const aggregateBuilder = supabase.from(query.table);
      
      // Extract the aggregate function and column
      const aggregateColumns: Record<string, string> = {};
      
      for (const col of query.columns) {
        // Parse functions like SUM(column_name), COUNT(*), etc.
        const funcMatch = col.match(/^(\w+)\(([^)]+)\)$/);
        if (funcMatch) {
          const [, func, column] = funcMatch;
          // Convert to Supabase's syntax
          const alias = func.toLowerCase() + (column === '*' ? '_all' : '_' + column.replace(/[^a-zA-Z0-9_]/g, ''));
          aggregateColumns[alias] = `${func.toLowerCase()}(${column})`;
        } else {
          // Regular column
          aggregateColumns[col] = col;
        }
      }
      
      // Create the select string with all the aggregate functions
      const selectStr = Object.entries(aggregateColumns).map(([alias, definition]) => `${alias}:${definition}`).join(', ');
      let finalQuery = aggregateBuilder.select(selectStr);
      
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
                  const parts = value.split(/\s+AND\s+/i).map((v: string) => v.trim());
                  if (parts.length !== 2) {
                    console.warn(`Invalid BETWEEN format: ${value}`);
                    throw new Error(`Invalid BETWEEN format: ${value}`);
                  }
                  const [startStr, endStr] = parts;
                  const startDate = parseSQLiteDate(startStr);
                  const endDate = parseSQLiteDate(endStr);
                  finalQuery = finalQuery.gte(key, startDate).lte(key, endDate);
                } else {
                  console.warn(`Unsupported value type for BETWEEN operator: ${typeof value} for key ${key}`);
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
      
      const result = await finalQuery;
      const data = result?.data;
      const error = result?.error;
      
      if (error) throw error;
      return data;
    } else {
      // Handle SELECT and COUNT query types as before
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
        // Check if we need to use OR logic between conditions
        const useOrLogic = query.conditionLogic === 'OR';
        
        if (useOrLogic) {
          // For OR logic, we need to build an OR filter using .or(...)
          // First, we need to construct the filter expressions
          const orFilters: string[] = [];
          
          for (const [key, condition] of Object.entries(conditions)) {
            if (condition && typeof condition === 'object' && 'operator' in condition && 'value' in condition) {
              const { operator, value } = condition as { operator: string; value: unknown };
              
              // Build the filter string based on the operator
              switch (operator.toUpperCase()) {
                case '=':
                  if (value === null) {
                    orFilters.push(`${key}.is.null`);
                  } else if (value !== undefined) {
                    orFilters.push(`${key}.eq.${JSON.stringify(value)}`);
                  }
                  break;
                case 'IN':
                  orFilters.push(`${key}.in.${JSON.stringify(Array.isArray(value) ? value : [value])}`);
                  break;
                case 'LIKE':
                  orFilters.push(`${key}.ilike.${JSON.stringify(`%${value}%`)}`);
                  break;
                case 'BETWEEN':
                  // For BETWEEN with OR logic, we need to handle this specially
                  if (typeof value === 'string') {
                    const parts = value.split(/\s+AND\s+/i).map((v: string) => v.trim());
                    if (parts.length !== 2) {
                      console.warn(`Invalid BETWEEN format: ${value}`);
                      throw new Error(`Invalid BETWEEN format: ${value}`);
                    }
                    const [startStr, endStr] = parts;
                    const startDate = parseSQLiteDate(startStr);
                    const endDate = parseSQLiteDate(endStr);
                    // Add two conditions for BETWEEN
                    orFilters.push(`${key}.gte.${JSON.stringify(startDate)}`);
                    orFilters.push(`${key}.lte.${JSON.stringify(endDate)}`);
                  } else {
                    console.warn(`Unsupported value type for BETWEEN operator: ${typeof value} for key ${key}`);
                  }
                  break;
                case '>':
                  orFilters.push(`${key}.gt.${JSON.stringify(value)}`);
                  break;
                case '>=':
                  orFilters.push(`${key}.gte.${JSON.stringify(value)}`);
                  break;
                case '<':
                  orFilters.push(`${key}.lt.${JSON.stringify(value)}`);
                  break;
                case '<=':
                  orFilters.push(`${key}.lte.${JSON.stringify(value)}`);
                  break;
                case '!=':
                case '<>':
                  if (value === null) {
                    orFilters.push(`${key}.not.is.null`);
                  } else {
                    orFilters.push(`${key}.neq.${JSON.stringify(value)}`);
                  }
                  break;
                default:
                  console.warn(`Unsupported operator: ${operator}`);
                  if (value !== undefined) {
                    orFilters.push(`${key}.eq.${JSON.stringify(value)}`);
                  }
              }
            } else {
              // Fallback to simple equality check for non-object conditions
              if (condition !== undefined) {
                orFilters.push(`${key}.eq.${JSON.stringify(condition)}`);
              }
            }
          }
          
          // Apply the OR filter if we have any conditions
          if (orFilters.length > 0) {
            finalQuery = finalQuery.or(orFilters.join(','));
          }
        } else {
          // Standard AND logic (existing implementation)
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
                    const parts = value.split(/\s+AND\s+/i).map((v: string) => v.trim());
                    if (parts.length !== 2) {
                      console.warn(`Invalid BETWEEN format: ${value}`);
                      throw new Error(`Invalid BETWEEN format: ${value}`);
                    }
                    const [startStr, endStr] = parts;
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
      const data = result?.data;
      const error = result?.error;

      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
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