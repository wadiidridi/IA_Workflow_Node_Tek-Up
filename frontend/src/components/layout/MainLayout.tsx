import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { LayoutDashboard, Bot, GitBranch, LogOut, Menu, X } from 'lucide-react';

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
      <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-[#2e2e38] text-white flex flex-col transition-all duration-200`}>
        {/* Top: Logo + Toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'} border-b border-white/10`}>
          <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
            <img src="/ey.png" alt="EY" className="h-8 w-8 object-contain flex-shrink-0" />
            {!collapsed && <span className="text-sm font-bold text-[#FFE600] truncate">AI Workflow Builder</span>}
          </div>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="text-white/60 hover:text-white cursor-pointer" title="Collapse sidebar">
              <X className="h-4 w-4" />
            </button>
          )}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="text-white/60 hover:text-white cursor-pointer mt-2" title="Expand sidebar">
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-3'} space-y-1`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[#FFE600] text-[#2e2e38] font-semibold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: User + Logout */}
        <div className={`border-t border-white/10 ${collapsed ? 'p-2' : 'p-4'}`}>
          {!collapsed && (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium text-white/90 truncate">{user?.email}</div>
                <div className="text-white/50 text-xs">{user?.role}</div>
              </div>
              <button onClick={handleLogout} className="text-white/50 hover:text-white cursor-pointer" title="Logout">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
          {collapsed && (
            <button onClick={handleLogout} className="w-full flex justify-center text-white/50 hover:text-white py-2 cursor-pointer" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-[#f6f6fa]">
        <Outlet />
      </main>
    </div>
  );
}
