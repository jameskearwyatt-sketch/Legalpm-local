import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Trash2, Calendar, Building, DollarSign } from "lucide-react";
import { usePricingProposals } from "@/lib/hooks/usePricingProposals";
import { useClients } from "@/lib/hooks/useClients";
import { format } from "date-fns";

export default function MatterPricing() {
  const navigate = useNavigate();
  const { proposals, isLoading, createProposal, deleteProposal } = usePricingProposals();
  const { clients } = useClients();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProposal, setNewProposal] = useState({
    name: "",
    description: "",
    client_id: "",
    currency: "GBP",
  });

  const handleCreate = async () => {
    if (!newProposal.name || !newProposal.client_id) return;
    
    await createProposal.mutateAsync({
      name: newProposal.name,
      description: newProposal.description,
      client_id: newProposal.client_id,
      currency: newProposal.currency,
    });
    
    setIsCreateOpen(false);
    setNewProposal({ name: "", description: "", client_id: "", currency: "GBP" });
  };

  const handleDelete = async (e: React.MouseEvent, proposalId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this proposal?")) {
      await deleteProposal.mutateAsync(proposalId);
    }
  };

  const draftProposals = proposals.filter(p => p.status === "Draft");
  const agreedProposals = proposals.filter(p => p.status === "Agreed");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Matter Pricing Tool</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage pricing proposals for client matters
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Proposal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Proposal</DialogTitle>
                <DialogDescription>
                  Start a new pricing proposal for a client matter
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select 
                    value={newProposal.client_id} 
                    onValueChange={(value) => setNewProposal(prev => ({ ...prev, client_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Proposal Name *</Label>
                  <Input
                    id="name"
                    value={newProposal.name}
                    onChange={(e) => setNewProposal(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Project Alpha Acquisition"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newProposal.description}
                    onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the proposal..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select 
                    value={newProposal.currency} 
                    onValueChange={(value) => setNewProposal(prev => ({ ...prev, currency: value }))}
                  >
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={!newProposal.name || !newProposal.client_id || createProposal.isPending}
                >
                  Create Proposal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No proposals yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first pricing proposal to get started
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Proposal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Draft Proposals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Draft Proposals
                  <Badge variant="secondary">{draftProposals.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Active proposals being developed and negotiated
                </CardDescription>
              </CardHeader>
              <CardContent>
                {draftProposals.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No draft proposals</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proposal</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftProposals.map((proposal) => (
                        <TableRow 
                          key={proposal.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/pricing/proposal/${proposal.id}`)}
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium">{proposal.name}</div>
                              {proposal.description && (
                                <div className="text-sm text-muted-foreground truncate max-w-xs">
                                  {proposal.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              {proposal.client?.name || "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">V{proposal.current_version}</Badge>
                          </TableCell>
                          <TableCell>{proposal.currency}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(proposal.updated_at), "dd MMM yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDelete(e, proposal.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Agreed Proposals */}
            {agreedProposals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Agreed Proposals
                    <Badge variant="default" className="bg-green-600">{agreedProposals.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Finalized proposals ready to be sent to matters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proposal</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Final Version</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Agreed Date</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agreedProposals.map((proposal) => (
                        <TableRow 
                          key={proposal.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/pricing/proposal/${proposal.id}`)}
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium">{proposal.name}</div>
                              {proposal.description && (
                                <div className="text-sm text-muted-foreground truncate max-w-xs">
                                  {proposal.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              {proposal.client?.name || "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-600">V{proposal.current_version}</Badge>
                          </TableCell>
                          <TableCell>{proposal.currency}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(proposal.updated_at), "dd MMM yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDelete(e, proposal.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
