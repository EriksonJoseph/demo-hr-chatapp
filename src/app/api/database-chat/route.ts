import { NextRequest, NextResponse } from "next/server"
import { parseNaturalLanguageQuery, formatResultsAsNaturalLanguage } from "@/nl-processor"
import { executeQuery, DatabaseQuery } from "@/database-helper"


export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }
    // Parse natural language query into database query
    const queryStructure = await parseNaturalLanguageQuery(message)

    
    // Execute the database query
    let results = await executeQuery(queryStructure)

    // If results contain emp_id, fetch employee names and add them
    if (Array.isArray(results) && results.length > 0 && results[0].hasOwnProperty('emp_id')) {
      const empIds = [...new Set(results.map(r => r.emp_id).filter(id => id != null))];
      if (empIds.length > 0) {
        const employeeNameQuery: DatabaseQuery = {
          type: 'SELECT' as 'SELECT', // Cast to literal type
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
    
    // Format results as natural language
    const naturalLanguageResponse = await formatResultsAsNaturalLanguage(
      message, 
      results, 
      queryStructure
    )

    return NextResponse.json({ 
      reply: naturalLanguageResponse,
      queryStructure,
      resultsCount: results.length
    })

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