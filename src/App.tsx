import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Matters = lazy(() => import("./pages/Matters"));
const MatterDetail = lazy(() => import("./pages/MatterDetail"));
const MatterForm = lazy(() => import("./pages/MatterForm"));
const Growth = lazy(() => import("./pages/Growth"));
const GrowthProjectDetail = lazy(() => import("./pages/GrowthProjectDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Help = lazy(() => import("./pages/Help"));
const Flags = lazy(() => import("./pages/Flags"));
const TimeRecording = lazy(() => import("./pages/TimeRecording"));
const ExcelAnalyzer = lazy(() => import("./pages/ExcelAnalyzer"));
const MatterPricing = lazy(() => import("./pages/MatterPricing"));
const PricingProposalDetail = lazy(() => import("./pages/PricingProposalDetail"));
const Contacts = lazy(() => import("./pages/Contacts"));
const BMExpertiseMap = lazy(() => import("./pages/BMExpertiseMap"));
const PPAAnalyst = lazy(() => import("./pages/PPAAnalyst"));
const TollingAnalyst = lazy(() => import("./pages/TollingAnalyst"));
const CarbonCreditAnalyst = lazy(() => import("./pages/CarbonCreditAnalyst"));
const ITSupplyAnalyst = lazy(() => import("./pages/ITSupplyAnalyst"));
const CloudComputeAnalyst = lazy(() => import("./pages/CloudComputeAnalyst"));
const AdaptPricingWizard = lazy(() => import("./pages/AdaptPricingWizard"));
const AdminAnalystBackfill = lazy(() => import("./pages/AdminAnalystBackfill"));
const AdminAnalystTelemetry = lazy(() => import("./pages/AdminAnalystTelemetry"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const PalettePreview = lazy(() => import("./pages/PalettePreview"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

// One-time global cache purge. Existing users carry stale React Query caches
// (e.g. dashboard aggregates referencing snapshots that were later deleted)
// across sessions because the cache lives in memory until the tab is closed.
// Bumping the flag below forces a single `clear()` per browser per deploy so
// every user gets a clean slate without needing to know about the manual
// Refresh button. Bump the version string to trigger a future purge.
const CACHE_PURGE_FLAG = 'cache-purge-v2026-04-20';
try {
  if (typeof window !== 'undefined' && !localStorage.getItem(CACHE_PURGE_FLAG)) {
    queryClient.clear();
    localStorage.setItem(CACHE_PURGE_FLAG, '1');
  }
} catch {
  // localStorage may be unavailable (private mode, SSR) — purge is best-effort.
}

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading page" />
    </div>
  );
}

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

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/index" element={<Navigate to="/" replace />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/palette-preview" element={<PalettePreview />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/matters" element={<ProtectedRoute><Matters /></ProtectedRoute>} />
        <Route path="/matters/new" element={<ProtectedRoute><MatterForm /></ProtectedRoute>} />
        <Route path="/matters/:id" element={<ProtectedRoute><MatterDetail /></ProtectedRoute>} />
        <Route path="/matters/:id/edit" element={<ProtectedRoute><MatterForm /></ProtectedRoute>} />
        <Route path="/time-recording" element={<ProtectedRoute><TimeRecording /></ProtectedRoute>} />
        <Route path="/pricing" element={<ProtectedRoute><MatterPricing /></ProtectedRoute>} />
        <Route path="/pricing/proposal/:proposalId" element={<ProtectedRoute><PricingProposalDetail /></ProtectedRoute>} />
        <Route path="/pricing/adapt" element={<ProtectedRoute><AdaptPricingWizard /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/bm-expertise" element={<ProtectedRoute><BMExpertiseMap /></ProtectedRoute>} />
        <Route path="/ppa-analyst" element={<ProtectedRoute><PPAAnalyst /></ProtectedRoute>} />
        <Route path="/tolling-analyst" element={<ProtectedRoute><TollingAnalyst /></ProtectedRoute>} />
        <Route path="/carbon-credit-analyst" element={<ProtectedRoute><CarbonCreditAnalyst /></ProtectedRoute>} />
        <Route path="/it-supply-analyst" element={<ProtectedRoute><ITSupplyAnalyst /></ProtectedRoute>} />
        <Route path="/cloud-compute-analyst" element={<ProtectedRoute><CloudComputeAnalyst /></ProtectedRoute>} />
        <Route path="/growth" element={<ProtectedRoute><Growth /></ProtectedRoute>} />
        <Route path="/growth/:projectId" element={<ProtectedRoute><GrowthProjectDetail /></ProtectedRoute>} />
        <Route path="/flags" element={<ProtectedRoute><Flags /></ProtectedRoute>} />
        <Route path="/red-flags" element={<Navigate to="/flags" replace />} />
        <Route path="/pipeline-flags" element={<Navigate to="/flags" replace />} />
        <Route path="/admin/analyst-backfill" element={<AdminRoute><AdminAnalystBackfill /></AdminRoute>} />
        <Route path="/admin/analyst-telemetry" element={<AdminRoute><AdminAnalystTelemetry /></AdminRoute>} />
        <Route path="/admin/activity" element={<AdminRoute><ActivityLog /></AdminRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/excel-analyzer" element={<ProtectedRoute><ExcelAnalyzer /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
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
  </ErrorBoundary>
);

export default App;
