import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { AskAIButton } from '@/components/AskAI/AskAIButton';
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
  Settings,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard };
type NavSeparator = { type: 'separator' };
type NavEntry = NavItem | NavSeparator;

const navigation: NavEntry[] = [
  { name: 'PPA Analyst', href: '/ppa-analyst', icon: FileSearch },
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
  { name: 'Admin Flags', href: '/flags', icon: AlertTriangle },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
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
            {navigation.map((entry, index) => {
              if ('type' in entry && entry.type === 'separator') {
                return <div key={`sep-${index}`} className="my-2 mx-2 border-t border-dotted border-sidebar-border/60" />;
              }
              const item = entry as NavItem;
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
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
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
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
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-4 lg:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-muted"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <span className="font-heading font-semibold">Legal Practice Manager</span>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-foreground/20" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-sidebar animate-slide-up">
            <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <Scale className="h-6 w-6 text-sidebar-primary" />
                <span className="font-heading font-semibold text-sidebar-foreground">Legal Practice Manager</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-sidebar-accent/50"
              >
                <X className="h-5 w-5 text-sidebar-foreground" />
              </button>
            </div>
            <nav className="space-y-1 px-3 py-4">
              {navigation.map((entry, index) => {
                if ('type' in entry && entry.type === 'separator') {
                  return <div key={`sep-m-${index}`} className="my-2 mx-2 border-t border-dotted border-sidebar-border/60" />;
                }
                const item = entry as NavItem;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
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
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-[calc(100vh-4rem)] lg:min-h-screen">
          {children}
        </div>
      </main>

      {/* Floating AI Assistant */}
      <AskAIButton />
      
      {/* Floating Quick To-Do */}
      <QuickToDoButton />
    </div>
  );
}
