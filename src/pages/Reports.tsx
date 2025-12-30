import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';

export default function Reports() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Reports & Export</h1>
          <p className="text-muted-foreground mt-1">Export data and import from external systems</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Download your data in CSV format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export All Matters
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Open Matters Only
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Financial Snapshots
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Invoices
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Upload className="h-5 w-5" />
                Import Data
              </CardTitle>
              <CardDescription>
                Bulk import from CSV files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import Clients
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import Matters
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import Financial Snapshots
              </Button>
              <p className="text-sm text-muted-foreground pt-2">
                CSV files should include headers matching the expected column names.
                Download a template first to see the required format.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">CSV Import Format Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Matters CSV Columns</h4>
              <code className="text-sm bg-muted px-3 py-2 rounded block overflow-x-auto">
                client_name, matter_name, matter_number, practice_area, status, lead_partner, start_date, target_close_date, budget_type, agreed_budget_amount, currency
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Financial Snapshots CSV Columns</h4>
              <code className="text-sm bg-muted px-3 py-2 rounded block overflow-x-auto">
                matter_number, as_of_date, wip_amount, billed_amount, paid_amount, notes
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Clients CSV Columns</h4>
              <code className="text-sm bg-muted px-3 py-2 rounded block overflow-x-auto">
                name, group_sector, billing_contact
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
