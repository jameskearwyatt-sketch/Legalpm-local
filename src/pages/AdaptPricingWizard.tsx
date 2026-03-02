import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePricingProposals, usePricingProposal, DraftProposalItem, ProposalPhase } from "@/lib/hooks/usePricingProposals";
import { useClients } from "@/lib/hooks/useClients";
import { useUserSettings } from "@/lib/hooks/useUserSettings";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getClientDisplayName } from "@/lib/clientUtils";

import { StepSelectBase } from "@/components/pricing/adapt/StepSelectBase";
import { StepStructuredQuestions, AdaptQuestion, QuestionAnswer } from "@/components/pricing/adapt/StepStructuredQuestions";
import { StepFreeDescription } from "@/components/pricing/adapt/StepFreeDescription";
import { StepReviewChanges, ItemChange, PhaseChange, ScopeChange } from "@/components/pricing/adapt/StepReviewChanges";
import { StepFinalConfirm } from "@/components/pricing/adapt/StepFinalConfirm";

const STEPS = ["Select Base", "Questions", "Description", "Review", "Confirm"];

export default function AdaptPricingWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { proposals } = usePricingProposals();
  const { clients } = useClients();
  const { defaultCurrency, defaultRateCard } = useUserSettings();

  const [step, setStep] = useState(0);

  // Step 1 state
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newName, setNewName] = useState("");

  // Step 2 state
  const [questions, setQuestions] = useState<AdaptQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Step 3 state
  const [freeDescription, setFreeDescription] = useState("");

  // Step 4 state
  const [phaseChanges, setPhaseChanges] = useState<PhaseChange[]>([]);
  const [itemChanges, setItemChanges] = useState<ItemChange[]>([]);
  const [scopeChanges, setScopeChanges] = useState<ScopeChange[]>([]);
  const [generalComment, setGeneralComment] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  // Step 5 state
  const [finalItems, setFinalItems] = useState<DraftProposalItem[]>([]);
  const [finalPhases, setFinalPhases] = useState<ProposalPhase[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Helper to fetch base proposal data (items + full proposal)
  const fetchBaseData = useCallback(async (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return null;

    // Get latest version
    const { data: versions } = await supabase
      .from("pricing_proposal_versions")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (!versions?.length) return null;

    const { data: items } = await supabase
      .from("pricing_proposal_items")
      .select("*")
      .eq("version_id", versions[0].id)
      .order("sort_order");

    return { proposal, items: items || [], version: versions[0] };
  }, [proposals]);

  // Step 1 → 2: Generate questions
  const goToStep2 = useCallback(async () => {
    setStep(1);
    setIsLoadingQuestions(true);
    try {
      const baseData = await fetchBaseData(selectedBaseId);
      if (!baseData) throw new Error("Could not load base proposal");

      const { data, error } = await supabase.functions.invoke("generate-adapt-questions", {
        body: {
          proposal: baseData.proposal,
          items: baseData.items,
        },
      });

      if (error) throw error;

      const qs: AdaptQuestion[] = data.questions || [];
      setQuestions(qs);
      setAnswers(qs.map(q => ({ questionId: q.id, answer: null, skipped: false })));
    } catch (err: any) {
      console.error("Failed to generate questions:", err);
      toast({ title: "Could not generate questions", description: err.message, variant: "destructive" });
      setQuestions([]);
      setAnswers([]);
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [selectedBaseId, fetchBaseData, toast]);

  // Handle answer changes
  const handleAnswerChange = (qId: string, answer: string | string[] | boolean | null) => {
    setAnswers(prev => prev.map(a => a.questionId === qId ? { ...a, answer, skipped: false } : a));
  };
  const handleSkip = (qId: string) => {
    setAnswers(prev => prev.map(a => a.questionId === qId ? { ...a, skipped: !a.skipped } : a));
  };

  // Step 3 → 4: Generate adaptation
  const generateDraft = useCallback(async () => {
    setIsGenerating(true);
    setStep(3);
    try {
      const baseData = await fetchBaseData(selectedBaseId);
      if (!baseData) throw new Error("Could not load base proposal");

      const { data, error } = await supabase.functions.invoke("adapt-pricing-proposal", {
        body: {
          mode: "initial",
          proposal: baseData.proposal,
          items: baseData.items,
          structuredAnswers: answers.filter(a => !a.skipped && a.answer !== null),
          freeDescription,
          newName,
          newClientName: clients.find(c => c.id === selectedClientId)?.name || "",
        },
      });

      if (error) throw error;

      // Parse response into changes
      const pc: PhaseChange[] = (data.phaseChanges || []).map((c: any, i: number) => ({
        id: `pc-${i}`,
        basePhaseId: c.basePhaseId,
        action: c.action,
        originalName: c.originalName,
        newName: c.newName,
        rationale: c.rationale || "",
        accepted: true,
        comment: "",
      }));

      const ic: ItemChange[] = (data.itemChanges || []).map((c: any, i: number) => ({
        id: `ic-${i}`,
        baseItemId: c.baseItemId,
        action: c.action,
        originalWorkItem: c.originalWorkItem,
        originalDetail: c.originalDetail,
        newWorkItem: c.newWorkItem,
        newDetail: c.newDetail,
        newCategory: c.newCategory,
        newPhaseId: c.newPhaseId,
        rationale: c.rationale || "",
        fee_amount: c.fee_amount,
        fee_lower: c.fee_lower,
        fee_upper: c.fee_upper,
        provider: c.provider,
        accepted: true,
        comment: "",
      }));

      const sc: ScopeChange[] = (data.scopeAssumptionChanges || []).map((c: any, i: number) => ({
        id: `sc-${i}`,
        type: c.type || c.action,
        description: c.description,
        rationale: c.rationale || "",
        accepted: true,
        comment: "",
      }));

      setPhaseChanges(pc);
      setItemChanges(ic);
      setScopeChanges(sc);
    } catch (err: any) {
      console.error("Failed to generate adaptation:", err);
      toast({ title: "Draft generation failed", description: err.message, variant: "destructive" });
      setStep(2); // go back to free description
    } finally {
      setIsGenerating(false);
    }
  }, [selectedBaseId, answers, freeDescription, newName, selectedClientId, clients, fetchBaseData, toast]);

  // Build final items and phases from accepted changes (client-side logic)
  type ProviderType = "Baker McKenzie" | "Local Counsel";
  const asProvider = (p: string | undefined): ProviderType => 
    p === "Local Counsel" ? "Local Counsel" : "Baker McKenzie";

  // Helper: strip "[Baker McKenzie] " or "[Local Counsel] " prefixes from work item labels
  const stripProviderPrefix = (label: string) =>
    label.replace(/^\[(?:Baker McKenzie|Local Counsel)\]\s*/i, "");

  const buildFinalFromDecisions = useCallback(async () => {
    const baseData = await fetchBaseData(selectedBaseId);
    if (!baseData) throw new Error("Could not load base proposal");
    const baseItems = baseData.items || [];
    const basePhases: ProposalPhase[] = ((baseData.proposal.work_phases || []) as unknown as ProposalPhase[]).map(p => ({ ...p, is_included: p.is_included ?? true }));

    // --- Build final phases ---
    // Start with base phases, apply accepted phase changes
    const removedPhaseIds = new Set(
      phaseChanges.filter(p => p.action === "removed" && p.accepted).map(p => p.basePhaseId)
    );
    const renamedPhaseMap = new Map(
      phaseChanges.filter(p => p.action === "renamed" && p.accepted).map(p => [p.basePhaseId, p.newName])
    );
    const addedPhases = phaseChanges.filter(p => p.action === "added" && p.accepted);

    const fp: ProposalPhase[] = [
      ...basePhases
        .filter(p => !removedPhaseIds.has(p.id))
        .map(p => ({
          ...p,
          name: renamedPhaseMap.get(p.id) || p.name,
        })),
      ...addedPhases.map(p => ({
        id: `phase-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: p.newName || "New Phase",
        is_included: true,
      })),
    ];


    // --- Build final items ---
    // Helper: find base item by ID first, then by work_item text match
    const findBaseItem = (change: ItemChange) => {
      if (change.baseItemId) {
        const byId = baseItems.find((bi: any) => bi.id === change.baseItemId);
        if (byId) return byId;
      }
      if (change.originalWorkItem) {
        const byName = baseItems.find((bi: any) => bi.work_item === change.originalWorkItem);
        if (byName) return byName;
        // Fuzzy: check if base work_item is contained in originalWorkItem or vice versa
        const byPartial = baseItems.find((bi: any) => 
          bi.work_item && change.originalWorkItem &&
          (bi.work_item.toLowerCase().includes(change.originalWorkItem.toLowerCase()) ||
           change.originalWorkItem.toLowerCase().includes(bi.work_item.toLowerCase()))
        );
        if (byPartial) return byPartial;
      }
      return null;
    };

    // Process each item change based on accept/reject decisions
    const fi: DraftProposalItem[] = [];
    const usedBaseIds = new Set<string>();

    for (const change of itemChanges) {
      if (change.action === "removed") {
        if (!change.accepted) {
          const baseItem = findBaseItem(change);
          if (baseItem) {
            usedBaseIds.add(baseItem.id);
            fi.push({
              work_item: baseItem.work_item,
              detail: baseItem.detail || null,
              provider: asProvider(baseItem.provider),
              fee_amount: baseItem.fee_amount || 0,
              fee_lower: baseItem.fee_lower || baseItem.fee_amount || 0,
              fee_upper: baseItem.fee_upper || baseItem.fee_amount || 0,
              pricing_method: "manual" as const,
              category: baseItem.category || null,
              phase_id: removedPhaseIds.has(baseItem.phase_id) ? null : baseItem.phase_id,
              is_optional: false,
              is_included: true,
              ai_rationale: null,
              partner_hours: 0,
              associate_hours: 0,
              num_turns: 1,
              item_type: "documentation" as const,
            });
          }
        }
        continue;
      }

      if (change.action === "added") {
        if (change.accepted) {
          fi.push({
            work_item: stripProviderPrefix(change.newWorkItem || "New Work Item"),
            detail: change.newDetail || null,
            provider: asProvider(change.provider),
            fee_amount: change.fee_amount || 0,
            fee_lower: change.fee_lower || change.fee_amount || 0,
            fee_upper: change.fee_upper || change.fee_amount || 0,
            pricing_method: "manual" as const,
            category: change.newCategory || null,
            phase_id: change.newPhaseId || null,
            is_optional: false,
            is_included: true,
            ai_rationale: change.rationale || null,
            partner_hours: 0,
            associate_hours: 0,
            num_turns: 1,
            item_type: "documentation" as const,
          });
        }
        continue;
      }

      if (change.action === "modified") {
        const baseItem = findBaseItem(change);
        if (change.accepted) {
          // Use new text from AI, but ALWAYS inherit fees & category from base if AI didn't provide them
          const workItemLabel = change.newWorkItem && change.newWorkItem !== "Work Item" 
            ? stripProviderPrefix(change.newWorkItem) 
            : stripProviderPrefix(change.originalWorkItem || baseItem?.work_item || "Work Item");
          if (baseItem) usedBaseIds.add(baseItem.id);
          fi.push({
            work_item: workItemLabel,
            detail: change.newDetail || change.originalDetail || baseItem?.detail || null,
            provider: asProvider(change.provider || baseItem?.provider),
            fee_amount: change.fee_amount ?? baseItem?.fee_amount ?? 0,
            fee_lower: change.fee_lower ?? baseItem?.fee_lower ?? baseItem?.fee_amount ?? 0,
            fee_upper: change.fee_upper ?? baseItem?.fee_upper ?? baseItem?.fee_amount ?? 0,
            pricing_method: "manual" as const,
            category: change.newCategory || baseItem?.category || null,
            phase_id: change.newPhaseId || (baseItem?.phase_id && !removedPhaseIds.has(baseItem.phase_id) ? baseItem.phase_id : null),
            is_optional: false,
            is_included: true,
            ai_rationale: change.rationale || null,
            partner_hours: 0,
            associate_hours: 0,
            num_turns: 1,
            item_type: "documentation" as const,
          });
        } else {
          if (baseItem) {
            usedBaseIds.add(baseItem.id);
            fi.push({
              work_item: baseItem.work_item,
              detail: baseItem.detail || null,
              provider: asProvider(baseItem.provider),
              fee_amount: baseItem.fee_amount || 0,
              fee_lower: baseItem.fee_lower || baseItem.fee_amount || 0,
              fee_upper: baseItem.fee_upper || baseItem.fee_amount || 0,
              pricing_method: "manual" as const,
              category: baseItem.category || null,
              phase_id: removedPhaseIds.has(baseItem.phase_id) ? null : baseItem.phase_id,
              is_optional: false,
              is_included: true,
              ai_rationale: null,
              partner_hours: 0,
              associate_hours: 0,
              num_turns: 1,
              item_type: "documentation" as const,
            });
          }
        }
        continue;
      }

      // "unchanged" — always keep the original base item data
      const baseItem = findBaseItem(change);
      if (baseItem) {
        usedBaseIds.add(baseItem.id);
        fi.push({
          work_item: baseItem.work_item,
          detail: baseItem.detail || null,
          provider: asProvider(baseItem.provider),
          fee_amount: baseItem.fee_amount || 0,
          fee_lower: baseItem.fee_lower || baseItem.fee_amount || 0,
          fee_upper: baseItem.fee_upper || baseItem.fee_amount || 0,
          pricing_method: "manual" as const,
          category: baseItem.category || null,
          phase_id: removedPhaseIds.has(baseItem.phase_id) ? null : baseItem.phase_id,
          is_optional: false,
          is_included: true,
          ai_rationale: null,
          partner_hours: 0,
          associate_hours: 0,
          num_turns: 1,
          item_type: "documentation" as const,
        });
      }
    }

    return { fp, fi };
  }, [selectedBaseId, phaseChanges, itemChanges, fetchBaseData]);

  // Step 4 → 5: Build final from user decisions
  const refineDraft = useCallback(async () => {
    setIsRefining(true);
    try {
      const { fp, fi } = await buildFinalFromDecisions();

      // If there are rejected items with comments OR a general comment, 
      // optionally do an AI refine pass for those specific items
      const hasRejectedWithComments = itemChanges.some(i => !i.accepted && i.comment);
      const hasGeneralFeedback = generalComment.trim().length > 0;

      if (hasRejectedWithComments || hasGeneralFeedback) {
        // Do a targeted AI pass only for items that need rethinking
        try {
          const baseData = await fetchBaseData(selectedBaseId);
          if (baseData) {
            const { data, error } = await supabase.functions.invoke("adapt-pricing-proposal", {
              body: {
                mode: "refine",
                proposal: baseData.proposal,
                items: baseData.items,
                structuredAnswers: answers.filter(a => !a.skipped && a.answer !== null),
                freeDescription,
                phaseChanges: phaseChanges,
                itemChanges: itemChanges,
                scopeChanges: scopeChanges,
                generalComment,
                newName,
                newClientName: clients.find(c => c.id === selectedClientId)?.name || "",
                // Send the current built items so the AI can see what we have
                currentFinalItems: fi,
                currentFinalPhases: fp,
              },
            });

            if (!error && data?.finalItems?.length > 0) {
              // Use AI-refined items if the AI returned them
              const refinedItems: DraftProposalItem[] = data.finalItems.map((item: any) => ({
                work_item: stripProviderPrefix(item.work_item),
                detail: item.detail || null,
                provider: asProvider(item.provider),
                fee_amount: item.fee_amount || 0,
                fee_lower: item.fee_lower || item.fee_amount || 0,
                fee_upper: item.fee_upper || item.fee_amount || 0,
                pricing_method: "manual" as const,
                category: item.category || null,
                phase_id: item.phase_id || null,
                is_optional: false,
                is_included: true,
                ai_rationale: item.rationale || null,
                partner_hours: 0,
                associate_hours: 0,
                num_turns: 1,
                item_type: "documentation" as const,
              }));
              const refinedPhases: ProposalPhase[] = (data.finalPhases || fp).map((p: any) => ({
                id: p.id || `phase-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                name: p.name,
                is_included: true,
              }));
              setFinalPhases(refinedPhases);
              setFinalItems(refinedItems);
              setStep(4);
              return;
            }
          }
        } catch {
          // If AI refine fails, fall through to use client-built items
          console.warn("AI refine pass failed, using client-built items");
        }
      }

      setFinalPhases(fp);
      setFinalItems(fi);
      setStep(4);
    } catch (err: any) {
      console.error("Refinement failed:", err);
      toast({ title: "Refinement failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRefining(false);
    }
  }, [buildFinalFromDecisions, itemChanges, generalComment, selectedBaseId, answers, freeDescription, phaseChanges, scopeChanges, newName, selectedClientId, clients, fetchBaseData, toast]);

  // Step 5: Create the proposal
  const createProposal = useCallback(async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const baseProposal = proposals.find(p => p.id === selectedBaseId);

      // Create proposal
      const { data: newProposal, error: pErr } = await supabase
        .from("pricing_proposals")
        .insert({
          user_id: user.id,
          client_id: selectedClientId,
          name: newName,
          currency: baseProposal?.currency || defaultCurrency,
          team_rate_currency: baseProposal?.team_rate_currency || defaultCurrency,
          rate_card: (baseProposal?.rate_card || defaultRateCard || null) as any,
          work_phases: finalPhases as any,
        } as any)
        .select()
        .single();

      if (pErr) throw pErr;

      // Create initial version
      const totalAmount = finalItems.reduce((s, i) => s + (i.fee_upper || i.fee_amount), 0);
      const bmTotal = finalItems.filter(i => i.provider === "Baker McKenzie").reduce((s, i) => s + (i.fee_upper || i.fee_amount), 0);
      const lcTotal = finalItems.filter(i => i.provider === "Local Counsel").reduce((s, i) => s + (i.fee_upper || i.fee_amount), 0);

      const { data: version, error: vErr } = await supabase
        .from("pricing_proposal_versions")
        .insert({
          proposal_id: newProposal.id,
          user_id: user.id,
          version_number: 1,
          total_amount: totalAmount,
          bm_total: bmTotal,
          local_counsel_total: lcTotal,
          notes: "Created via Adapt from Precedent wizard",
        })
        .select()
        .single();

      if (vErr) throw vErr;

      // Insert items
      if (finalItems.length > 0) {
        const itemsToInsert = finalItems.map((item, idx) => ({
          version_id: version.id,
          proposal_id: newProposal.id,
          user_id: user.id,
          work_item: item.work_item,
          detail: item.detail || null,
          provider: item.provider,
          fee_amount: item.fee_amount,
          fee_lower: item.fee_lower ?? item.fee_amount,
          fee_upper: item.fee_upper ?? item.fee_amount,
          pricing_method: item.pricing_method,
          category: item.category || null,
          phase_id: item.phase_id || null,
          is_optional: false,
          is_included: true,
          sort_order: idx,
          ai_rationale: item.ai_rationale || null,
          partner_hours: 0,
          associate_hours: 0,
          num_turns: 1,
          item_type: "documentation",
        }));

        const { error: iErr } = await supabase
          .from("pricing_proposal_items")
          .insert(itemsToInsert);

        if (iErr) throw iErr;
      }

      toast({ title: "Proposal created successfully" });
      navigate(`/pricing/proposal/${newProposal.id}`);
    } catch (err: any) {
      console.error("Failed to create proposal:", err);
      toast({ title: "Failed to create proposal", description: err.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  }, [user, selectedBaseId, selectedClientId, newName, finalPhases, finalItems, proposals, defaultCurrency, defaultRateCard, navigate, toast]);

  // Toggle helpers
  const togglePhase = (id: string) => setPhaseChanges(prev => prev.map(p => p.id === id ? { ...p, accepted: !p.accepted } : p));
  const commentPhase = (id: string, c: string) => setPhaseChanges(prev => prev.map(p => p.id === id ? { ...p, comment: c } : p));
  const toggleItem = (id: string) => setItemChanges(prev => prev.map(i => i.id === id ? { ...i, accepted: !i.accepted } : i));
  const commentItem = (id: string, c: string) => setItemChanges(prev => prev.map(i => i.id === id ? { ...i, comment: c } : i));
  const toggleScope = (id: string) => setScopeChanges(prev => prev.map(s => s.id === id ? { ...s, accepted: !s.accepted } : s));
  const commentScope = (id: string, c: string) => setScopeChanges(prev => prev.map(s => s.id === id ? { ...s, comment: c } : s));

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const baseProposal = proposals.find(p => p.id === selectedBaseId);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Proposal from Precedent</h1>
          <p className="text-muted-foreground mt-1">
            Adapt an existing pricing proposal for a new deal using AI-powered analysis
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <Badge
                variant={i === step ? "default" : i < step ? "secondary" : "outline"}
                className="text-xs"
              >
                {i + 1}. {label}
              </Badge>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 0 && (
          <StepSelectBase
            proposals={proposals}
            clients={clients}
            selectedBaseId={selectedBaseId}
            selectedClientId={selectedClientId}
            newName={newName}
            onBaseChange={setSelectedBaseId}
            onClientChange={setSelectedClientId}
            onNameChange={setNewName}
            onNext={goToStep2}
          />
        )}

        {step === 1 && (
          <StepStructuredQuestions
            questions={questions}
            answers={answers}
            isLoading={isLoadingQuestions}
            onAnswerChange={handleAnswerChange}
            onSkip={handleSkip}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepFreeDescription
            description={freeDescription}
            onDescriptionChange={setFreeDescription}
            onBack={() => setStep(1)}
            onGenerate={generateDraft}
            isGenerating={isGenerating}
          />
        )}

        {step === 3 && (
          isGenerating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">AI is adapting the base proposal for your new deal…</p>
            </div>
          ) : (
            <StepReviewChanges
              phaseChanges={phaseChanges}
              itemChanges={itemChanges}
              scopeChanges={scopeChanges}
              generalComment={generalComment}
              onPhaseToggle={togglePhase}
              onPhaseComment={commentPhase}
              onItemToggle={toggleItem}
              onItemComment={commentItem}
              onScopeToggle={toggleScope}
              onScopeComment={commentScope}
              onGeneralCommentChange={setGeneralComment}
              onBack={() => setStep(2)}
              onRefine={refineDraft}
              isRefining={isRefining}
            />
          )
        )}

        {step === 4 && (
          <StepFinalConfirm
            proposalName={newName}
            clientName={selectedClient ? getClientDisplayName(selectedClient) : ""}
            currency={baseProposal?.currency || defaultCurrency}
            phases={finalPhases}
            items={finalItems}
            isCreating={isCreating}
            onCreate={createProposal}
          />
        )}
      </div>
    </AppLayout>
  );
}
