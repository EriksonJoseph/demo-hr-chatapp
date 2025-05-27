import { NextRequest, NextResponse } from "next/server"
import { parseNaturalLanguageQuery, formatResultsAsNaturalLanguage } from "@/nl-processor"
import { executeQuery } from "@/database-helper"

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
    const results = await executeQuery(queryStructure)
    
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
    
    let errorMessage = "ขออภัย ไม่สามารถประมวลผลคำถามของคุณได้ กรุณาลองใหม่อีกครั้ง"
    
    if (error instanceof Error) {
      if (error.message.includes('Could not understand')) {
        errorMessage = "ขออภัย ไม่เข้าใจคำถามของคุณ กรุณาลองถามใหม่ด้วยคำที่ชัดเจนขึ้น"
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}