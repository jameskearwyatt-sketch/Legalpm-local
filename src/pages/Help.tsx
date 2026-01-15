import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  HelpCircle, 
  Camera, 
  FileText, 
  PoundSterling, 
  Calculator,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';

export default function Help() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Help & Documentation</h1>
          <p className="text-muted-foreground mt-1">
            Learn how Legal Practice Manager works and how to get the most from it
          </p>
        </div>

        {/* Key Concepts */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Lightbulb className="h-5 w-5 text-warning" />
              Key Concepts
            </CardTitle>
            <CardDescription>
              Understanding the core entities in Legal Practice Manager
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Clients</h3>
              <p className="text-muted-foreground">
                Clients are the organisations you work for. Each client can have multiple matters.
                You can group clients by sector and track billing contacts for easier management.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-2">Matters</h3>
              <p className="text-muted-foreground">
                A matter represents a specific piece of legal work for a client. Each matter has an
                agreed budget, a fee type (e.g., Discounted Rates with Cap, Rack Rates with Estimate), 
                and tracking for work in progress, billing, and payments.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-2">Financial Snapshots</h3>
              <p className="text-muted-foreground">
                Snapshots capture the financial state of a matter at a point in time. They record:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li><strong>WIP (Work in Progress)</strong> – Time recorded but not yet billed</li>
                <li><strong>Total Billed</strong> – Total amount invoiced to the client</li>
                <li><strong>Accounts Receivable</strong> – Outstanding bills not yet paid</li>
                <li><strong>Total Paid</strong> – Total amount received from the client</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Create snapshots weekly or monthly to track trends over time. The dashboard uses the
                latest snapshot for each matter to calculate totals and identify issues.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-2">Invoices</h3>
              <p className="text-muted-foreground">
                Track individual invoices for each matter. Invoices help you monitor:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Invoice dates and due dates</li>
                <li>Payment status (Draft, Sent, Part Paid, Paid, Overdue)</li>
                <li>Amounts billed vs paid</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Calculations */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Calculator className="h-5 w-5 text-primary" />
              How Calculations Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">Remaining Budget</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  Agreed Budget − (Billed + WIP)
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Shows how much budget is left after accounting for both billed work and unbilled WIP.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">Budget Used %</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  (Billed + WIP) ÷ Agreed Budget × 100
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Percentage of budget consumed. Over 100% means you're over budget.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">Collection Rate</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  Paid ÷ Billed × 100
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Percentage of billed amounts that have been collected. 100% means all bills paid.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">WIP to Bill</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  Latest Snapshot WIP Amount
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  The current unbilled work that can be converted to invoices.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Understanding Alerts
            </CardTitle>
            <CardDescription>
              The dashboard highlights matters that need attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4 p-3 rounded-lg bg-danger/5 border border-danger/20">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-danger"></span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Over Budget</h4>
                  <p className="text-sm text-muted-foreground">
                    Billed + WIP exceeds the agreed budget. Immediate attention required.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-3 rounded-lg bg-warning/5 border border-warning/20">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-warning"></span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Near Budget (≥80%)</h4>
                  <p className="text-sm text-muted-foreground">
                    Matter is approaching budget limit. Review scope and remaining work.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-3 rounded-lg bg-warning/5 border border-warning/20">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-warning"></span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">High WIP</h4>
                  <p className="text-sm text-muted-foreground">
                    Significant unbilled work with low billing. Consider sending invoices.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-3 rounded-lg bg-danger/5 border border-danger/20">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-danger"></span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Poor Collection (&lt;60%)</h4>
                  <p className="text-sm text-muted-foreground">
                    Low percentage of billed amounts have been paid. Follow up on outstanding invoices.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-3 rounded-lg bg-danger/5 border border-danger/20">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-danger"></span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Overdue Invoice</h4>
                  <p className="text-sm text-muted-foreground">
                    Invoice is past its due date and not fully paid. Chase payment.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Tips */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <HelpCircle className="h-5 w-5 text-accent" />
              Recommended Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">1</span>
                <div>
                  <h4 className="font-semibold text-foreground">Set up clients</h4>
                  <p className="text-sm text-muted-foreground">
                    Add your client organisations first. These are required before creating matters.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">2</span>
                <div>
                  <h4 className="font-semibold text-foreground">Create matters</h4>
                  <p className="text-sm text-muted-foreground">
                    For each new instruction, create a matter with the agreed budget and terms.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">3</span>
                <div>
                  <h4 className="font-semibold text-foreground">Add regular snapshots</h4>
                  <p className="text-sm text-muted-foreground">
                    Weekly or monthly, add a financial snapshot with current WIP, billed, and paid figures.
                    Export this from your practice management system.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">4</span>
                <div>
                  <h4 className="font-semibold text-foreground">Track invoices</h4>
                  <p className="text-sm text-muted-foreground">
                    Log invoices as you send them and update their status when payments arrive.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">5</span>
                <div>
                  <h4 className="font-semibold text-foreground">Review dashboard regularly</h4>
                  <p className="text-sm text-muted-foreground">
                    Check the dashboard for alerts and take action on any red flags.
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
