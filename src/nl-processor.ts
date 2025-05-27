import { GoogleGenerativeAI } from "@google/generative-ai"
import { DatabaseQuery } from './database-helper'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

export async function parseNaturalLanguageQuery(userQuery: string): Promise<DatabaseQuery> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

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
  "conditions": {"column": "value"} (optional),
  "orderBy": [{"column": "column_name", "direction": "asc|desc"}] (optional),
  "limit": number (optional)
}

Examples:
- "Show all employees" -> {"type": "SELECT", "table": "employees"}
- "Count employees in IT department" -> {"type": "COUNT", "table": "employees", "conditions": {"department": "IT"}}
- "Show attendance for employee ID 1" -> {"type": "SELECT", "table": "attendance", "conditions": {"emp_id": 1}}

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
  queryStructure: DatabaseQuery
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  const prompt = `
Convert the following database query results into a natural, conversational response in Thai language.

Original user question: "${query}"
Database results: ${JSON.stringify(results, null, 2)}
Query structure: ${JSON.stringify(queryStructure, null, 2)}

Guidelines:
- Respond in Thai language
- Be conversational and friendly
- Summarize the data clearly
- If there are many results, provide a summary with key insights
- If no results, explain that no data was found
- Format numbers appropriately (commas for thousands, etc.)
- For salary data, use Thai Baht format

Example formats:
- "พบพนักงานทั้งหมด 13 คน ในระบบ"
- "พนักงานในแผนก IT มีทั้งหมด 4 คน"
- "ข้อมูลการเข้างานของพนักงาน สมชาย ใจดี ในเดือนที่ผ่านมา..."
`

  const result = await model.generateContent(prompt)
  return result.response.text()
}