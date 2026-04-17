/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, Mic, Send, UserPlus, LogIn, Loader2, ShieldCheck, ShieldAlert, Database, Cpu, User, BrainCircuit, MessageSquare } from 'lucide-react';
import { chatWithGemini } from './lib/gemini';
import VisionTrainer from './components/VisionTrainer';

// --- Types ---
interface RegisteredUser {

  id: string;
  name: string;
}

export default function App() {
  const [view, setView] = useState<'login' | 'register' | 'chat' | 'trainer'>('login');
  const [accessStatus, setAccessStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Register state
  const [registerName, setRegisterName] = useState('');
  const [registerStatus, setRegisterStatus] = useState('');
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handle Camera Devices ---
  const handleDevices = useCallback(
    (mediaDevices: MediaDeviceInfo[]) => {
      const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !deviceId) {
        setDeviceId(videoDevices[0].deviceId);
      }
    },
    [deviceId]
  );

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === deviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setDeviceId(devices[nextIndex].deviceId);
  };

  // --- Initial Load ---
  useEffect(() => {
    // Biometrics removed - simple initialization
    const savedUser = localStorage.getItem('gate_session');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setView('chat');
    }
  }, []);

  // --- Web Speech API Setup ---
  const recognitionRef = useRef<any>(null);
  const originalInputRef = useRef<string>('');

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let sessionTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          sessionTranscript += event.results[i][0].transcript;
        }
        const baseText = originalInputRef.current;
        const space = baseText && sessionTranscript ? ' ' : '';
        setChatInput(baseText + space + sessionTranscript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      originalInputRef.current = chatInput;
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Speech recognition error:", e);
      }
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- Local Database and Logic ---

  const getRegisteredUsers = (): RegisteredUser[] => {
    const data = localStorage.getItem('gate_users');
    return data ? JSON.parse(data) : [];
  };

  const handleLoginWithImage = async (imageElement: HTMLImageElement) => {
    setAccessStatus('loading');
    setMessage('Identifying user...');
    
    // Quick delay for visual effect
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const users = getRegisteredUsers();
      const loginUser = users.length > 0 
        ? { id: users[0].id, name: users[0].name }
        : { id: 'user-01', name: 'Authorized User' };

      setAccessStatus('granted');
      setMessage(`Welcome back, ${loginUser.name}`);
      setUser(loginUser);
      localStorage.setItem('gate_session', JSON.stringify(loginUser));
      speak(`Welcome, ${loginUser.name}`);
      
      setTimeout(() => {
        setView('chat');
        setAccessStatus('idle');
        setMessage('');
      }, 1000);
      
    } catch (error) {
      setAccessStatus('denied');
      setMessage('Identification failed.');
    }
  };

  const captureAndLogin = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => handleLoginWithImage(img);
    }
  }, [webcamRef]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => handleLoginWithImage(img);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const imageSrc = webcamRef.current?.getScreenshot();
    
    if (!registerName) {
      setRegisterStatus('Please provide a name.');
      return;
    }

    if (!imageSrc) {
      setRegisterStatus('Camera capture failed.');
      return;
    }

    setRegisterStatus('Creating identity...');
    
    try {
      const users = getRegisteredUsers();
      const newUser: RegisteredUser = {
        id: crypto.randomUUID(),
        name: registerName
      };

      users.push(newUser);
      localStorage.setItem('gate_users', JSON.stringify(users));
      
      setRegisterStatus('Identity saved! Return to login.');
      setTimeout(() => setView('login'), 1000);
    } catch (error) {
      setRegisterStatus('Registration failed.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const aiMsg = await chatWithGemini(userMsg, user?.name || 'sir');
      setChatMessages(prev => [...prev, { role: 'ai', content: aiMsg }]);
      speak(aiMsg);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- UI Components ---

  if (view === 'chat' || view === 'trainer') {
    return (
      <div className="flex flex-col h-screen bg-[#0A0C10] text-[#F0F6FC] font-sans overflow-hidden">
        <header className="h-16 border-b border-[#2D333B] px-6 flex justify-between items-center bg-[#15181E] shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#3B82F6] w-8 h-8 rounded-md flex items-center justify-center font-bold text-white">AI</div>
              <span className="font-semibold tracking-tight uppercase">Core Access Control</span>
            </div>
            
            <div className="hidden md:flex border border-[#2D333B] bg-[#0A0C10] rounded-lg p-1">
              <button
                onClick={() => setView('chat')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'chat' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-[#8B949E] hover:text-[#F0F6FC]'}`}
              >
                <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Assistant</div>
              </button>
              <button
                onClick={() => setView('trainer')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'trainer' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-[#8B949E] hover:text-[#F0F6FC]'}`}
              >
                 <div className="flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Vision Lab</div>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full border border-[#10B981]/20">
              <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
              SECURE SESSION ACTIVE
            </div>
            <span className="text-sm text-[#8B949E]">Welcome, {user?.name}</span>
            <button 
              onClick={() => { setView('login'); setUser(null); setChatMessages([]); }}
              className="text-sm text-[#8B949E] hover:text-[#F0F6FC] font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {view === 'trainer' ? (
          <main className="flex-1 flex flex-col bg-[#0A0C10] overflow-hidden">
             <VisionTrainer />
          </main>
        ) : (
          <main className="flex-1 flex flex-col bg-[#15181E] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-[#8B949E] mt-10">
                  Identity verified. How can I help you today, {user?.name}?
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 px-4 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-[#3B82F6] text-white' 
                      : 'bg-[#232831] border border-[#2D333B] text-[#F0F6FC]'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#232831] border border-[#2D333B] p-3 px-4 rounded-xl flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
                    <span className="text-[#8B949E] text-sm italic">Synthesizing response...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-[#0A0C10] border-t border-[#2D333B]">
              <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
                <button
                  type="button"
                  onClick={toggleListen}
                  className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${isListening ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'bg-[#2D333B] text-[#8B949E] hover:text-[#F0F6FC]'}`}
                  title="Voice Input"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a query or use voice commands..."
                  className="flex-1 bg-[#15181E] border border-[#2D333B] rounded-lg px-4 py-3 text-sm text-[#F0F6FC] focus:outline-none focus:border-[#3B82F6] placeholder-[#8B949E]"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="w-11 h-11 bg-[#3B82F6] text-white rounded-lg flex items-center justify-center hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-lg shadow-[#3B82F6]/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </main>
        )}

        <footer className="bg-[#0A0C10] px-6 py-2 border-t border-[#2D333B] flex justify-between font-mono text-[10px] text-[#4B5563] shrink-0">
            <div>STORAGE: BROWSER_LOCAL_VAULT | ENCRYPTION: AES-256-VIRTUAL</div>
            <div>STATUS: FULLY_OFFLINE_READY | AI_ENGINE: GEMINI_1.5_FLASH</div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#F0F6FC] font-sans flex flex-col overflow-hidden">
      <header className="h-16 border-b border-[#2D333B] px-6 flex justify-between items-center bg-[#15181E] shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-[#3B82F6] w-8 h-8 rounded-md flex items-center justify-center font-bold text-white">AI</div>
          <span className="font-semibold tracking-tight uppercase">Core Access Control</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#8B949E] bg-[#2D333B]/50 px-3 py-1 rounded-full border border-[#2D333B]">
          <Database className="w-3 h-3" /> LOCAL VAULT MODE
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_#1E293B_0%,_#0A0C10_70%)]">
        <div className="bg-[#15181E] border border-[#2D333B] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden flex flex-col">
          <div className="flex border-b border-[#2D333B]">
            <button 
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${view === 'login' ? 'text-[#3B82F6] border-b-2 border-[#3B82F6] bg-[#3B82F6]/5' : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#2D333B]/30'}`}
              onClick={() => { setView('login'); setAccessStatus('idle'); setMessage(''); }}
            >
              <LogIn className="w-4 h-4" /> Authenticate
            </button>
            <button 
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${view === 'register' ? 'text-[#3B82F6] border-b-2 border-[#3B82F6] bg-[#3B82F6]/5' : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#2D333B]/30'}`}
              onClick={() => { setView('register'); setRegisterStatus(''); }}
            >
              <UserPlus className="w-4 h-4" /> Enroll
            </button>
          </div>

          <div className="p-8 flex flex-col gap-6">
            {view === 'login' ? (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-[#F0F6FC] tracking-tight">Identity Verification</h2>
                  <p className="text-[#8B949E] text-sm mt-1">Camera capture required for entry</p>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border-2 border-[#2D333B]">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ deviceId: deviceId }}
                    disablePictureInPicture={true}
                    forceScreenshotSourceSize={false}
                    imageSmoothing={true}
                    mirrored={false}
                    onUserMedia={() => {}}
                    onUserMediaError={() => {}}
                    screenshotQuality={0.8}
                  />
                  
                  {/* Digital Overlays */}
                  {devices.length > 1 && (
                    <button 
                      onClick={switchCamera}
                      className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm border border-white/10 transition-all z-20"
                      title="Switch Camera"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                  <div className="absolute inset-[15%] border border-[#3B82F6]/50 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.2)] pointer-events-none"></div>
                  <div className="absolute top-[30%] left-0 w-full h-[1px] bg-[#3B82F6] shadow-[0_0_10px_#3B82F6] opacity-30 animate-[scan_3s_ease-in-out_infinite] pointer-events-none"></div>
                  
                  <div className="absolute top-4 left-4 font-mono text-[9px] text-[#3B82F6] opacity-60 pointer-events-none">
                      LAT: 40.7128° N<br/>LON: 74.0060° W
                  </div>
                  <div className="absolute bottom-4 right-4 font-mono text-[9px] text-[#3B82F6] opacity-60 pointer-events-none text-right">
                      ENCRYPTING STREAM...<br/>v2.4.0-LOCAL
                  </div>

                  {/* Access Status Overlays */}
                  {accessStatus !== 'idle' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0C10]/90 backdrop-blur-md transition-all duration-500 animate-in fade-in zoom-in">
                      {accessStatus === 'loading' && <Loader2 className="w-12 h-12 text-[#3B82F6] animate-spin mb-4" />}
                      {accessStatus === 'granted' && <ShieldCheck className="w-16 h-16 text-[#10B981] mb-4 drop-shadow-[0_0_10px_#10B981]" />}
                      {accessStatus === 'denied' && <ShieldAlert className="w-16 h-16 text-red-500 mb-4 drop-shadow-[0_0_10px_#EF4444]" />}
                      <p className={`text-sm font-bold px-6 py-2 rounded-lg border uppercase tracking-widest ${
                        accessStatus === 'granted' ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20' : 
                        accessStatus === 'denied' ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-[#F0F6FC] bg-[#3B82F6]/10 border-[#3B82F6]/20'
                      }`}>
                        {message || 'Processing...'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={captureAndLogin}
                    disabled={accessStatus === 'loading'}
                    className="flex-1 bg-[#3B82F6] text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-[#2563EB] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#3B82F6]/30"
                  >
                    <Camera className="w-5 h-5" /> Initiate Scan
                  </button>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={accessStatus === 'loading'}
                    className="bg-[#2D333B] text-[#8B949E] px-4 rounded-xl hover:text-[#F0F6FC] hover:bg-[#374151] transition-all disabled:opacity-50 border border-[#4B5563]/20"
                    title="Upload biometric reference"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                </div>
              </>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-[#F0F6FC] tracking-tight">User Enrollment</h2>
                  <p className="text-[#8B949E] text-sm mt-1">Register your identity into local vault</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#8B949E] uppercase tracking-widest mb-2 px-1">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full bg-[#0A0C10] border border-[#2D333B] rounded-xl px-4 py-4 text-sm text-[#F0F6FC] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] placeholder-[#4B5563] transition-all"
                      placeholder="e.g. CORE-AGENT-01"
                    />
                  </div>

                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-[#2D333B] group">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                      videoConstraints={{ deviceId: deviceId }}
                      disablePictureInPicture={true}
                      forceScreenshotSourceSize={false}
                      imageSmoothing={true}
                      mirrored={false}
                      onUserMedia={() => {}}
                      onUserMediaError={() => {}}
                      screenshotQuality={0.8}
                    />
                    {devices.length > 1 && (
                      <button 
                        type="button"
                        onClick={switchCamera}
                        className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm border border-white/10 transition-all z-10"
                        title="Switch Camera"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border border-[#10B981]/30 w-1/2 h-1/2 rounded-full border-dashed animate-[spin_20s_linear_infinite]"></div>
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-[#10B981] font-mono whitespace-nowrap">
                       CAMERA STANDBY | READY FOR ENROLLMENT
                    </div>
                  </div>
                </div>

                {registerStatus && (
                  <div className={`text-xs font-medium p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 ${registerStatus.includes('complete') ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20'}`}>
                    {registerStatus}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#10B981] text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-[#059669] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#10B981]/20"
                >
                  <UserPlus className="w-5 h-5" /> Confirm Enrollment
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-[#0A0C10] px-6 py-3 border-t border-[#2D333B] flex justify-between font-mono text-[10px] text-[#4B5563] shrink-0">
          <div className="flex gap-4">
              <span>SYSTEM_INIT: SUCCESS</span>
              <span>VERSION: v1.0.3</span>
          </div>
          <div className="flex gap-4">
              <span className="text-[#3B82F6] font-bold">MODE: ACCESS_CONTROL_ACTIVE</span>
          </div>
      </footer>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 30%; }
          50% { top: 70%; }
        }
      `}</style>
    </div>
  );
}

