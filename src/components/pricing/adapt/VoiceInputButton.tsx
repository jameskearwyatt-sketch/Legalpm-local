import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const supported = !!SpeechRecognition;

  const toggle = useCallback(() => {
    if (!supported) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-GB";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) onTranscriptRef.current(transcript);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording, supported]);

  if (!supported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" disabled>
            <MicOff className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Voice input not supported in this browser</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          onClick={toggle}
          disabled={disabled}
          className={cn(isRecording && "animate-pulse")}
        >
          <Mic className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isRecording ? "Stop recording" : "Speak to describe differences"}</TooltipContent>
    </Tooltip>
  );
}
