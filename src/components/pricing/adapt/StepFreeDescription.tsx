import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles } from "lucide-react";
import { VoiceInputButton } from "./VoiceInputButton";

interface StepFreeDescriptionProps {
  description: string;
  onDescriptionChange: (text: string) => void;
  onBack: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function StepFreeDescription({
  description,
  onDescriptionChange,
  onBack,
  onGenerate,
  isGenerating,
}: StepFreeDescriptionProps) {
  const handleTranscript = (text: string) => {
    onDescriptionChange(description ? `${description} ${text}` : text);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Describe any other differences between the base deal and the new deal
        </Label>
        <p className="text-sm text-muted-foreground">
          You can type or use the microphone to speak naturally. Mention things like changes in scope,
          financing structure, number of parties, regulatory requirements, or any other differences.
        </p>
      </div>

      <div className="relative">
        <Textarea
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="e.g., The precedent deal has a financing aspect, but there's no financing in the new deal. It's just a project development transaction, but it's in the same country and the same technology…"
          className="min-h-[200px] pr-14"
        />
        <div className="absolute top-2 right-2">
          <VoiceInputButton onTranscript={handleTranscript} disabled={isGenerating} />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isGenerating}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <Button onClick={onGenerate} disabled={isGenerating}>
          <Sparkles className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating Draft…" : "Generate Draft"}
        </Button>
      </div>
    </div>
  );
}
