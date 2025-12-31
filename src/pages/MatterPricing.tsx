import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, Users, FileText, TrendingUp, Clock, Percent, DollarSign, Building } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Rate card data - can be customized per firm
const DEFAULT_RATES = {
  partner: { rate: 850, cost: 425 },
  seniorAssociate: { rate: 650, cost: 260 },
  associate: { rate: 450, cost: 180 },
  trainee: { rate: 250, cost: 100 },
};

interface TeamMember {
  id: string;
  name: string;
  grade: "partner" | "seniorAssociate" | "associate" | "trainee";
  hoursFirstTurn: number;
  subsequentTurns: number;
}

interface WorkPhase {
  id: string;
  name: string;
  description: string;
  partnerHours: number;
  seniorAssociateHours: number;
  associateHours: number;
  traineeHours: number;
}

const DEFAULT_PHASES: WorkPhase[] = [
  { id: "1", name: "Initial Review & Kick-off", description: "Review materials, client meetings, team briefing", partnerHours: 4, seniorAssociateHours: 6, associateHours: 8, traineeHours: 4 },
  { id: "2", name: "Due Diligence", description: "Legal due diligence review and reporting", partnerHours: 8, seniorAssociateHours: 20, associateHours: 40, traineeHours: 20 },
  { id: "3", name: "Documentation - First Draft", description: "Drafting of transaction documents", partnerHours: 10, seniorAssociateHours: 30, associateHours: 40, traineeHours: 10 },
  { id: "4", name: "Negotiation & Mark-ups", description: "Negotiation rounds and document revisions", partnerHours: 15, seniorAssociateHours: 25, associateHours: 30, traineeHours: 5 },
  { id: "5", name: "Closing & Completion", description: "Closing mechanics, conditions precedent, completion", partnerHours: 6, seniorAssociateHours: 10, associateHours: 15, traineeHours: 8 },
  { id: "6", name: "Project Management", description: "Ongoing project management and coordination", partnerHours: 5, seniorAssociateHours: 8, associateHours: 5, traineeHours: 2 },
];

