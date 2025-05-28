"use client"

import { useState, FormEvent, useRef, useEffect } from "react"
import { supabase } from "../supabase"
import TypingAnimation from "@/components/TypingAnimation"
import TokenVerification from "@/components/TokenVerification"; // Added import

interface Message {
  id: string
  text: string
  sender: "user" | "ai"
  type?: "database" | "general"
}

interface Employee {
  emp_id: number
  first_name: string
  last_name: string
  department: string
  position: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatMode, setChatMode] = useState<"general" | "database">("database")
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // State for token management
  const [tokenId, setTokenId] = useState<string>("");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [remainingQuestions, setRemainingQuestions] = useState<number>(0);
  const [questionsLog, setQuestionsLog] = useState<string>("");
  console.log("questionsLog : ", questionsLog)
  
  const fetchTokenInfo = async (currentTokenId: string) => {
    if (!currentTokenId) return;
    try {
      const response = await fetch(`/api/get-token-info?tokenId=${currentTokenId}`);
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error fetching token info:", errorData.error || "API request failed");
        // Optionally, set an error state for the user if this fetch fails silently
        // For now, it updates remainingQuestions to 0 if token is invalid or not found by API
        setRemainingQuestions(0);
        setQuestionsLog("");
        return;
      }
      const data = await response.json();
      if (data.total_questions !== undefined) {
        setRemainingQuestions(data.total_questions);
      }
      if (data.questions !== undefined) {
        setQuestionsLog(data.questions);
      }
    } catch (err) {
      console.error("Failed to fetch token info:", err);
      setRemainingQuestions(0); // Reset on error
      setQuestionsLog("");
    }
  };

  const handleTokenVerified = async (verifiedTokenId: string) => {
    setTokenId(verifiedTokenId);
    setIsVerified(true);
    localStorage.setItem('hrChatToken', verifiedTokenId);
    await fetchTokenInfo(verifiedTokenId); // Fetch info after verification
  };

  const handleTokenClear = () => {
    setTokenId("");
    setIsVerified(false);
    setRemainingQuestions(0);
    setQuestionsLog("");
    localStorage.removeItem('hrChatToken');
  };

  const messagesEndRef = useRef<null | HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  // console.log("setChatMode: ", setChatMode)
  // console.log("messagesContainerRef: ", messagesContainerRef)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages])
  
  // Fetch employees data on component mount
  useEffect(() => {
    // Attempt to load token from localStorage on initial mount
    const storedToken = localStorage.getItem('hrChatToken');
    if (storedToken) {
      setTokenId(storedToken);
      // TokenVerification component will handle actual verification using this initial tokenId
    }
  }, []);

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('emp_id, first_name, last_name, department, position')
        
        if (error) throw error
        if (data) setEmployees(data)
      } catch (err) {
        console.error('Error fetching employees:', err)
      }
    }
    
    fetchEmployees()
  }, [])

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
        body: JSON.stringify({ 
          message: input,
          employeeId: selectedEmployee?.emp_id || null,
          tokenId: chatMode === "database" ? tokenId : undefined // Send tokenId for database chat
        }),
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
      if (chatMode === "database" && tokenId && response.ok) {
        await fetchTokenInfo(tokenId);
      }
    } catch (err) {
      console.error("Error in handleSubmit:", err)
      const errorMessage = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประมวลผล"
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

  const handleQuestionClick = (question: string) => {
    // Set the input and immediately submit
    setInput(question)
    
    // Create a synthetic submit event
    setTimeout(() => {
      const userMessage: Message = {
        id: Date.now().toString(),
        text: question,
        sender: "user",
        type: chatMode
      }
      
      setMessages((prevMessages) => [...prevMessages, userMessage])
      setInput("")
      setIsLoading(true)
      setError(null)
      
      // Call the API directly without using the form
      const endpoint = chatMode === "database" ? "/api/database-chat" : "/api/chat"
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: question,
          employeeId: selectedEmployee?.emp_id || null,
          tokenId: chatMode === "database" ? tokenId : undefined // Send tokenId for database chat
        }),
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(errorData.error || `API request failed`)
          })
        }
        return response.json()
      })
      .then(data => {
        if (data.reply) {
          const aiMessage: Message = {
            id: Date.now().toString() + "ai",
            text: data.reply,
            sender: "ai",
            type: chatMode
          }
          setMessages((prevMessages) => [...prevMessages, aiMessage])
        }
      })
      .catch((err) => {
        console.error("Error in handleQuestionClick:", err)
        const errorMessage = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประมวลผล"
        setError(errorMessage)
        
        const errorMessageObj: Message = {
          id: Date.now().toString() + "error",
          text: `ข้อผิดพลาด: ${errorMessage}`,
          sender: "ai",
          type: chatMode
        }
        setMessages((prevMessages) => [...prevMessages, errorMessageObj])
      })
      .finally(() => {
        setIsLoading(false)
      })
    }, 0)
  }
  
  // Common questions for HR database chat
  const commonQuestionsIdentity = [
    "ฉันมีวันลาพักร้อนคงเหลือหกี่วัน",
    "ฉันมีวันลาป่วยคงเหลือกี่วัน",
    "ฉันมีวันลากิจคงเหลือกี่วัน",
    "เดือนนี้ฉันมาสายกี่ครั้ง",
    "ฉันได้สิทธิ์ประกันสุขภาพเท่าไหร่",
    "จำนวนชั่วโมงทำงานของฉันในสัปดาห์นี้"
  ]
  const commonQuestions = [
    "แสดงพนักงานทั้งหมดในแผนก IT",
    "ขอ email ประสิทธิ์",
    "ขอเบอร์โทรศัพท์ ปรีชา",
    "พนักงานคนไหนลาเยอะสุด",
    "พนักงานคนไหนขาดงานเยอะสุด",
    "เงินเดือนเฉลี่ยของพนักงานทุกคน",
    "แผนกไหนเงินเดือนเฉลี่ยเยอะสุด",
    "วันที่ 25 พฤษภาคม สมชายทำงานหรือไม่"
  ]

  if (!isVerified) {
    return (
      <TokenVerification
        isVerified={isVerified}
        setIsVerified={setIsVerified}
        tokenId={tokenId}
        setTokenId={setTokenId}
        remainingQuestions={remainingQuestions}
        setRemainingQuestions={setRemainingQuestions}
        setQuestions={setQuestionsLog} // This prop was named setQuestions in TokenVerificationProps
      />
    );
  }

  return (
    <div className="flex h-full bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white overflow-hidden">
      {/* Mobile menu button */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed z-20 top-4 left-4 bg-[#06C755] text-white p-2 rounded-full shadow-lg"
      >
        {isMobileMenuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Left sidebar with common questions */}
      <div className={`${isMobileMenuOpen ? 'fixed inset-0 z-10 bg-gray-900 bg-opacity-90' : 'hidden'} md:flex md:static md:w-80 flex-shrink-0 bg-gray-100 dark:bg-gray-800 overflow-y-auto flex flex-col p-4 border-r border-gray-200 dark:border-gray-700`}>
        <div className="mb-2 text-center">
          <h2 className="text-xl font-bold text-[#06C755] dark:text-[#06C755] mb-2">HR Chatbot</h2>
        </div>
        
        {/* Employee selector dropdown */}
        <div className="mb-6">
        <button
          onClick={handleTokenClear}
          className="w-full text-left p-3 mb-3 bg-white dark:bg-gray-700 hover:bg-[#e6f7ef] dark:hover:bg-[#05a648] rounded-lg shadow-sm transition duration-150 text-sm"
        >
         ⏻   Log out
        </button>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">สมมติตัวตน</label>
          <select 
            className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-[#06C755] focus:outline-none shadow-sm"
            value={selectedEmployee?.emp_id || ''}
            onChange={(e) => {
              const empId = parseInt(e.target.value)
              const emp = employees.find(e => e.emp_id === empId)
              setSelectedEmployee(emp || null)
            }}
          >
            <option value="">ไม่เลือกตัวตน</option>
            {employees.map(emp => (
              <option key={emp.emp_id} value={emp.emp_id}>
                {emp.first_name} {emp.last_name} ({emp.department})
              </option>
            ))}
          </select>
          {selectedEmployee && (
            <div className="mt-2 p-2 bg-[#e6f7ef] dark:bg-green-900 dark:bg-opacity-20 rounded-md">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                คุณกำลังใช้งานในฐานะ: <span className="font-semibold text-[#06C755] dark:text-[#06C755]">{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
              </p>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">ชุด preset คำถาม</h3>
          {(selectedEmployee ? commonQuestionsIdentity :commonQuestions).map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuestionClick(question)}
              className="w-full text-left p-3 bg-white dark:bg-gray-700 hover:bg-[#e6f7ef] dark:hover:bg-[#05a648] rounded-lg shadow-sm transition duration-150 text-sm"
            >
              {question}
            </button>
          ))
        }
        </div>

        {/* Spacer to push the download button to the bottom */}
        <div className="flex-grow mt-4"></div>
        
        {/* Download button at the bottom */}
        <button
          onClick={() => {
            // Create a link element to trigger the download
            const link = document.createElement('a');
            link.href = '/mock data.csv';
            link.download = 'mock_data.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="w-full text-left p-3 mt-3 bg-white dark:bg-gray-700 hover:bg-[#e6f7ef] dark:hover:bg-[#05a648] rounded-lg shadow-sm transition duration-150 text-sm"
        >
         📥 Download mock database as csv file
        </button>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 max-w-4xl mx-auto p-4">
        {/* ปิดไปก่อน */}
        {/* <div className="mb-4 flex justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-1 flex shadow-md">
          <button
              onClick={() => setChatMode("database")}
              className={`px-4 py-2 rounded-md transition-colors ${
                chatMode === "database"
                  ? "bg-[#06C755] text-white"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              📊 ถาม Database
            </button>
            <button
              onClick={() => setChatMode("general")}
              className={`px-4 py-2 rounded-md transition-colors ${
                chatMode === "general"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              💬 แชททั่วไป
            </button>
          </div>
        </div> */}

        <h1 className="text-2xl font-bold text-center mb-6">
          {chatMode === "database" ? (
            <span className="text-[#06C755] dark:text-[#06C755]">Questions {isVerified ? `(${remainingQuestions} left)` : ''}</span>
          ) : (
            <span className="text-blue-500 dark:text-blue-400">🤖 AI Chat Assistant</span>
          )}
          {selectedEmployee && chatMode === "database" && (
            <span className="block text-sm font-normal mt-1 text-gray-600 dark:text-gray-400">
              ข้อมูลส่วนตัวจะอ้างอิงจาก: {selectedEmployee.first_name} {selectedEmployee.last_name}
            </span>
          )}
        </h1>

        <div className="flex-1 overflow-y-auto space-y-4">
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
                      ? "bg-[#06C755] text-white"
                      : "bg-blue-500 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                }`}
              >
                <p style={{ whiteSpace: "pre-wrap" }}>{msg.text}</p>
                {/* {msg.type && (
                  <span className="text-xs opacity-75 block mt-1">
                    {msg.type === "database" ? "📊" : "💬"} {msg.sender === "user" && selectedEmployee ? `(${selectedEmployee.first_name})` : ""}
                  </span>
                )} */}
              </div>
            </div>
          ))}
          {isLoading && <TypingAnimation />}
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
                ? selectedEmployee
                  ? `สวัสดี ${selectedEmployee.first_name} คุณต้องการถามอะไร...`
                  : "ถามข้อมูลจาก database..."
                : "ถามอะไรก็ฉันก็ได้ได้..."
            }
            className="flex-grow p-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#06C755] focus:border-[#06C755] focus:outline-none shadow-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ${
              chatMode === "database"
                ? "bg-[#06C755] hover:bg-[#05a648]"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white shadow-sm`}
          >
            {isLoading ? "..." : "ส่ง"}
          </button>
        </form>
      
        <p className="text-xs text-gray-500 mt-2 text-center">
          {selectedEmployee && chatMode === "database" && (
            <span className="ml-2">• สวัสดี {selectedEmployee.first_name}</span>
          )}
        </p>
      </div>
    </div>
  )
}