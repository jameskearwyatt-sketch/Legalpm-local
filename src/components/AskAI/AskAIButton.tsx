import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = 'ai-button-position';

export function AskAIButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Load saved position on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate position is within viewport
        const maxX = window.innerWidth - 56;
        const maxY = window.innerHeight - 56;
        setPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY),
        });
      } catch {
        // Invalid saved position, use default
      }
    }
  }, []);

  // Save position when it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [position]);

  // Check if speech recognition is supported
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSupported = !!SpeechRecognition;
    setSpeechSupported(isSupported);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Handle pointer events for dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isOpen) return; // Don't drag when panel is open
    
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position?.x ?? (window.innerWidth - rect.width - 24),
      startPosY: position?.y ?? (window.innerHeight - rect.height - 24),
    };

    setIsDragging(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    // Only start dragging if moved more than 5px
    if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      setIsDragging(true);
    }

    if (isDragging || Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      const buttonSize = 56;
      const newX = Math.min(Math.max(0, dragRef.current.startPosX + deltaX), window.innerWidth - buttonSize);
      const newY = Math.min(Math.max(0, dragRef.current.startPosY + deltaY), window.innerHeight - buttonSize);
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasDragging = isDragging;
    dragRef.current = null;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // If we weren't dragging, treat as a click
    if (!wasDragging) {
      setIsOpen(!isOpen);
    }
  };

  const requestMicrophoneAccess = async () => {
    setShowPermissionDialog(false);
    
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionDenied(false);
      startListening();
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      setPermissionDenied(true);
      setShowPermissionDialog(true);
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setInterimText(interimTranscript);

      if (finalTranscript) {
        setInput(prev => prev + finalTranscript + ' ');
        setInterimText("");
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start recognition:', err);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimText("");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (permissionStatus.state === 'granted') {
        startListening();
      } else if (permissionStatus.state === 'denied') {
        setPermissionDenied(true);
        setShowPermissionDialog(true);
      } else {
        setPermissionDenied(false);
        setShowPermissionDialog(true);
      }
    } catch {
      setPermissionDenied(false);
      setShowPermissionDialog(true);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ question: userMessage }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || "I couldn't find an answer to that question." },
      ]);
    } catch (error) {
      console.error("Error asking AI:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I encountered an error: ${errorMessage}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Calculate button position style
  const getButtonStyle = (): React.CSSProperties => {
    if (position) {
      return {
        position: 'fixed',
        left: position.x,
        top: position.y,
        right: 'auto',
        bottom: 'auto',
      };
    }
    // Default position: bottom-right corner
    return {
      position: 'fixed',
      right: 24,
      bottom: 24,
    };
  };

  // Calculate chat panel position based on button position
  const getChatPanelStyle = (): React.CSSProperties => {
    if (position) {
      const panelWidth = 384; // w-96 = 24rem = 384px
      const panelHeight = 440; // Approximate height
      const buttonSize = 56;
      
      // Try to position above the button
      let top = position.y - panelHeight - 8;
      let left = position.x - panelWidth / 2 + buttonSize / 2;
      
      // If panel would go off top, position below
      if (top < 8) {
        top = position.y + buttonSize + 8;
      }
      
      // Keep within horizontal bounds
      left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
      
      // If panel would go off bottom, position above regardless
      if (top + panelHeight > window.innerHeight - 8) {
        top = position.y - panelHeight - 8;
      }
      
      return {
        position: 'fixed',
        left,
        top,
        right: 'auto',
        bottom: 'auto',
      };
    }
    // Default position
    return {
      position: 'fixed',
      right: 24,
      bottom: 96,
    };
  };

  return (
    <>
      {/* Microphone Permission Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 via-pink-500/20 to-purple-600/20">
              <Mic className="h-8 w-8 text-pink-500" />
            </div>
            <DialogTitle className="text-center">
              {permissionDenied ? "Microphone Access Blocked" : "Microphone Access Required"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {permissionDenied 
                ? "You previously blocked microphone access. To enable it, click the lock icon in your browser's address bar, find 'Microphone', and change it to 'Allow'. Then refresh the page."
                : "To use voice input, we need access to your microphone. Click 'Allow Access' below, then approve the browser prompt."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {!permissionDenied && (
              <Button 
                onClick={requestMicrophoneAccess}
                className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:from-orange-400 hover:via-pink-400 hover:to-purple-500"
              >
                Allow Access
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setShowPermissionDialog(false)}
              className="w-full"
            >
              {permissionDenied ? "Close" : "Not Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Draggable Button */}
      <div 
        ref={buttonRef}
        className="z-50"
        style={getButtonStyle()}
      >
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={cn(
            "relative h-14 w-14 rounded-full shadow-xl transition-all duration-300 touch-none select-none",
            "bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600",
            "hover:from-orange-400 hover:via-pink-400 hover:to-purple-500",
            "hover:shadow-2xl hover:shadow-pink-500/30",
            !isDragging && "hover:scale-110",
            "flex items-center justify-center text-white",
            "ring-2 ring-white/20 ring-offset-2 ring-offset-background",
            !isOpen && !isDragging && "ai-button-alive",
            isOpen && "rotate-90",
            isDragging && "cursor-grabbing scale-110 shadow-2xl shadow-pink-500/40",
            !isDragging && !isOpen && "cursor-grab"
          )}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </button>
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div 
          className="z-50 w-96 max-w-[calc(100vw-3rem)] rounded-xl border-0 shadow-2xl shadow-pink-500/20 overflow-hidden animate-scale-in"
          style={getChatPanelStyle()}
        >
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Ask AI</h3>
                <p className="text-xs text-white/80">
                  Your intelligent legal assistant
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="h-80 bg-card p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-purple-600/10">
                  <MessageCircle className="h-6 w-6 text-pink-500" />
                </div>
                <p className="text-sm font-medium">Ask me anything about your data</p>
                <p className="mt-2 text-xs opacity-70">
                  e.g., "What should I quote for a carbon marketing agreement?"
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm",
                      message.role === "user"
                        ? "ml-8 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white shadow-md"
                        : "mr-8 bg-muted text-foreground border border-border"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
                {isLoading && (
                  <div className="mr-8 flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground border border-border">
                    <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                    <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent font-medium">
                      Thinking...
                    </span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border bg-card p-3">
            {/* Show interim speech text */}
            {interimText && (
              <div className="mb-2 text-xs text-muted-foreground italic px-2">
                {interimText}...
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Speak now..." : "Ask a question..."}
                className={cn(
                  "min-h-[44px] max-h-32 resize-none rounded-xl border-muted focus:border-pink-500/50 focus:ring-pink-500/20",
                  isListening && "border-pink-500/50 bg-pink-500/5"
                )}
                rows={1}
              />
              {speechSupported && (
                <button
                  onClick={toggleListening}
                  className={cn(
                    "shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-all",
                    isListening
                      ? "bg-pink-500 text-white animate-pulse"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    "hover:scale-105"
                  )}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-all",
                  "bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white",
                  "hover:shadow-lg hover:shadow-pink-500/30 hover:scale-105",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}