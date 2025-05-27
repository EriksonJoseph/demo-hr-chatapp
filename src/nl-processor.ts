import { GoogleGenerativeAI } from "@google/generative-ai"
import { DatabaseQuery } from './database-helper'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

export async function parseNaturalLanguageQuery(userQuery: string): Promise<DatabaseQuery> {
  const model = genAI.getGenerativeModel({ model: process.env.MODEL_NAME || "gemini-1.5-flash" })

  const systemPrompt = `
You are a database query translator. Convert natural language questions about HR data into structured database queries.

Available tables and their main columns:
- employees: emp_id, first_name, last_name, department, position, hire_date, salary, phone, email, status
- attendance: attendance_id, emp_id, date, check_in, check_out, total_hours, status, notes
- leave_requests: leave_id, emp_id, leave_type, start_date, end_date, days, reason, status, applied_date
- payroll: payroll_id, emp_id, pay_period, basic_salary, overtime_pay, bonus, allowances, deductions, net_pay, pay_date
- benefits: benefit_id, emp_id, social_security, health_insurance, life_insurance, provident_fund, annual_leave_days, sick_leave_days, personal_leave_days

Convert the user query into a JSON object with this structure:
{
  "type": "SELECT" | "COUNT" | "AGGREGATE",
  "table": "table_name",
  "columns": ["column1", "column2"] (optional),
  "conditions": {"column": {"operator": "=", "value": "value"}} (optional),
  "orderBy": [{"column": "column_name", "direction": "asc|desc"}] (optional),
  "limit": number (optional)
}

IMPORTANT RULES:
1. For first_name, last_name, department, and position fields, ALWAYS use LIKE operator with % wildcards for text matching
2. For other fields, use = operator for exact matches
3. If a query requires \`emp_id\` (e.g., for \`attendance\`, \`leave_requests\`, \`payroll\`, \`benefits\` tables) and an employee's name (first_name, last_name) is provided, construct a subquery to find the \`emp_id\` from the \`employees\` table. Use \`LIKE\` for name matching in the subquery.
4. For date fields:
    a. If a partial date like 'YYYY-MM' is provided (e.g., 'เดือน 1 ปี 2024' which implies '2024-01'), convert this into a date range condition using the \`BETWEEN\` operator. The value should be a string \`'YYYY-MM-01' AND 'YYYY-MM-LL'\`, where \`LL\` is the last day of that month.
    b. For full dates 'YYYY-MM-DD', use the \`=\` operator.
5. For the \`status\` column in the \`attendance\` table:
    a. If the user mentions 'สาย' (late), use operator \`=\` with value \`'late'\`.
    b. If the user mentions 'ขาด' or 'ขาดงาน' (absent), use operator \`=\` with value \`'absent'\`.
    c. If the user mentions 'มา' or 'มาทำงาน' (present), use operator \`=\` with value \`'present'\`.
    d. Do NOT use \`LIKE\` for this column.

Examples:
- "Show all employees" -> {"type": "SELECT", "table": "employees"}
- "Find employees in IT department" -> {
    "type": "SELECT", 
    "table": "employees", 
    "conditions": {
      "department": {"operator": "LIKE", "value": "%IT%"}
    }
  }
- "Search for employee named John" -> {
    "type": "SELECT",
    "table": "employees",
    "conditions": {
      "first_name": {"operator": "LIKE", "value": "%John%"},
      "last_name": {"operator": "LIKE", "value": "%John%"}
    },
    "operator": "OR"
  }
- "Show attendance for employee ID 1" -> {
    "type": "SELECT", 
    "table": "attendance", 
    "conditions": {
      "emp_id": {"operator": "=", "value": 1}
    }
  }
- "What time did Malee Khayan come to work on 2024-01-02?" -> {
    "type": "SELECT",
    "table": "attendance",
    "columns": ["check_in"],
    "conditions": {
      "date": {"operator": "=", "value": "2024-01-02"},
      "emp_id": {
        "operator": "=",
        "value": "(SELECT emp_id FROM employees WHERE first_name LIKE '%มาลี%' AND last_name LIKE '%ขยัน%')"
      }
    }
  }
- "Who was absent or late in January 2024?" -> {
    "type": "SELECT",
    "table": "attendance",
    "columns": ["emp_id", "date", "check_in"],
    "conditions": {
      "date": {"operator": "BETWEEN", "value": "2024-01-01 AND 2024-01-31"},
      "status": {"operator": "=", "value": "late"}
    }
  }

User query: "${userQuery}"

Respond only with the JSON object, no other text.
`

  const result = await model.generateContent(systemPrompt)
  const response = result.response.text()
  
  try {
    return JSON.parse(response?.replace('```json', '').replace('```', '').trim())
  } catch (error) {
    console.error('Failed to parse AI response:', response)
    throw new Error('Could not understand the query')
  }
}

export async function formatResultsAsNaturalLanguage(
  query: string, 
  results: any[], 
  queryStructure: DatabaseQuery,
  personalized: boolean = false
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: process.env.MODEL_NAME || "gemini-1.5-flash" })

  const prompt = `
Convert the following database query results into a natural, conversational response in Thai language.

Original user question: "${query}"
Database results: ${JSON.stringify(results, null, 2)} // These results might include an 'employee_full_name' field.
Query structure: ${JSON.stringify(queryStructure, null, 2)}
Personalized: ${personalized} // Indicates if this is a personalized query for the current user

Guidelines:
- Respond in Thai language.
- Be conversational and friendly.
- Summarize the data clearly.
- If an 'employee_full_name' field and 'emp_id' are present in a result item, refer to the employee as '{employee_full_name} รหัสพนักงาน {emp_id}'. For example, 'สมชาย ใจดี รหัสพนักงาน 123...'.
- If 'employee_full_name' is not available but 'emp_id' is, use 'รหัสพนักงาน {emp_id}'.
- When referring to an employee ID, always use the term 'รหัสพนักงาน' followed by the ID number.
- If there are many results, provide a summary with key insights.
- If no results, explain that no data was found.
- Format numbers appropriately (commas for thousands, etc.).
- For salary data, use Thai Baht format.

Example formats:
- "พบพนักงานทั้งหมด 13 คน ในระบบค่ะ"
- "พนักงานในแผนก IT มีทั้งหมด 4 คนค่ะ"
- "ข้อมูลการเข้างานของ สมชาย ใจดี รหัสพนักงาน 101 ในเดือนที่ผ่านมาคือ..."
- "รหัสพนักงาน 102 มาสายวันที่ 5 มกราคม..." (if name was not available)
- "ในเดือนมกราคม ปี 2024 มีพนักงานขาดงานหรือมาสายดังนี้ค่ะ:\n  * สมใจ รักงานดี รหัสพนักงาน 1 มาสายวันที่ 3 มกราคม และขาดงานวันที่ 8 มกราคม\n  * อารี เก่งมาก รหัสพนักงาน 3 มาสายวันที่ 4 มกราคม"
`

  const result = await model.generateContent(prompt)
  return result.response.text()
}