import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

const MODEL_NAME = process.env.MODEL_NAME || "gemini-1.5-flash"; // Or "gemini-1.0-pro", "gemini-1.5-flash", "gemini-1.5-pro" etc.
const API_KEY = process.env.GOOGLE_API_KEY || "";

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { message, history } = await req.json(); // Expect a message and optional history

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // For a simple one-off query:
    // const result = await model.generateContent(message);
    // const response = result.response;
    // const text = response.text();

    // For conversational chat (maintaining context):
    const chat = model.startChat({
      history: history || [], // Pass previous conversation turns
      generationConfig: {
        maxOutputTokens: 300, // Adjust as needed
      },
      // Optional: Safety settings
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({ reply: text });
  } catch (error) {
    const errorInfo = new Error()
    const stackLine = errorInfo.stack?.split('\n')[1]?.trim()
    
    console.error(`[${new Date().toISOString()}] [ERROR] [${__filename}] [${stackLine || 'unknown:0:0'}] Error calling Gemini API:`, error);
    
    let errorMessage = "Failed to get response from AI";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
