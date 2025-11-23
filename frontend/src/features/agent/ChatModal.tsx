import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Mic, Video, User, Hospital, Camera, MapPin, Keyboard } from 'lucide-react';
import { useChatSession } from '../../hooks';
import { usePermissions } from '../../hooks';
import { useVoiceAgent } from '../../hooks/useVoiceAgent'; // Tu hook de voz
import { SUGGESTION_CHIPS } from '../../data/mockData';
import type { TriageOption } from '../../data/mockData';
import { TypingIndicator } from '../../components/ui';
import rimiAvatar from '../../assets/images/rimi-avatar.png';

interface ChatModalProps {
  toggleOpen: () => void;
}

export function ChatModal({ toggleOpen }: ChatModalProps) {
  // 1. Hooks de Lógica de Chat (Texto)
  // NOTA: Aquí extraemos 'addMessage' que agregamos al hook
  const { messages, isLoading, isTyping, sendMessage, addAIMessage, addMessage } = useChatSession();
  
  // 2. Hooks de Voz (Python Backend)
  const { 
    status: voiceStatus, 
    startSession, 
    stopSession, 
    isTalking,
    transcript 
  } = useVoiceAgent();

  const { request: requestPermission } = usePermissions();
  
  // Refs y Estados Locales
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [uploadContext, setUploadContext] = useState<'reembolso' | 'receta' | null>(null);
  const [mode, setMode] = useState<'text' | 'voice'>('text');

  // --- EFECTO CLAVE: Sincronizar Voz con Chat Visual ---
  useEffect(() => {
    if (transcript.length > 0) {
        const lastMsg = transcript[transcript.length - 1];
        
        // Si la IA habló (desde Python)
        if (lastMsg.role === 'assistant') {
            addAIMessage(lastMsg.content); 
        }
        // Si el Usuario habló
        else if (lastMsg.role === 'user') {
             // Usamos addMessage puro para que NO dispare la lógica de reglas del bot simulado
             addMessage(lastMsg.content, 'user'); 
        }
    }
  }, [transcript]); 
  // ----------------------------------------------------

  // Cargar preferencia de modo
  useEffect(() => {
    const preference = localStorage.getItem('rimiapp_communication_preference');
    if (preference === 'voice') setMode('voice');
    else setMode('text');
  }, []);

  const toggleMode = () => {
    const newMode = mode === 'text' ? 'voice' : 'text';
    setMode(newMode);
    
    // Si cambiamos a texto y estaba hablando, cortar voz
    if (newMode === 'text' && voiceStatus === 'active') {
        stopSession();
    }
    localStorage.setItem('rimiapp_communication_preference', newMode);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handlers de Chat Texto
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    sendMessage(text); // Esto SÍ dispara la lógica del bot simulado
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleChipClick = (chip: string) => handleSendMessage(chip);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRef.current) handleSendMessage(inputRef.current.value);
  };

  const handleOptionClick = (option: TriageOption) => handleSendMessage(`Elijo ${option.title}`);

  const handleCameraUpload = (context: 'reembolso' | 'receta') => {
    setUploadContext(context);
    cameraInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await requestPermission('camera');
    setIsProcessingOCR(true);
    sendMessage('Documento capturado');
    
    setTimeout(() => {
      setIsProcessingOCR(false);
      addAIMessage('Procesando OCR...');
      // Simulación de respuesta OCR
      setTimeout(() => {
        if (uploadContext === 'reembolso') {
          addAIMessage('Documentos validados correctamente. Solicitud enviada.');
        } else if (uploadContext === 'receta') {
          addAIMessage('Receta importada. Ibuprofeno 400mg.');
        }
        setUploadContext(null);
      }, 2000);
    }, 500);
    e.target.value = '';
  };

  const getIconForOption = (iconName: string) => {
    switch (iconName) {
      case 'video': return <Video className="w-6 h-6" />;
      case 'user': return <User className="w-6 h-6" />;
      case 'hospital': return <Hospital className="w-6 h-6" />;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={toggleOpen}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-surface rounded-3xl shadow-2xl w-full max-w-md h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-primary p-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-lg cursor-pointer flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
          >
            <img src={rimiAvatar} alt="Rimi" className="w-full h-full object-cover pointer-events-none" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-lg">Rimi</h2>
            <p className="text-white/80 text-xs">{mode === 'text' ? 'Modo Texto' : 'Modo Voz'}</p>
          </div>
          <button
            onClick={toggleMode}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            {mode === 'text' ? <Mic className="w-5 h-5 text-white" /> : <Keyboard className="w-5 h-5 text-white" />}
          </button>
        </div>

        {/* Area de Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="text-center text-secondary/60">Cargando...</div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-secondary/10 text-secondary rounded-bl-sm'}`}>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                  
                  {/* Renderizado condicional de opciones extras (Mapas, Chips) */}
                  {msg.type === 'options' && msg.payload && (
                    <div className="mt-3 space-y-2">
                      {msg.payload.map((option: TriageOption) => (
                        <motion.button
                          key={option.id}
                          onClick={() => handleOptionClick(option)}
                          whileTap={{ scale: 0.98 }}
                          className="w-full bg-white border-2 border-secondary/10 rounded-xl p-4 flex items-center gap-4"
                        >
                          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                            {getIconForOption(option.icon)}
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className="font-bold text-secondary text-sm">{option.title}</h4>
                            <span className="text-xs text-secondary/60">{option.time} • {option.cost}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                  
                  {msg.type === 'map' && msg.payload && (
                    <div className="mt-3 bg-gray-200 rounded-xl h-48 flex items-center justify-center relative">
                        <MapPin className="w-12 h-12 text-primary" />
                        <p className="absolute bottom-2 text-xs font-bold">{msg.payload.destination}</p>
                    </div>
                  )}

                  {msg.type === 'upload_prompt' && (
                    <div className="mt-3">
                      <button 
                        onClick={() => handleCameraUpload('reembolso')} 
                        disabled={isProcessingOCR} // <--- AQUÍ SE USA
                        className={`w-full bg-primary text-white rounded-xl p-4 flex items-center justify-center gap-3 ${isProcessingOCR ? 'opacity-50' : ''}`}
                      >
                        <Camera className="w-5 h-5" />
                        {/* AQUÍ TAMBIÉN SE USA: */}
                        <span>{isProcessingOCR ? 'Procesando...' : 'Subir Documentos'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* FOOTER: SUGGESTIONS CHIPS (Solo Texto) */}
        {mode === 'text' && (
            <div className="px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {SUGGESTION_CHIPS.map((chip) => (
                <button key={chip} onClick={() => handleChipClick(chip)} className="px-4 py-2 bg-accent/10 text-accent rounded-xl text-sm font-medium whitespace-nowrap">
                    {chip}
                </button>
                ))}
            </div>
            </div>
        )}

        {/* FOOTER: INPUT */}
        {mode === 'text' ? (
          <form onSubmit={handleSubmit} className="p-4 border-t border-secondary/10">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Escribe tu mensaje..."
                className="flex-1 px-4 py-3 rounded-xl border-2 border-secondary/20 focus:outline-none focus:border-primary"
              />
              <button type="submit" className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        ) : (
          // MODO VOZ ACTIVO
          <div className="p-6 border-t border-secondary/10 flex flex-col items-center gap-3">
            <button
              onClick={voiceStatus === 'active' ? stopSession : startSession}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${
                voiceStatus === 'active'
                  ? 'bg-red-600 text-white animate-pulse scale-110'
                  : 'bg-primary text-white hover:bg-red-700 hover:scale-105'
              }`}
            >
              <Mic className="w-10 h-10" />
            </button>
            
            <div className="text-center">
                <p className="text-sm font-bold text-secondary">
                    {voiceStatus === 'active' ? (isTalking ? "Rimi está hablando..." : "Te escucho...") : "Presiona para hablar"}
                </p>
                <p className="text-xs text-secondary/60 mt-1">
                    {voiceStatus === 'disconnected' ? 'Modo de espera' : 'Conectado a Bedrock'}
                </p>
            </div>
          </div>
        )}

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFileChange} />
      </motion.div>
    </motion.div>
  );
}