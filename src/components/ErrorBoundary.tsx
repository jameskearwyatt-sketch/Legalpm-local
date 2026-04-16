import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  goHome = () => {
    this.setState({ error: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
            </div>
            <CardDescription className="pt-2">
              The app ran into an unexpected problem. Your work is still saved — this page just failed to render.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Technical details
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
          </CardContent>
          <CardFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={this.goHome}>
              <Home className="mr-2 h-4 w-4" />
              Go to dashboard
            </Button>
            <Button onClick={this.reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
}
