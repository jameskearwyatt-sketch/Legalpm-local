import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/lib/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { QuickToDoButton } from '@/components/QuickToDo/QuickToDoButton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Scale,
  LayoutDashboard,
  Briefcase,
  Shield,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Flag,
  AlertTriangle,
  Rocket,
  Clock,
  Calculator,
  Users,
  Network,
  FileSearch,
  ChevronDown,
  FlaskConical,
  Cpu,
  Cloud,
  Database,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AppLayoutProps {
  children: ReactNode;
}

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
type NavSeparator = { type: 'separator' };
type NavSubGroup = { type: 'subgroup'; name: string; children: NavItem[] };
type NavGroupChild = NavItem | NavSubGroup;
type NavGroup = { type: 'group'; name: string; icon: typeof LayoutDashboard; children: NavGroupChild[] };
type NavEntry = NavItem | NavSeparator | NavGroup;

function matchesRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  return pathname.startsWith(href + '/');
}

import { Leaf } from 'lucide-react';

const carbonRemovalsChildren: NavItem[] = [
  { name: 'Carbon Credit Offtake', href: '/carbon-credit-analyst', icon: Leaf },
];

const dataCenterSuiteChildren: NavItem[] = [
  { name: 'IT Supply Analyst', href: '/it-supply-analyst', icon: Cpu },
  { name: 'Cloud Compute Services', href: '/cloud-compute-analyst', icon: Cloud },
];

const analystNavigation: NavGroupChild[] = [
  { name: 'PPA Analyst', href: '/ppa-analyst', icon: FileSearch },
  { name: 'Tolling Analyst', href: '/tolling-analyst', icon: FlaskConical },
  { type: 'subgroup', name: 'Carbon Removals Suite', children: carbonRemovalsChildren },
  { type: 'subgroup', name: 'Data Center Suite', children: dataCenterSuiteChildren },
];