export default function MatterPricing() {
  // Assumptions
  const [negotiatedDocsDecay, setNegotiatedDocsDecay] = useState(0.5);
  const [ddDecay, setDdDecay] = useState(0.35);
  const [numMeetings, setNumMeetings] = useState(0);
  const [meetingHoursPartner, setMeetingHoursPartner] = useState(3);
  const [meetingHoursAssociate, setMeetingHoursAssociate] = useState(2);
  const [numNegotiationTurns, setNumNegotiationTurns] = useState(3);
  
  // Pricing options
  const [afaDiscount, setAfaDiscount] = useState(0);
  const [currency, setCurrency] = useState("GBP");
  
  // Rates (editable)
  const [rates, setRates] = useState(DEFAULT_RATES);
  
  // Work phases
  const [phases, setPhases] = useState<WorkPhase[]>(DEFAULT_PHASES);

  // Currency symbol
  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";

  // Calculate hours with decay for negotiation turns
  const calculateNegotiationHours = (baseHours: number, decay: number, turns: number) => {
    let total = baseHours; // First turn
    let currentHours = baseHours;
    for (let i = 1; i < turns; i++) {
      currentHours = currentHours * decay;
      total += currentHours;
    }
    return total;
  };

  // Calculate total hours and costs
  const calculations = useMemo(() => {
    // Base hours from phases
    const basePartnerHours = phases.reduce((sum, p) => sum + p.partnerHours, 0);
    const baseSeniorAssociateHours = phases.reduce((sum, p) => sum + p.seniorAssociateHours, 0);
    const baseAssociateHours = phases.reduce((sum, p) => sum + p.associateHours, 0);
    const baseTraineeHours = phases.reduce((sum, p) => sum + p.traineeHours, 0);

    // DD phase with decay for subsequent turns
    const ddPhase = phases.find(p => p.name.includes("Due Diligence"));
    const ddPartnerHours = ddPhase ? calculateNegotiationHours(ddPhase.partnerHours, ddDecay, numNegotiationTurns) : 0;
    const ddSeniorAssociateHours = ddPhase ? calculateNegotiationHours(ddPhase.seniorAssociateHours, ddDecay, numNegotiationTurns) : 0;
    const ddAssociateHours = ddPhase ? calculateNegotiationHours(ddPhase.associateHours, ddDecay, numNegotiationTurns) : 0;

    // Negotiation phase with decay
    const negPhase = phases.find(p => p.name.includes("Negotiation"));
    const negPartnerHours = negPhase ? calculateNegotiationHours(negPhase.partnerHours, negotiatedDocsDecay, numNegotiationTurns) : 0;
    const negSeniorAssociateHours = negPhase ? calculateNegotiationHours(negPhase.seniorAssociateHours, negotiatedDocsDecay, numNegotiationTurns) : 0;
    const negAssociateHours = negPhase ? calculateNegotiationHours(negPhase.associateHours, negotiatedDocsDecay, numNegotiationTurns) : 0;

    // Meeting hours
    const meetingPartnerHours = numMeetings * meetingHoursPartner;
    const meetingAssociateHours = numMeetings * meetingHoursAssociate;

    // Total hours
    const totalPartnerHours = basePartnerHours + meetingPartnerHours + (negPartnerHours - (negPhase?.partnerHours || 0)) + (ddPartnerHours - (ddPhase?.partnerHours || 0));
    const totalSeniorAssociateHours = baseSeniorAssociateHours + (negSeniorAssociateHours - (negPhase?.seniorAssociateHours || 0)) + (ddSeniorAssociateHours - (ddPhase?.seniorAssociateHours || 0));
    const totalAssociateHours = baseAssociateHours + meetingAssociateHours + (negAssociateHours - (negPhase?.associateHours || 0)) + (ddAssociateHours - (ddPhase?.associateHours || 0));
    const totalTraineeHours = baseTraineeHours;

    // Apply AFA discount to rates
    const discountMultiplier = 1 - (afaDiscount / 100);
    const afaPartnerRate = rates.partner.rate * discountMultiplier;
    const afaSeniorAssociateRate = rates.seniorAssociate.rate * discountMultiplier;
    const afaAssociateRate = rates.associate.rate * discountMultiplier;
    const afaTraineeRate = rates.trainee.rate * discountMultiplier;

    // Revenue calculations
    const partnerRevenue = totalPartnerHours * afaPartnerRate;
    const seniorAssociateRevenue = totalSeniorAssociateHours * afaSeniorAssociateRate;
    const associateRevenue = totalAssociateHours * afaAssociateRate;
    const traineeRevenue = totalTraineeHours * afaTraineeRate;
    const totalRevenue = partnerRevenue + seniorAssociateRevenue + associateRevenue + traineeRevenue;

    // Cost calculations
    const partnerCost = totalPartnerHours * rates.partner.cost;
    const seniorAssociateCost = totalSeniorAssociateHours * rates.seniorAssociate.cost;
    const associateCost = totalAssociateHours * rates.associate.cost;
    const traineeCost = totalTraineeHours * rates.trainee.cost;
    const totalCost = partnerCost + seniorAssociateCost + associateCost + traineeCost;

    // Margin
    const margin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    // Blended rate
    const totalHours = totalPartnerHours + totalSeniorAssociateHours + totalAssociateHours + totalTraineeHours;
    const blendedRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    return {
      totalPartnerHours,
      totalSeniorAssociateHours,
      totalAssociateHours,
      totalTraineeHours,
      totalHours,
      afaPartnerRate,
      afaSeniorAssociateRate,
      afaAssociateRate,
      afaTraineeRate,
      partnerRevenue,
      seniorAssociateRevenue,
      associateRevenue,
      traineeRevenue,
      totalRevenue,
      partnerCost,
      seniorAssociateCost,
      associateCost,
      traineeCost,
      totalCost,
      margin,
      marginPercent,
      blendedRate,
    };
  }, [phases, rates, afaDiscount, numMeetings, meetingHoursPartner, meetingHoursAssociate, numNegotiationTurns, negotiatedDocsDecay, ddDecay]);

  const formatCurrency = (value: number) => {
    return `${currencySymbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatHours = (value: number) => {
    return value.toFixed(1);
  };

  const updatePhaseHours = (phaseId: string, field: keyof WorkPhase, value: number) => {
    setPhases(prev => prev.map(p => 
      p.id === phaseId ? { ...p, [field]: value } : p
    ));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Matter Pricing Tool</h1>
          <p className="text-muted-foreground mt-2">
            Calculate fee estimates and margins for legal matters
          </p>
        </div>

        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="summary">
              <TrendingUp className="h-4 w-4 mr-2" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="assumptions">
              <Calculator className="h-4 w-4 mr-2" />
              Assumptions
            </TabsTrigger>
            <TabsTrigger value="phases">
              <FileText className="h-4 w-4 mr-2" />
              Work Phases
            </TabsTrigger>
            <TabsTrigger value="rates">
              <Users className="h-4 w-4 mr-2" />
              Rate Card
            </TabsTrigger>
          </TabsList>

          {/* SUMMARY TAB */}
          <TabsContent value="summary" className="space-y-6">
            {/* Key metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Fee</p>
                      <p className="text-2xl font-bold">{formatCurrency(calculations.totalRevenue)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                      <p className="text-2xl font-bold">{formatHours(calculations.totalHours)}</p>
                    </div>
                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Margin</p>
                      <p className="text-2xl font-bold">{formatCurrency(calculations.margin)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Margin %</p>
                      <p className="text-2xl font-bold">{calculations.marginPercent.toFixed(1)}%</p>
                    </div>
                    <Percent className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Breakdown by grade */}
            <Card>
              <CardHeader>
                <CardTitle>Fee Breakdown by Grade</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Partner</TableCell>
                      <TableCell className="text-right">{formatHours(calculations.totalPartnerHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaPartnerRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.partnerRevenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.partnerCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.partnerRevenue - calculations.partnerCost)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Senior Associate</TableCell>
                      <TableCell className="text-right">{formatHours(calculations.totalSeniorAssociateHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaSeniorAssociateRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.seniorAssociateRevenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.seniorAssociateCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.seniorAssociateRevenue - calculations.seniorAssociateCost)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Associate</TableCell>
                      <TableCell className="text-right">{formatHours(calculations.totalAssociateHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaAssociateRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.associateRevenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.associateCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.associateRevenue - calculations.associateCost)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Trainee</TableCell>
                      <TableCell className="text-right">{formatHours(calculations.totalTraineeHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaTraineeRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.traineeRevenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.traineeCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.traineeRevenue - calculations.traineeCost)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatHours(calculations.totalHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.blendedRate)} (blended)</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.totalRevenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.totalCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.margin)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASSUMPTIONS TAB */}
          <TabsContent value="assumptions" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Pricing Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="afaDiscount">AFA Discount (%)</Label>
                    <Input
                      id="afaDiscount"
                      type="number"
                      min="0"
                      max="100"
                      value={afaDiscount}
                      onChange={(e) => setAfaDiscount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Negotiation Assumptions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="numTurns">Number of Negotiation Turns</Label>
                    <Input
                      id="numTurns"
                      type="number"
                      min="1"
                      max="10"
                      value={numNegotiationTurns}
                      onChange={(e) => setNumNegotiationTurns(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="negDecay">Doc Negotiation: Time Decay per Turn (%)</Label>
                    <Input
                      id="negDecay"
                      type="number"
                      min="0"
                      max="100"
                      value={negotiatedDocsDecay * 100}
                      onChange={(e) => setNegotiatedDocsDecay((parseFloat(e.target.value) || 0) / 100)}
                    />
                    <p className="text-xs text-muted-foreground">Each turn takes this % of the previous turn's time</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ddDecay">Due Diligence: Time Decay per Turn (%)</Label>
                    <Input
                      id="ddDecay"
                      type="number"
                      min="0"
                      max="100"
                      value={ddDecay * 100}
                      onChange={(e) => setDdDecay((parseFloat(e.target.value) || 0) / 100)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Meetings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="numMeetings">Number of Set-Piece Meetings</Label>
                    <Input
                      id="numMeetings"
                      type="number"
                      min="0"
                      value={numMeetings}
                      onChange={(e) => setNumMeetings(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="meetingPartner">Partner Hours per Meeting</Label>
                    <Input
                      id="meetingPartner"
                      type="number"
                      min="0"
                      value={meetingHoursPartner}
                      onChange={(e) => setMeetingHoursPartner(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="meetingAssociate">Associate Hours per Meeting</Label>
                    <Input
                      id="meetingAssociate"
                      type="number"
                      min="0"
                      value={meetingHoursAssociate}
                      onChange={(e) => setMeetingHoursAssociate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* WORK PHASES TAB */}
          <TabsContent value="phases" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Work Phases & Hours</CardTitle>
                <CardDescription>Edit the base hours for each work phase. Negotiation adjustments are applied based on assumptions.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phase</TableHead>
                      <TableHead className="text-right">Partner</TableHead>
                      <TableHead className="text-right">Senior Associate</TableHead>
                      <TableHead className="text-right">Associate</TableHead>
                      <TableHead className="text-right">Trainee</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phases.map((phase) => (
                      <TableRow key={phase.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{phase.name}</p>
                            <p className="text-xs text-muted-foreground">{phase.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            className="w-20 text-right ml-auto"
                            value={phase.partnerHours}
                            onChange={(e) => updatePhaseHours(phase.id, 'partnerHours', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            className="w-20 text-right ml-auto"
                            value={phase.seniorAssociateHours}
                            onChange={(e) => updatePhaseHours(phase.id, 'seniorAssociateHours', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            className="w-20 text-right ml-auto"
                            value={phase.associateHours}
                            onChange={(e) => updatePhaseHours(phase.id, 'associateHours', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            className="w-20 text-right ml-auto"
                            value={phase.traineeHours}
                            onChange={(e) => updatePhaseHours(phase.id, 'traineeHours', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {phase.partnerHours + phase.seniorAssociateHours + phase.associateHours + phase.traineeHours}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Base Total</TableCell>
                      <TableCell className="text-right">{phases.reduce((s, p) => s + p.partnerHours, 0)}</TableCell>
                      <TableCell className="text-right">{phases.reduce((s, p) => s + p.seniorAssociateHours, 0)}</TableCell>
                      <TableCell className="text-right">{phases.reduce((s, p) => s + p.associateHours, 0)}</TableCell>
                      <TableCell className="text-right">{phases.reduce((s, p) => s + p.traineeHours, 0)}</TableCell>
                      <TableCell className="text-right">
                        {phases.reduce((s, p) => s + p.partnerHours + p.seniorAssociateHours + p.associateHours + p.traineeHours, 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RATE CARD TAB */}
          <TabsContent value="rates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rate Card</CardTitle>
                <CardDescription>Configure hourly rates and costs by grade. AFA discount is applied automatically.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Standard Rate ({currencySymbol}/hr)</TableHead>
                      <TableHead className="text-right">Cost ({currencySymbol}/hr)</TableHead>
                      <TableHead className="text-right">AFA Rate ({afaDiscount}% off)</TableHead>
                      <TableHead className="text-right">Margin/hr</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Partner</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 text-right ml-auto"
                          value={rates.partner.rate}
                          onChange={(e) => setRates(prev => ({ ...prev, partner: { ...prev.partner, rate: parseFloat(e.target.value) || 0 } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 text-right ml-auto"
                          value={rates.partner.cost}
                          onChange={(e) => setRates(prev => ({ ...prev, partner: { ...prev.partner, cost: parseFloat(e.target.value) || 0 } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaPartnerRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaPartnerRate - rates.partner.cost)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Senior Associate</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 text-right ml-auto"
                          value={rates.seniorAssociate.rate}
                          onChange={(e) => setRates(prev => ({ ...prev, seniorAssociate: { ...prev.seniorAssociate, rate: parseFloat(e.target.value) || 0 } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 text-right ml-auto"
                          value={rates.seniorAssociate.cost}
                          onChange={(e) => setRates(prev => ({ ...prev, seniorAssociate: { ...prev.seniorAssociate, cost: parseFloat(e.target.value) || 0 } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaSeniorAssociateRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaSeniorAssociateRate - rates.seniorAssociate.cost)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Associate</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 text-right ml-auto"
                          value={rates.associate.rate}
                          onChange={(e) => setRates(prev => ({ ...prev, associate: { ...prev.associate, rate: parseFloat(e.target.value) || 0 } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 text-right ml-auto"
                          value={rates.associate.cost}
                          onChange={(e) => setRates(prev => ({ ...prev, associate: { ...prev.associate, cost: parseFloat(e.target.value) || 0 } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaAssociateRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaAssociateRate - rates.associate.cost)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Trainee</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 text-right ml-auto"
                          value={rates.trainee.rate}
                          onChange={(e) => setRates(prev => ({ ...prev, trainee: { ...prev.trainee, rate: parseFloat(e.target.value) || 0 } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 text-right ml-auto"
                          value={rates.trainee.cost}
                          onChange={(e) => setRates(prev => ({ ...prev, trainee: { ...prev.trainee, cost: parseFloat(e.target.value) || 0 } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaTraineeRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calculations.afaTraineeRate - rates.trainee.cost)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
