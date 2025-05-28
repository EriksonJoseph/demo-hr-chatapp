export default function TypingAnimation() {
  return (
    <div className="flex items-center space-x-2 p-4">
      <div className="flex space-x-2">
        <div 
          className="w-3 h-3 bg-gray-400 rounded-full" 
          style={{ 
            animation: 'typing 0.8s infinite',
            animationDelay: '0.1s'
          }} 
        />
        <div 
          className="w-3 h-3 bg-gray-400 rounded-full" 
          style={{ 
            animation: 'typing 0.8s infinite',
            animationDelay: '0.2s'
          }} 
        />
        <div 
          className="w-3 h-3 bg-gray-400 rounded-full" 
          style={{ 
            animation: 'typing 0.8s infinite',
            animationDelay: '0.3s'
          }} 
        />
      </div>
      <style jsx>{`
        @keyframes typing {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
      `}</style>
    </div>
  );
}
