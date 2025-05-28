import { NextRequest, NextResponse } from "next/server"
import { parseNaturalLanguageQuery, formatResultsAsNaturalLanguage } from "@/nl-processor"
import { executeQuery, DatabaseQuery } from "@/database-helper"

// Regular expressions to identify personal questions
const PERSONAL_QUESTION_PATTERNS = [
  /ฉัน|\bของฉัน\b|\bผม\b|\bดิฉัน\b|\bตัวเอง\b/i,  // 'I', 'my', 'myself' in Thai
  /\bเรา\b|\bพวกเรา\b|\bของเรา\b/i,  // 'we', 'our', 'ourselves' in Thai
  /\bการเข้างานของฉัน\b|\bวันลาของฉัน\b|\bเงินเดือนของฉัน\b/i,  // 'my attendance', 'my leave', 'my salary' in Thai
  /\bมาทำงาน\b|\bขาดงาน\b|\bลางาน\b/i  // 'come to work', 'absent', 'take leave' in Thai
]

// Patterns to detect when a user is trying to access other people's data
const OTHER_EMPLOYEE_PATTERNS = [
  /\bเงินเดือน\b.*?\b(\d+|\bของ.*?)\b/i,  // salary of someone/ID
  /\bพนักงาน\b.*?\b\d+\b/i,  // employee with ID
  /\bข้อมูล\b.*?(\bของ\b|\bสมชาย\b|\bสมหญิง\b|\bนาย\b|\bนาง\b|\bนางสาว\b)/i,  // data of someone
  /\bของเพื่อน\b/i,  // colleague's data
  /\bของแผนก\b/i  // department's data
]


export async function POST(req: NextRequest) {
  try {
    const { message, employeeId } = await req.json()
    console.log("message: ", message)
    console.log("employeeId: ", employeeId)

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }
    // Check if an employee is selected and if they're trying to access another employee's data
    const isAccessingOtherEmployeeData = employeeId && OTHER_EMPLOYEE_PATTERNS.some(pattern => pattern.test(message))
    
    // If a specific employee is selected and they're trying to access other employees' data,
    // restrict access with a security message
    if (isAccessingOtherEmployeeData) {
      return NextResponse.json({ 
        reply: "ฉันไม่สามารถเข้าถึงข้อมูลของพนักงานคนอื่นได้ ขออภัยในความไม่สะดวกนี้",
        restricted: true
      })
    }
    
    // Check if the question is personal and requires employee context
    const isPersonalQuestion = PERSONAL_QUESTION_PATTERNS.some(pattern => pattern.test(message))
    console.log("isPersonalQuestion : ", isPersonalQuestion)
    
    // Parse natural language query into database query
    const queryStructure = await parseNaturalLanguageQuery(message)
    
    // Check if this is a query searching for a name in both first_name and last_name
    // If so, use OR logic between these conditions
    if (queryStructure.table === 'employees' && 
        queryStructure.conditions && 
        queryStructure.conditions.first_name && 
        queryStructure.conditions.last_name && 
        typeof queryStructure.conditions.first_name === 'object' && 
        typeof queryStructure.conditions.last_name === 'object' && 
        'operator' in queryStructure.conditions.first_name && 
        'operator' in queryStructure.conditions.last_name && 
        'value' in queryStructure.conditions.first_name && 
        'value' in queryStructure.conditions.last_name && 
        queryStructure.conditions.first_name.operator === 'LIKE' && 
        queryStructure.conditions.last_name.operator === 'LIKE' && 
        queryStructure.conditions.first_name.value === queryStructure.conditions.last_name.value) {
      // Set conditionLogic to OR when searching for the same value in both first_name and last_name
      queryStructure.conditionLogic = 'OR'
    }
    
    // Handle personal questions asked when employeeId is null (e.g., admin context)
    if (isPersonalQuestion && !employeeId) {
      // The user's message implies a query about "themselves" (e.g., "my leave"),
      // but there's no current employee context.
      // Return an informative message instead of executing an ambiguous query.
      return NextResponse.json({
        // Assuming your client expects an 'answer' field for direct bot messages.
        // Adjust if your client expects a different structure (e.g., 'message' or 'data').
        answer: "It appears you're asking about personal information (e.g., using 'I' or 'my'). However, I don't have a specific employee context right now. If you're asking about a particular employee, please include their name or ID. Otherwise, you can ask a general HR question."
      }, { status: 200 }); // 200 OK as it's a valid bot response.
    }

    // Add employee filter if it's a personal question and employeeId is provided
    if (isPersonalQuestion && employeeId) {
      // Add employee filter to conditions
      if (!queryStructure.conditions) {
        queryStructure.conditions = {}
      }
      
      // Only add this condition if the query is on a table that has emp_id
      if (['employees', 'attendance', 'leave_requests', 'payroll', 'benefits'].includes(queryStructure.table)) {
        queryStructure.conditions.emp_id = { operator: '=', value: Number(employeeId) }
      }
    }
    
    // If no employeeId is provided, we're in admin mode - no restrictions
    // The query will execute as normal without any employee_id filtering (unless specifically requested)
    console.log("queryStructure : ", queryStructure)
    
    // Execute the database query
    let results = await executeQuery(queryStructure)
    console.log("results : ", results)

    // If results contain emp_id, fetch employee names and add them
    if (Array.isArray(results) && results.length > 0 && results[0].hasOwnProperty('emp_id')) {
      const empIds = [...new Set(results.map(r => r.emp_id).filter(id => id != null))];
      if (empIds.length > 0) {
        const employeeNameQuery: DatabaseQuery = {
          type: 'SELECT',
          table: 'employees',
          columns: ['emp_id', 'first_name', 'last_name'],
          conditions: {
            emp_id: { operator: 'IN', value: empIds }
          }
        };
        try {
          const employeeDetails = await executeQuery(employeeNameQuery);
          const employeeMap = new Map();
          // Define a type for employee details for clarity
          type EmployeeDetail = { emp_id: number; first_name?: string; last_name?: string };

          (employeeDetails as EmployeeDetail[]).forEach((emp: EmployeeDetail) => {
            employeeMap.set(emp.emp_id, `${emp.first_name || ''} ${emp.last_name || ''}`.trim());
          });

          results = results.map(r => ({
            ...r,
            employee_full_name: employeeMap.get(r.emp_id) || null
          }));
        } catch (nameQueryError) {
          console.error("Error fetching employee names:", nameQueryError);
          // Proceed without names if this fails, or handle error as appropriate
        }
      }
    }
    
    // Handle potentially null results from executeQuery
    const safeResults = results === null ? [] : results;
    const resultsCount = results === null ? 0 : results.length;

    // Format results as natural language
    const naturalLanguageResponse = await formatResultsAsNaturalLanguage(
      message, 
      safeResults, // Use the null-checked results
      queryStructure,
      employeeId ? true : false // Indicate if the query was personalized
    );

    return NextResponse.json({ 
      reply: naturalLanguageResponse,
      queryStructure,
      resultsCount: resultsCount, // Use the null-checked count
      personalized: isPersonalQuestion && employeeId ? true : false
    });

  } catch (error) {
    console.error("Database chat error:", error)
    
    let errorMessage = 'ขออภัย ไม่สามารถประมวลผลคำถามของคุณได้ กรุณาลองใหม่อีกครั้ง'
    
    if (error instanceof Error) {
      if (error.message.includes('Could not understand')) {
        errorMessage = "ขออภัย ไม่เข้าใจคำถามของคุณ กรุณาลองถามใหม่ด้วยคำที่ชัดเจนขึ้น"
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}