import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, X, Lock, Delete, Loader2 } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { useTheme } from '../contexts/ThemeContext';

export default function AdminPinModal() {
  const { isPinScreenOpen, closePinScreen, verifyPin } = useAdmin();
  const { theme } = useTheme();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (isPinScreenOpen) {
      setPin('');
      setErrorMessage('');
      setLoading(false);
      setIsShaking(false);
      try {
        window.AndroidEdgeToEdge?.setStatusBarTheme?.('dark');
      } catch {}
      return () => {
        try {
          window.AndroidEdgeToEdge?.setStatusBarTheme?.(theme);
        } catch {}
      };
    }
  }, [isPinScreenOpen, theme]);

  const submitPin = useCallback(
    async (candidatePin) => {
      if (candidatePin.length !== 6 || loading) return;

      setLoading(true);
      setErrorMessage('');

      try {
        const res = await verifyPin(candidatePin);
        if (!res.success) {
          setIsShaking(true);
          setErrorMessage(res.error || 'Incorrect PIN. Access denied.');
          setTimeout(() => setIsShaking(false), 500);
          setTimeout(() => setPin(''), 550);
        }
      } catch (err) {
        setIsShaking(true);
        setErrorMessage(err.message || 'Verification failed. Please try again.');
        setTimeout(() => setIsShaking(false), 500);
        setTimeout(() => setPin(''), 550);
      } finally {
        setLoading(false);
      }
    },
    [loading, verifyPin]
  );

  const handleDigitPress = (digit) => {
    if (loading) return;
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setErrorMessage('');
      setPin(nextPin);
      if (nextPin.length === 6) {
        submitPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  };

  // Hardware Escape, NumPad, & Keyboard support
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isPinScreenOpen) return;
      if (e.key === 'Escape') {
        closePinScreen();
      } else if (/^[0-9]$/.test(e.key)) {
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinScreenOpen, pin, loading]);

  if (!isPinScreenOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#000000] text-white flex flex-col justify-between items-center px-4 py-4 sm:py-6 safe-area-top safe-area-bottom select-none overflow-hidden"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Top-Left Ambient Cyan Curved Light Effect */}
      <div className="absolute top-0 left-0 w-64 h-64 pointer-events-none overflow-hidden select-none z-0">
        <svg className="w-full h-full opacity-65" viewBox="0 0 200 200" fill="none">
          <path
            d="M -30,10 C 50,30 110,80 125,210"
            stroke="url(#cyan-grad-tl)"
            strokeWidth="3.5"
            filter="url(#glow-tl)"
          />
          <path
            d="M -20,0 C 60,20 120,70 135,200"
            stroke="url(#cyan-grad-tl2)"
            strokeWidth="1.2"
          />
          <defs>
            <filter id="glow-tl" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="cyan-grad-tl" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#008B9A" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="cyan-grad-tl2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="1" />
              <stop offset="80%" stopColor="#00E5FF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Bottom-Right Ambient Cyan Curved Light Effect */}
      <div className="absolute bottom-0 right-0 w-64 h-64 pointer-events-none overflow-hidden select-none z-0">
        <svg className="w-full h-full opacity-65" viewBox="0 0 200 200" fill="none">
          <path
            d="M 230,190 C 150,170 90,120 75,-10"
            stroke="url(#cyan-grad-br)"
            strokeWidth="3.5"
            filter="url(#glow-br)"
          />
          <path
            d="M 220,200 C 140,180 80,130 65,0"
            stroke="url(#cyan-grad-br2)"
            strokeWidth="1.2"
          />
          <defs>
            <filter id="glow-br" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="cyan-grad-br" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#008B9A" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="cyan-grad-br2" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="1" />
              <stop offset="80%" stopColor="#00E5FF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Header Bar */}
      <header className="w-full max-w-sm flex items-center justify-between z-10 pt-1 px-2">
        <button
          type="button"
          onClick={closePinScreen}
          className="p-2 -ml-2 rounded-full text-white hover:text-[#00E5FF] hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
          title="Back to Home"
          aria-label="Back to Home"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <button
          type="button"
          onClick={closePinScreen}
          className="p-2 -mr-2 rounded-full text-white hover:text-[#00E5FF] hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
          title="Close"
          aria-label="Close"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </header>

      {/* Main Content Area: Logo, PIN Indicators, and Keypad lifted up */}
      <div className="w-full max-w-xs flex flex-col items-center z-10 my-auto text-center">
        {/* Application Logo inside Circular Cyan Outline with Glow */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full p-[2.5px] border-2 border-[#00E5FF] shadow-[0_0_26px_rgba(0,229,255,0.5)] bg-black flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png"
              alt="MoonLight Strikers"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </div>

        {/* 6 Circular PIN Indicators */}
        <div
          className={`flex items-center justify-center gap-4 mb-2 transition-transform ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-[#00E5FF] shadow-[0_0_10px_#00E5FF] scale-110 border-0'
                    : 'border-[1.5px] border-slate-500 bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {/* Dynamic Verification / Error Alert */}
        <div className="h-6 flex items-center justify-center mb-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#00E5FF] animate-fadeIn">
              <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" />
              <span>Verifying MPIN...</span>
            </div>
          ) : errorMessage ? (
            <div className="px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold animate-fadeIn">
              {errorMessage}
            </div>
          ) : null}
        </div>

        {/* Numeric Keypad lifted higher up */}
        <div className="w-full max-w-xs pt-1">
          <div className="grid grid-cols-3 gap-y-3.5 sm:gap-y-4 gap-x-5 sm:gap-x-7 justify-items-center">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitPress(digit)}
                className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-[#0a121c] border-[1.5px] border-[#00E5FF]/60 hover:border-[#00E5FF] flex items-center justify-center text-2xl sm:text-3xl font-semibold text-white shadow-[0_0_12px_rgba(0,229,255,0.12)] active:scale-95 active:bg-[#0f2133] active:border-[#00E5FF] active:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all cursor-pointer font-sans select-none"
              >
                {digit}
              </button>
            ))}

            {/* Empty spacer for bottom-left */}
            <div className="w-16 h-16 sm:w-[72px] sm:h-[72px]" />

            {/* 0 Key */}
            <button
              type="button"
              onClick={() => handleDigitPress('0')}
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-[#0a121c] border-[1.5px] border-[#00E5FF]/60 hover:border-[#00E5FF] flex items-center justify-center text-2xl sm:text-3xl font-semibold text-white shadow-[0_0_12px_rgba(0,229,255,0.12)] active:scale-95 active:bg-[#0f2133] active:border-[#00E5FF] active:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all cursor-pointer font-sans select-none"
            >
              0
            </button>

            {/* Backspace Key */}
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Backspace"
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-[#0a121c] border-[1.5px] border-[#00E5FF]/60 hover:border-[#00E5FF] flex items-center justify-center text-white shadow-[0_0_12px_rgba(0,229,255,0.12)] active:scale-95 active:bg-[#0f2133] active:border-[#00E5FF] active:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all cursor-pointer select-none"
            >
              <Delete className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
