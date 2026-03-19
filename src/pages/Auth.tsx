import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Scale, Loader2, Fingerprint, Smartphone } from 'lucide-react';
import { z } from 'zod';
import { useWebAuthn } from '@/lib/hooks/useWebAuthn';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  fullName: z.string().optional(),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const [hasPasskeys, setHasPasskeys] = useState(false);
  const [checkingPasskeys, setCheckingPasskeys] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    isSupported: webAuthnSupported, 
    isLoading: webAuthnLoading,
    checkPlatformAuthenticator,
    authenticateWithPasskey,
    checkPasskeysForEmail,
  } = useWebAuthn();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Check if platform authenticator is available
  useEffect(() => {
    const checkAuth = async () => {
      if (webAuthnSupported) {
        const available = await checkPlatformAuthenticator();
        setHasPlatformAuth(available);
      }
    };
    checkAuth();
  }, [webAuthnSupported, checkPlatformAuthenticator]);

  // Check if user has passkeys when email changes (debounced)
  useEffect(() => {
    const checkPasskeys = async () => {
      if (!email || !email.includes('@') || !hasPlatformAuth) {
        setHasPasskeys(false);
        return;
      }
      
      setCheckingPasskeys(true);
      const has = await checkPasskeysForEmail(email);
      setHasPasskeys(has);
      setCheckingPasskeys(false);
    };

    const timer = setTimeout(checkPasskeys, 500);
    return () => clearTimeout(timer);
  }, [email, hasPlatformAuth, checkPasskeysForEmail]);

  const validateForm = (isSignUp: boolean) => {
    try {
      authSchema.parse({ email, password, fullName: isSignUp ? fullName : undefined });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'email') fieldErrors.email = err.message;
          if (err.path[0] === 'password') fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.'
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      });
      navigate('/');
    }
  };

  const handleFaceIdSignIn = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address first.',
        variant: 'destructive',
      });
      return;
    }

    const result = await authenticateWithPasskey(email);
    
    if (result.success) {
      toast({
        title: 'Welcome back!',
        description: 'Signed in with Face ID.',
      });
      navigate('/');
    } else if (result.error) {
      toast({
        title: 'Face ID sign in failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    
    setIsLoading(true);
    const { error } = await signUp(email, password, fullName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Account exists',
          description: 'This email is already registered. Please sign in instead.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sign up failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Account created!',
        description: 'You have been signed in automatically.',
      });
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
          <div className="p-2 rounded-lg bg-primary">
            <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Legal Practice Manager</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Legal Financial Tracking</p>
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="font-heading">Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@lawfirm.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={errors.password ? 'border-destructive' : ''}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>

                  {/* Face ID / Biometric Sign In */}
                  {hasPlatformAuth && (
                    <>
                      <div className="relative my-4">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                          or
                        </span>
                      </div>
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleFaceIdSignIn}
                        disabled={webAuthnLoading || !email || checkingPasskeys}
                      >
                        {webAuthnLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Authenticating...
                          </>
                        ) : checkingPasskeys ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <Fingerprint className="mr-2 h-4 w-4" />
                            Sign in with Face ID / Touch ID
                          </>
                        )}
                      </Button>
                      
                      {hasPasskeys && email && (
                        <p className="text-xs text-center text-muted-foreground mt-2">
                          <Smartphone className="inline h-3 w-3 mr-1" />
                          Face ID available for this account
                        </p>
                      )}
                      
                      {!hasPasskeys && email && email.includes('@') && !checkingPasskeys && (
                        <p className="text-xs text-center text-muted-foreground mt-2">
                          Sign in with password first, then set up Face ID in Settings
                        </p>
                      )}
                    </>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@lawfirm.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={errors.password ? 'border-destructive' : ''}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
