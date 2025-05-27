"use client"

import { useState, FormEvent, useRef, useEffect } from "react"

interface Message {
  id: string
  text: string
  sender: "user" | "ai"
  type?: "database" | "general"
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatMode, setChatMode] = useState<"general" | "database">("general")
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<null | HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: "user",
      type: chatMode
    }
    
    setMessages((prevMessages) => [...prevMessages, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      const endpoint = chatMode === "database" ? "/api/database-chat" : "/api/chat"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `API request failed`)
      }

      const data = await response.json()

      if (data.reply) {
        const aiMessage: Message = {
          id: Date.now().toString() + "ai",
          text: data.reply,
          sender: "ai",
          type: chatMode
        }
        setMessages((prevMessages) => [...prevMessages, aiMessage])
      }
    } catch (err: any) {
      console.error("Error in handleSubmit:", err)
      const errorMessage = err.message || "เกิดข้อผิดพลาดในการประมวลผล"
      setError(errorMessage)
      
      const errorMessageObj: Message = {
        id: Date.now().toString() + "error",
        text: `ข้อผิดพลาด: ${errorMessage}`,
        sender: "ai",
        type: chatMode
      }
      setMessages((prevMessages) => [...prevMessages, errorMessageObj])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 bg-gray-900 text-white">
      <div className="mb-4 flex justify-center">
        <div className="bg-gray-800 rounded-lg p-1 flex">
          <button
            onClick={() => setChatMode("general")}
            className={`px-4 py-2 rounded-md transition-colors ${
              chatMode === "general"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            💬 แชททั่วไป
          </button>
          <button
            onClick={() => setChatMode("database")}
            className={`px-4 py-2 rounded-md transition-colors ${
              chatMode === "database"
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            📊 ถาม Database
          </button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-center mb-6">
        {chatMode === "database" ? (
          <span className="text-green-400">🗄️ HR Database Assistant</span>
        ) : (
          <span className="text-blue-400">🤖 AI Chat Assistant</span>
        )}
      </h1>

      <div className="flex-grow overflow-y-auto mb-4 p-4 bg-gray-800 rounded-lg space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            {chatMode === "database" ? (
              <div>
                <p className="mb-2">ถามข้อมูลพนักงาน การเข้างาน เงินเดือน และอื่นๆ</p>
                <p className="text-sm">ตอบอย่าง: "แสดงพนักงานทั้งหมด", "นับพนักงานแผนก IT", "ข้อมูลการเข้างานของพนักงาน ID 1"</p>
              </div>
            ) : (
              <p>เริ่มต้นการสนทนาด้วย AI Assistant</p>
            )}
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl ${
                msg.sender === "user"
                  ? chatMode === "database"
                    ? "bg-green-600 text-white"
                    : "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-200"
              }`}
            >
              <p style={{ whiteSpace: "pre-wrap" }}>{msg.text}</p>
              {msg.type && (
                <span className="text-xs opacity-75 block mt-1">
                  {msg.type === "database" ? "📊" : "💬"}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-2 text-center">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            chatMode === "database"
              ? "ถามข้อมูลจาก database..."
              : "ถาม AI อะไรก็ได้..."
          }
          className="flex-grow p-3 rounded-lg bg-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ${
            chatMode === "database"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700"
          } text-white`}
        >
          {isLoading ? "..." : "ส่ง"}
        </button>
      </form>
      
      <p className="text-xs text-gray-500 mt-2 text-center">
        {chatMode === "database" ? "📊 HR Database Assistant" : "🤖 Powered by Google Gemini"}
      </p>
    </div>
  )
}