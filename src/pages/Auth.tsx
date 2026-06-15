import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Scale, ShieldCheck, HardDrive } from 'lucide-react';

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
          <div className="p-2 rounded-lg bg-primary">
            <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Legal Practice Manager</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Local Edition</p>
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="font-heading">Welcome</CardTitle>
            <CardDescription>
              All your data stays on this device. Nothing is sent to a server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <HardDrive className="h-5 w-5 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Local-only storage</p>
                <p className="text-xs text-muted-foreground">Your data is stored in your browser using an embedded PostgreSQL database. No cloud, no server.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <ShieldCheck className="h-5 w-5 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Your data, your control</p>
                <p className="text-xs text-muted-foreground">Export your data anytime. Clear it anytime. No account required.</p>
              </div>
            </div>
            <Button className="w-full mt-2" onClick={() => navigate('/')}>
              Enter Legal PM
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
