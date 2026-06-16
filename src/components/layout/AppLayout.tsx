import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/lib/hooks/useUserRole';
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
  History,
  BarChart3,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/layout/NotificationBell';
import AutoBackupBanner from '@/components/layout/AutoBackupBanner';

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

const navigation: NavEntry[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Matters', href: '/matters', icon: Briefcase },
  { name: 'Pricing & Assumptions', href: '/pricing', icon: Calculator },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Growth', href: '/growth', icon: Rocket },
  { name: 'Credentials', href: '/credentials', icon: Award },
  { name: 'Time Recording', href: '/time-recording', icon: Clock },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Flags', href: '/flags', icon: Flag },
  { name: 'Activity Log', href: '/admin/activity', icon: History, adminOnly: true },
  { name: 'Security', href: '/settings', icon: Shield },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  };

  const visibleNavigation = useMemo<NavEntry[]>(() => {
    return navigation
      .map((entry) => {
        if ('type' in entry && entry.type === 'group') {
          // Filter admin-only items out of subgroups and direct children, drop
          // subgroups that end up empty for non-admins.
          const filteredChildren = entry.children
            .map((child) => {
              if ('type' in child && child.type === 'subgroup') {
                const visibleSubChildren = child.children.filter((sc) => !sc.adminOnly || isAdmin);
                if (visibleSubChildren.length === 0) return null;
                return { ...child, children: visibleSubChildren };
              }
              const item = child as NavItem;
              return !item.adminOnly || isAdmin ? item : null;
            })
            .filter((c): c is NavGroupChild => c !== null);
          return { ...entry, children: filteredChildren };
        }
        return entry;
      })
      .filter((entry) => {
        if ('type' in entry && entry.type === 'separator') return true;
        if ('type' in entry && entry.type === 'group') return entry.children.length > 0;
        const item = entry as NavItem;
        return !item.adminOnly || isAdmin;
      });
  }, [isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const userInitials = (() => {
    const name = user?.user_metadata?.full_name as string | undefined;
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      if (parts[0]?.length >= 2) return parts[0].slice(0, 2).toUpperCase();
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  })();

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-50 hidden bg-sidebar lg:block overflow-hidden"
        style={{ width: collapsed ? 60 : 260, transition: 'width 0.2s ease', minHeight: '100vh' }}
      >
        <div className="flex h-full flex-col relative">
          {/* Toggle button */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute z-10 p-1 cursor-pointer"
            style={{
              top: 28,
              left: collapsed ? 18 : 224,
              transition: 'left 0.2s ease',
              background: 'transparent',
              border: 'none',
              color: '#9B9590',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          </button>

          {/* Brand */}
          <div className="flex h-16 items-center border-b border-sidebar-border" style={{ padding: collapsed ? '0 12px' : '0 24px' }}>
            {collapsed ? (
              <span className="text-lg font-heading font-bold text-sidebar-foreground mx-auto">L</span>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div>
                  <h1 className="text-sm font-heading font-semibold text-sidebar-foreground tracking-wide uppercase">Legal PM</h1>
                  <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-[0.15em]">Practice Manager</p>
                </div>
                <NotificationBell />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 py-4 overflow-y-auto" style={{ padding: collapsed ? '16px 6px' : '16px 12px' }}>
            {visibleNavigation.map((entry, index) => {
              if ('type' in entry && entry.type === 'separator') {
                return <div key={`sep-${index}`} className="my-2 mx-2 border-t border-dotted border-sidebar-border/60" />;
              }
              const item = entry as NavItem;
              const isActive = matchesRoute(location.pathname, item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition-colors relative',
                    isActive
                      ? 'bg-[rgba(201,185,154,0.08)] text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                  style={collapsed
                    ? { gap: 0, padding: '11px 0', justifyContent: 'center' }
                    : { gap: 12, padding: '11px 24px', justifyContent: 'flex-start' }
                  }
                >
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-[#C9B99A]" />}
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          {!collapsed && (
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
          )}
          {collapsed && (
            <div className="border-t border-sidebar-border py-3 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-full hover:bg-sidebar-accent/50 transition-colors">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[10px]">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right" className="w-56">
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
            </div>
          )}
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
          <div className="flex items-center min-w-0">
            <span className="font-heading font-semibold text-sm sm:text-base truncate">Legal PM</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
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
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div role="presentation" className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-[280px] sm:w-72 bg-sidebar flex flex-col overflow-hidden shadow-2xl transition-transform duration-300 safe-area-top">
            <div className="flex h-14 sm:h-16 shrink-0 items-center justify-between px-4 sm:px-6 border-b border-sidebar-border">
              <span className="font-heading font-semibold text-sm sm:text-base text-sidebar-foreground">Legal Practice Manager</span>
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
      <main
        id="main-content"
        className={cn(
          'min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] lg:min-h-screen safe-area-bottom',
          collapsed ? 'lg:pl-[60px]' : 'lg:pl-[260px]'
        )}
        style={{ transition: 'padding-left 0.2s ease' }}
      >
        <AutoBackupBanner />
        {children}
      </main>

      {/* Floating Quick To-Do */}
      <QuickToDoButton />
    </div>
  );
}