const navigation: NavEntry[] = [
  { type: 'group', name: 'Analyst', icon: FileSearch, children: analystNavigation },
  { type: 'separator' },
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Matters', href: '/matters', icon: Briefcase },
  { name: 'Pricing & Assumptions', href: '/pricing', icon: Calculator },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'BM EMI Expertise Map', href: '/bm-expertise', icon: Network },
  { name: 'Growth', href: '/growth', icon: Rocket },
  { name: 'Time Recording', href: '/time-recording', icon: Clock },
  { name: 'Red Flags', href: '/red-flags', icon: AlertTriangle },
  { name: 'Pipeline Flags', href: '/pipeline-flags', icon: Flag },
  { name: 'Admin Flags', href: '/flags', icon: AlertTriangle, adminOnly: true },
  { name: 'Analyst Backfill', href: '/admin/analyst-backfill', icon: Database, adminOnly: true },
  { name: 'Analyst Telemetry', href: '/admin/analyst-telemetry', icon: Activity, adminOnly: true },
  { name: 'Security', href: '/settings', icon: Shield },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleNavigation = useMemo<NavEntry[]>(() => {
    return navigation.filter((entry) => {
      if ('type' in entry && entry.type === 'separator') return true;
      if ('type' in entry && entry.type === 'group') return true;
      const item = entry as NavItem;
      return !item.adminOnly || isAdmin;
    });
  }, [isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  const allAnalystHrefs: string[] = analystNavigation.flatMap(c =>
    'type' in c && c.type === 'subgroup' ? c.children.map(sc => sc.href) : [(c as NavItem).href]
  );
  const [analystOpen, setAnalystOpen] = useState(() =>
    allAnalystHrefs.some(h => matchesRoute(location.pathname, h))
  );

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 bg-sidebar lg:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
            <div className="p-1.5 rounded-lg bg-sidebar-primary">
              <Scale className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-heading font-semibold text-sidebar-foreground">Legal Practice Manager</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {visibleNavigation.map((entry, index) => {
              if ('type' in entry && entry.type === 'separator') {
                return <div key={`sep-${index}`} className="my-2 mx-2 border-t border-dotted border-sidebar-border/60" />;
              }
              if ('type' in entry && entry.type === 'group') {
                const group = entry as NavGroup;
                const groupActive = group.children.some((c) =>
                  'type' in c && c.type === 'subgroup'
                    ? c.children.some((sc) => matchesRoute(location.pathname, sc.href))
                    : 'href' in c && matchesRoute(location.pathname, c.href)
                );
                return (
                  <Collapsible key={group.name} open={analystOpen} onOpenChange={setAnalystOpen}>
                    <CollapsibleTrigger className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      groupActive
                        ? 'text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}>
                      <group.icon className="h-5 w-5" />
                      {group.name}
                      <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', analystOpen && 'rotate-180')} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
                      {(analystNavigation as NavGroupChild[]).map((child, ci) => {
                        if ('type' in child && child.type === 'subgroup') {
                          return (
                            <div key={child.name} className="mt-1.5">
                              <div className="px-3 py-1.5 text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
                                {child.name}
                              </div>
                              {child.children.map(sc => {
                                const scActive = matchesRoute(location.pathname, sc.href);
                                return (
                                  <Link
                                    key={sc.name}
                                    to={sc.href}
                                    className={cn(
                                      'flex items-center gap-3 px-3 pl-5 py-2 rounded-lg text-sm font-medium transition-colors',
                                      scActive
                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                                    )}
                                  >
                                    <sc.icon className="h-4 w-4" />
                                    {sc.name}
                                  </Link>
                                );
                              })}
                            </div>
                          );
                        }
                        const item = child as NavItem;
                        const childActive = matchesRoute(location.pathname, item.href);
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                              childActive
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }
              const item = entry as NavItem;
              const isActive = matchesRoute(location.pathname, item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          <div className="border-t border-sidebar-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-sidebar-accent/50 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 truncate">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Shield className="mr-2 h-4 w-4" />
                  Security
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 sm:h-16 items-center justify-between gap-2 border-b bg-card px-3 sm:px-4 lg:hidden safe-area-top">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 -ml-2 rounded-lg hover:bg-muted touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <span className="font-heading font-semibold text-sm sm:text-base truncate">Legal PM</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Open user menu" className="p-1 rounded-full hover:bg-muted transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Shield className="mr-2 h-4 w-4" />
              Security
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div role="presentation" className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-[280px] sm:w-72 bg-sidebar flex flex-col overflow-hidden shadow-2xl transition-transform duration-300 safe-area-top">
            <div className="flex h-14 sm:h-16 shrink-0 items-center justify-between px-4 sm:px-6 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-sidebar-primary" />
                <span className="font-heading font-semibold text-sm sm:text-base text-sidebar-foreground">Legal Practice Manager</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-lg hover:bg-sidebar-accent/50 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <X className="h-5 w-5 text-sidebar-foreground" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch space-y-1 px-3 py-4">
              {visibleNavigation.map((entry, index) => {
                if ('type' in entry && entry.type === 'separator') {
                  return <div key={`sep-m-${index}`} className="my-2 mx-2 border-t border-dotted border-sidebar-border/60" />;
                }
                  if ('type' in entry && entry.type === 'group') {
                  const group = entry as NavGroup;
                  return (
                    <div key={group.name} className="space-y-0.5">
                      <div className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                        {group.name}
                      </div>
                      {(analystNavigation as NavGroupChild[]).map((child, ci) => {
                        if ('type' in child && child.type === 'subgroup') {
                          return (
                            <div key={child.name} className="mt-1">
                              <div className="px-3 pl-6 py-1.5 text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
                                {child.name}
                              </div>
                              {child.children.map(sc => {
                                const scActive = matchesRoute(location.pathname, sc.href);
                                return (
                                  <Link
                                    key={sc.name}
                                    to={sc.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                      'flex items-center gap-3 px-3 pl-8 py-2 rounded-lg text-sm font-medium transition-colors',
                                      scActive
                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                                    )}
                                  >
                                    <sc.icon className="h-4 w-4" />
                                    {sc.name}
                                  </Link>
                                );
                              })}
                            </div>
                          );
                        }
                        const item = child as NavItem;
                        const childActive = matchesRoute(location.pathname, item.href);
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-3 px-3 pl-6 py-2 rounded-lg text-sm font-medium transition-colors',
                              childActive
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  );
                }
                const item = entry as NavItem;
                const isActive = matchesRoute(location.pathname, item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors touch-manipulation',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            {/* Mobile menu user section */}
            <div className="border-t border-sidebar-border p-4 safe-area-bottom">
              <div className="flex items-center gap-3 px-3 py-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-sidebar-foreground truncate flex-1">{user?.email}</p>
              </div>
              <button
                onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                className="flex w-full items-center gap-3 px-3 py-3 mt-1 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 touch-manipulation"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main id="main-content" className="lg:pl-64">
        <div className="min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] lg:min-h-screen safe-area-bottom">
          {children}
        </div>
      </main>

      {/* Floating Quick To-Do */}
      <QuickToDoButton />
    </div>
  );
}
