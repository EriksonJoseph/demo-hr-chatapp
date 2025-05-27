// src/app/page.tsx
"use client"; // This marks the component as a Client Component

import { useState, FormEvent, useRef, useEffect } from "react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "gemini";
}

// Gemini expects history in a specific format
interface GeminiHistoryPart {
  role: "user" | "model";
  parts: { text: string }[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: "user",
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    // Prepare history for Gemini API
    const geminiHistory: GeminiHistoryPart[] = messages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input, history: geminiHistory }), // Send current message and history
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `API request failed with status ${response.status}`
        );
      }

      const data = await response.json();

      if (data.reply) {
        const geminiMessage: Message = {
          id: Date.now().toString() + "g",
          text: data.reply,
          sender: "gemini",
        };
        setMessages((prevMessages) => [...prevMessages, geminiMessage]);
      } else if (data.error) {
        // Handle cases where Gemini might block due to safety or other reasons
        setError(`Gemini: ${data.error}`);
        const geminiErrorMessage: Message = {
          id: Date.now().toString() + "g_err",
          text: `Error: ${data.error}`,
          sender: "gemini",
        };
        setMessages((prevMessages) => [...prevMessages, geminiErrorMessage]);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "An unexpected error occurred.");
      const systemErrorMessage: Message = {
        id: Date.now().toString() + "s_err",
        text: `Error: ${err.message || "Failed to connect"}`,
        sender: "gemini",
      };
      setMessages((prevMessages) => [...prevMessages, systemErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold text-center mb-6 text-purple-400">
        Gemini Chat
      </h1>

      <div className="flex-grow overflow-y-auto mb-4 p-4 bg-gray-800 rounded-lg space-y-4">
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
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-200"
              }`}
            >
              <p style={{ whiteSpace: "pre-wrap" }}>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* For auto-scrolling */}
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-2 text-center">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Gemini anything..."
          className="flex-grow p-3 rounded-lg bg-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
        >
          {isLoading ? (
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            "Send"
          )}
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Powered by Google Gemini
      </p>
    </div>
  );
}
