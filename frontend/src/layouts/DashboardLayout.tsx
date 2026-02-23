import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Menu,
  X,
  Globe,
  LayoutDashboard,
  Hotel,
  FileText,
  Plane,
  Bus,
  Package,
  Receipt,
  Users,
  Building2,
  BarChart3,
  Settings,
  Bell,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Rocket,
  UserPlus,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { OrderDraftProvider } from '../contexts/OrderDraftContext';
import { MenuItem, UserRole, ROLE_NAMES } from '../types';
import Dropdown from '../components/common/Dropdown';
import Badge from '../components/common/Badge';
import MaintenanceBanner from '../components/MaintenanceBanner';
import logo from '../assets/logo.png';
import { notificationsApi, type NotificationItem } from '../services/api';

const menuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    path: '/dashboard',
    roles: ['super_admin', 'admin_pusat', 'admin_koordinator', 'invoice_koordinator', 'tiket_koordinator', 'visa_koordinator', 'role_invoice_saudi', 'role_hotel', 'role_bus', 'role_accounting', 'owner']
  },
  {
    title: 'Owners Wilayah',
    icon: <Users className="w-5 h-5" />,
    path: '/dashboard/koordinator/owners',
    roles: ['super_admin', 'admin_pusat', 'admin_koordinator', 'invoice_koordinator', 'tiket_koordinator', 'visa_koordinator']
  },
  {
    title: 'Products',
    icon: <Package className="w-5 h-5" />,
    path: '/dashboard/products',
    roles: ['super_admin', 'admin_pusat', 'admin_koordinator', 'invoice_koordinator', 'tiket_koordinator', 'visa_koordinator', 'role_hotel', 'role_bus', 'owner']
  },
  {
    title: 'Visa',
    icon: <FileText className="w-5 h-5" />,
    path: '/dashboard/visa',
    roles: ['super_admin', 'admin_koordinator', 'visa_koordinator']
  },
  {
    title: 'Tiket',
    icon: <Plane className="w-5 h-5" />,
    path: '/dashboard/tickets',
    roles: ['super_admin', 'admin_koordinator', 'tiket_koordinator']
  },
  {
    title: 'Invoice',
    icon: <Receipt className="w-5 h-5" />,
    path: '/dashboard/orders-invoices',
    roles: ['admin_pusat', 'admin_koordinator', 'invoice_koordinator', 'tiket_koordinator', 'visa_koordinator', 'role_accounting', 'owner', 'super_admin', 'role_invoice_saudi']
  },
  {
    title: 'Users',
    icon: <Users className="w-5 h-5" />,
    path: '/dashboard/users',
    roles: ['super_admin', 'admin_pusat']
  },
  {
    title: 'Branches',
    icon: <Building2 className="w-5 h-5" />,
    path: '/dashboard/branches',
    roles: ['super_admin', 'admin_pusat']
  },
  {
    title: 'Buat Akun',
    icon: <UserPlus className="w-5 h-5" />,
    path: '/dashboard/admin-pusat/users',
    roles: ['super_admin', 'admin_pusat']
  },
  {
    title: 'Reports',
    icon: <BarChart3 className="w-5 h-5" />,
    path: '/dashboard/reports',
    roles: ['super_admin', 'admin_pusat', 'role_accounting']
  },
  {
    title: 'Chart of Accounts',
    icon: <FileText className="w-5 h-5" />,
    path: '/dashboard/accounting/chart-of-accounts',
    roles: ['role_accounting']
  },
  {
    title: 'Laporan Keuangan',
    icon: <FileText className="w-5 h-5" />,
    path: '/dashboard/accounting/financial-report',
    roles: ['role_accounting']
  },
  {
    title: 'Piutang (AR)',
    icon: <BarChart3 className="w-5 h-5" />,
    path: '/dashboard/accounting/aging',
    roles: ['role_accounting']
  },
  {
    title: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    path: '/dashboard/settings',
    roles: ['super_admin', 'admin_pusat']
  },
  {
    title: 'System Logs',
    icon: <FileText className="w-5 h-5" />,
    path: '/dashboard/super-admin/logs',
    roles: ['super_admin']
  },
  {
    title: 'Maintenance',
    icon: <Bell className="w-5 h-5" />,
    path: '/dashboard/super-admin/maintenance',
    roles: ['super_admin']
  }
];

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = () => {
    notificationsApi.unreadCount()
      .then((res) => { if (res.data.success && res.data.data) setUnreadCount(res.data.data.count); })
      .catch(() => {});
  };

  const fetchNotifications = () => {
    setNotificationsLoading(true);
    notificationsApi.list({ limit: 20 })
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) setNotifications(res.data.data);
      })
      .catch(() => {})
      .finally(() => setNotificationsLoading(false));
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (notificationOpen) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [notificationOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setNotificationOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.read_at) {
      notificationsApi.markRead(n.id).then(() => {
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }).catch(() => {});
    }
    setNotificationOpen(false);
    const d = n.data as { invoice_id?: string; order_id?: string } | undefined;
    if (d?.invoice_id || d?.order_id) {
      navigate('/dashboard/orders-invoices');
    } else {
      navigate('/dashboard');
    }
  };

  const handleMarkAllRead = () => {
    notificationsApi.markAllRead()
      .then(() => {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
      })
      .catch(() => {});
  };

  const formatNotificationTime = (created_at: string) => {
    const d = new Date(created_at);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return 'Baru saja';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} menit lalu`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} jam lalu`;
    return d.toLocaleDateString('id-ID');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Filter menu based on user role. Super Admin HANYA akses: Dashboard + Monitoring, Logs, Maintenance, Language, Deploy (tidak ada Invoice, dll)
  const filteredMenuItems = user
    ? user.role === 'super_admin'
      ? menuItems.filter(item => item.roles.includes('super_admin') && (item.path === '/dashboard' || item.path.startsWith('/dashboard/super-admin') || item.path === '/dashboard/reports'))
      : menuItems.filter(item => item.roles.includes(user.role))
    : [];

  const currentPage = filteredMenuItems.find(item => item.path === location.pathname);

  const userMenuItems = [
    ...(user?.role !== 'super_admin'
      ? [
          { id: 'profile', label: 'My Profile', icon: <User className="w-4 h-4" />, onClick: () => navigate('/dashboard/profile') },
          ...(user?.role !== 'owner' ? [{ id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, onClick: () => navigate('/dashboard/settings') }] : [])
        ]
      : []),
    {
      id: 'logout',
      label: 'Logout',
      icon: <LogOut className="w-4 h-4" />,
      onClick: handleLogout,
      danger: true,
      divider: true
    }
  ];

  const Sidebar = ({ mobile = false }) => {
    const isCollapsed = !mobile && sidebarCollapsed;
    
    return (
      <div className="h-full flex flex-col sidebar-login-bg border-r border-white/10 overflow-hidden shadow-lg">
        {/* Logo */}
        <div className={`px-4 py-5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-white/10`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden ring-1 ring-white/10">
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-100">Bintang Global</h1>
                <p className="text-xs text-slate-400">Umroh & Travel</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden ring-1 ring-white/10">
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            </div>
          )}
          {mobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {filteredMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <div key={item.path} className="relative group">
                <button
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-primary-200'
                  }`}
                  title={isCollapsed ? item.title : ''}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.title}</span>
                      {item.badge && (
                        <Badge variant="error" size="sm">
                          {item.badge}
                        </Badge>
                      )}
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </>
                  )}
                </button>
                {isCollapsed && (
                  <div className="fixed ml-20 px-3 py-2 bg-primary-600 text-white text-xs rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap pointer-events-none shadow-xl z-50">
                    {item.title}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile */}
        {!isCollapsed && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 rounded-xl border border-white/10">
              <div className="w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center text-sm font-semibold text-white">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user ? ROLE_NAMES[user.role] : ''}</p>
              </div>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="p-3 border-t border-white/10 flex justify-center">
            <div className="w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center text-sm font-semibold text-white">
              {user?.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {!mobile && (
          <div className="p-3 border-t border-white/10">
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:bg-white/10 hover:text-white rounded-xl transition-colors text-sm"
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-semibold">Sembunyikan</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  /* Mobile bottom nav: 4 key travel app actions (seperti Traveloka/Agoda) */
  const bottomNavItems = [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { path: '/dashboard/orders-invoices', label: 'Trip Saya', icon: Receipt },
    { path: '/dashboard/products', label: 'Paket', icon: Package },
  ];
  const showBottomNav = user && !['super_admin'].includes(user.role) && filteredMenuItems.some(m => m.path === '/dashboard' || m.path === '/dashboard/orders-invoices' || m.path === '/dashboard/products');

  if (user?.role === 'owner' && user?.owner_status && user.owner_status !== 'active' && location.pathname !== '/dashboard/owner-activation') {
    return <Navigate to="/dashboard/owner-activation" replace />;
  }

  return (
    <div className="min-h-screen app-bg flex overflow-x-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 transform transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar mobile />
      </div>

      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`fixed h-screen transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
          <Sidebar />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex-shrink-0 p-2 text-stone-600 hover:text-primary-600 hover:bg-stone-100 rounded-xl transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 truncate">
                  {currentPage?.title || 'Dashboard'}
                </h2>
                <p className="text-xs text-stone-500 hidden sm:block">Bintang Global Travel</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  className="relative p-2 text-stone-600 hover:text-primary-600 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-xs font-semibold rounded-full ring-2 ring-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-travel-lg border border-stone-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-stone-900">Notifikasi</h3>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Tandai semua dibaca
                        </button>
                      )}
                    </div>
                    {notificationsLoading ? (
                      <p className="px-4 py-6 text-sm text-stone-500 text-center">Memuat...</p>
                    ) : notifications.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-stone-500 text-center">Tidak ada notifikasi</p>
                    ) : (
                      <ul className="py-1">
                        {notifications.map((n) => (
                          <li key={n.id}>
                            <button
                              type="button"
                              onClick={() => handleNotificationClick(n)}
                              className={`w-full px-4 py-3 text-left text-sm hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 ${!n.read_at ? 'bg-primary-50/50' : ''}`}
                            >
                              <p className="font-medium text-stone-900">{n.title}</p>
                              {n.message && <p className="text-stone-500 mt-0.5 line-clamp-2">{n.message}</p>}
                              <p className="text-xs text-stone-400 mt-1">{formatNotificationTime(n.created_at)}</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <Dropdown
                trigger={
                  <div className="flex items-center gap-2 px-2 sm:px-3 py-2 hover:bg-stone-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-stone-200">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-semibold text-stone-900 truncate max-w-[120px]">{user?.name}</p>
                      <p className="text-xs text-stone-500">{user ? ROLE_NAMES[user.role] : ''}</p>
                    </div>
                  </div>
                }
                items={userMenuItems}
                align="right"
              />
            </div>
          </div>
        </header>

        <main className={`flex-1 p-4 sm:p-6 main-content ${showBottomNav ? 'pb-24' : ''}`} style={showBottomNav ? { paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' } : undefined}>
          <div className="mb-4">
            <MaintenanceBanner />
          </div>
          {user?.role === 'super_admin' && location.pathname !== '/dashboard' && !location.pathname.startsWith('/dashboard/super-admin') ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <OrderDraftProvider>
              <Outlet />
            </OrderDraftProvider>
          )}
        </main>

        {/* Mobile Bottom Navigation - Travel app style (green) */}
        {showBottomNav && (
          <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-primary-100 shadow-travel-lg lg:hidden pb-safe" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-around h-16 px-2">
              {bottomNavItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleNavigate(item.path)}
                    className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-2 rounded-xl transition-colors min-w-0 touch-manipulation ${
                      isActive ? 'text-primary-600 bg-primary-50 font-semibold' : 'text-stone-500 active:bg-primary-50/50'
                    }`}
                  >
                    <Icon className="w-6 h-6 flex-shrink-0" />
                    <span className="text-[11px] font-medium truncate w-full text-center">{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex flex-col items-center justify-center flex-1 gap-0.5 py-2 rounded-xl text-stone-500 active:bg-stone-100 transition-colors min-w-0 touch-manipulation"
              >
                <Menu className="w-6 h-6 flex-shrink-0" />
                <span className="text-[11px] font-medium">Menu</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};

export default DashboardLayout;