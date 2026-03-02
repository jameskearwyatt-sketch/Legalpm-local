import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, ArrowRight, SkipForward, HelpCircle } from "lucide-react";

export interface AdaptQuestion {
  id: string;
  question: string;
  input_type: "text" | "select" | "boolean" | "checklist";
  options?: string[];
  context?: string;
}

export interface QuestionAnswer {
  questionId: string;
  answer: string | string[] | boolean | null;
  skipped: boolean;
}

interface StepStructuredQuestionsProps {
  questions: AdaptQuestion[];
  answers: QuestionAnswer[];
  isLoading: boolean;
  onAnswerChange: (questionId: string, answer: string | string[] | boolean | null) => void;
  onSkip: (questionId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepStructuredQuestions({
  questions,
  answers,
  isLoading,
  onAnswerChange,
  onSkip,
  onBack,
  onNext,
}: StepStructuredQuestionsProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Analysing base proposal to generate targeted questions…</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <p className="text-muted-foreground">No questions generated. You can proceed to the free-form description.</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <Button onClick={onNext}>Next<ArrowRight className="h-4 w-4 ml-2" /></Button>
        </div>
      </div>
    );
  }

  const getAnswer = (qId: string) => answers.find(a => a.questionId === qId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Answer the following questions about how the new deal differs from the base. You can skip any question.
      </p>

      {questions.map((q) => {
        const ans = getAnswer(q.id);
        const isSkipped = ans?.skipped;

        return (
          <Card key={q.id} className={isSkipped ? "opacity-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{q.question}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => onSkip(q.id)}
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  {isSkipped ? "Unskip" : "Skip"}
                </Button>
              </CardTitle>
              {q.context && <p className="text-xs text-muted-foreground">{q.context}</p>}
            </CardHeader>
            {!isSkipped && (
              <CardContent>
                {q.input_type === "text" && (
                  <Input
                    value={(ans?.answer as string) || ""}
                    onChange={e => onAnswerChange(q.id, e.target.value)}
                    placeholder="Type your answer…"
                  />
                )}
                {q.input_type === "select" && q.options && (
                  <Select
                    value={(ans?.answer as string) || ""}
                    onValueChange={val => onAnswerChange(q.id, val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {q.input_type === "boolean" && (
                  <div className="flex gap-2">
                    {["Yes", "No", "Unsure"].map(opt => (
                      <Button
                        key={opt}
                        variant={ans?.answer === opt ? "default" : "outline"}
                        size="sm"
                        onClick={() => onAnswerChange(q.id, opt)}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                )}
                {q.input_type === "checklist" && q.options && (
                  <div className="space-y-2">
                    {q.options.map(opt => {
                      const current = (ans?.answer as string[]) || [];
                      const checked = current.includes(opt);
                      return (
                        <div key={opt} className="flex items-center gap-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={c => {
                              const next = c
                                ? [...current, opt]
                                : current.filter(v => v !== opt);
                              onAnswerChange(q.id, next);
                            }}
                          />
                          <span className="text-sm">{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <Button onClick={onNext}>
          Next: Free-Form Description
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
