import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Matters from "./pages/Matters";
import MatterDetail from "./pages/MatterDetail";
import MatterForm from "./pages/MatterForm";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Help from "./pages/Help";
import Flags from "./pages/Flags";
import RedFlags from "./pages/RedFlags";
import PipelineFlags from "./pages/PipelineFlags";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/matters" element={<ProtectedRoute><Matters /></ProtectedRoute>} />
      <Route path="/matters/new" element={<ProtectedRoute><MatterForm /></ProtectedRoute>} />
      <Route path="/matters/:id" element={<ProtectedRoute><MatterDetail /></ProtectedRoute>} />
      <Route path="/matters/:id/edit" element={<ProtectedRoute><MatterForm /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/clients/new" element={<ProtectedRoute><Clients defaultDialogOpen /></ProtectedRoute>} />
      <Route path="/flags" element={<ProtectedRoute><Flags /></ProtectedRoute>} />
      <Route path="/red-flags" element={<ProtectedRoute><RedFlags /></ProtectedRoute>} />
      <Route path="/pipeline-flags" element={<ProtectedRoute><PipelineFlags /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
