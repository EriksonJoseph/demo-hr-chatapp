"use client"

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabase';

interface TokenVerificationProps {
  isVerified: boolean;
  setIsVerified: (verified: boolean) => void;
  tokenId: string;
  setTokenId: (tokenId: string) => void;
  remainingQuestions: number;
  setRemainingQuestions: (count: number) => void;
  setQuestions: (questions: string) => void;
}

export default function TokenVerification({
  isVerified,
  setIsVerified,
  tokenId,
  setTokenId,
  remainingQuestions,
  setRemainingQuestions,
  setQuestions,
}: TokenVerificationProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Verify the token with the server to get the latest remaining questions count
  const verifyToken = useCallback(async (tokenToVerify: string = tokenId) => {
    if (!tokenToVerify.trim()) {
      setError("กรุณากรอก Token ID");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('tokens')
        .select('token_id, total_questions, questions')
        .eq('token_id', tokenToVerify)
        .single();
      if (queryError || !data) {
        setError("Token ไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
        setIsVerified(false);
        return;
      }
      setIsVerified(true);
      setRemainingQuestions(data.total_questions);
      setQuestions(data.questions || '');
      localStorage.setItem('hrChatToken', tokenToVerify);
    } catch (err) {
      console.error("Error verifying token:", err);
      setError("เกิดข้อผิดพลาดในการตรวจสอบ Token");
      setIsVerified(false);
    } finally {
      setLoading(false);
    }
  }, [tokenId, setIsVerified, setRemainingQuestions, setQuestions]);

  useEffect(() => {
    const storedToken = localStorage.getItem('hrChatToken');
    if (storedToken) {
      setTokenId(storedToken);
      verifyToken(storedToken);
    }
  }, [setTokenId, verifyToken]);

  const handleLogout = () => {
    localStorage.removeItem('hrChatToken');
    setIsVerified(false);
    setTokenId('');
    setRemainingQuestions(0);
    setQuestions('');
  };

  if (isVerified) {
    return (
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Token:</span> {tokenId.substring(0, 8)}...
          <span className="ml-2 font-medium">คำถามคงเหลือ:</span> {remainingQuestions}
        </div>
        <button 
          onClick={handleLogout}
          className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 transition"
        >
          ออกจากระบบ
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
      <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
          กรุณากรอก Token ID
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token ID
            </label>
            <input
              id="token"
              type="text"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="กรอก Token ID ของคุณที่นี่"
              className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#06C755] focus:border-[#06C755] focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          <button
            onClick={() => verifyToken()}
            disabled={loading}
            className="w-full font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 bg-[#06C755] hover:bg-[#05a648] text-white shadow-sm"
          >
            {loading ? "กำลังตรวจสอบ..." : "ยืนยัน Token"}
          </button>
        </div>
      </div>
    </div>
  );
}
