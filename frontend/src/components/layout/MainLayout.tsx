import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { LayoutDashboard, Bot, GitBranch, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/workflows', label: 'Workflows', icon: GitBranch },
];

export function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} border-r bg-muted/30 flex flex-col transition-all duration-200`}>
        <div className={`border-b flex items-center ${collapsed ? 'p-3 justify-center' : 'p-4 gap-3'}`}>
          <img src="/ey.png" alt="EY" className="h-8 w-8 object-contain flex-shrink-0" />
          {!collapsed && <h1 className="text-lg font-bold truncate">AI Workflow Builder</h1>}
        </div>
        <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>
        <div className={`border-t ${collapsed ? 'p-2' : 'p-4'}`}>
          {!collapsed && (
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm">
                <div className="font-medium truncate">{user?.email}</div>
                <div className="text-muted-foreground text-xs">{user?.role}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          {collapsed && (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="w-full mb-2" title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((c) => !c)}
            className={collapsed ? 'w-full' : ''}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
