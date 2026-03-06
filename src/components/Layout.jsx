import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
  BarChart2,
  Menu,
  X,
  User,
  Settings,
  LogOut,
  ShieldCheck,
  PlayCircle,
  HelpCircle,
  FileText
} from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

const Layout = () => {
  const { settings } = useAppSettings();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState({ name: 'Carregando...', role: 'USER' });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(profile);
      }
    };
    fetchUser();
  }, [navigate]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const navItems = [
    { label: 'Acesso ao Teste', path: '/access', icon: ShieldCheck, role: 'USER' },
    { label: 'Meu Resultado', path: '/result/latest', icon: BarChart2, role: 'USER' },
  ];

  const adminItems = [
    { label: 'Controle de Acesso', path: '/admin/access', icon: User },
    { label: 'Banco de Questões', path: '/admin/questions', icon: HelpCircle },
    { label: 'Vídeos', path: '/admin/videos', icon: PlayCircle },
    { label: 'Entrega de Relatórios', path: '/admin/reports', icon: FileText },
    { label: 'Integridade', path: '/admin/integrity', icon: ShieldCheck },
    { label: 'Configuração', path: '/admin/config', icon: Settings },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const LogoContainer = () => {
    const { getCurrentLogo } = useAppSettings();
    const logo = getCurrentLogo();

    return (
      <div className="logo-wrapper">
        {logo ? (
          <img src={logo} alt={settings.app_name} className="app-logo-img" />
        ) : (
          <div className="logo">{settings.app_name}</div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar for Desktop / Drawer for Mobile */}
      <aside className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <LogoContainer />
          <button className="mobile-close" onClick={toggleSidebar}><X size={24} /></button>
        </div>

        <nav className="nav-group">
          {/* ... nav mapping remains the same ... */}
          <div className="nav-label">QUESTIONÁRIO</div>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}

          {user.role === 'ADMIN' && (
            <>
              <div className="nav-label admin-label">ADMINISTRAÇÃO</div>
              {adminItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${location.pathname === item.path || location.pathname.startsWith(item.path) ? 'active' : ''}`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user.name?.[0] || 'U'}</div>
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="layout-main">
        <header className="mobile-topbar">
          <button className="menu-toggle" onClick={toggleSidebar}><Menu size={24} /></button>
          <div className="topbar-logo font-bold" style={{ color: 'var(--text-primary)' }}>{settings.app_name}</div>
          <div className="topbar-spacer"></div>
        </header>

        <div className="main-content">
          <Outlet />
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          border-radius: 0;
          border-right: 1px solid var(--glass-border);
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
        }

        .logo-wrapper {
          display: flex;
          align-items: center;
          max-width: 80%;
        }

        .app-logo-img {
          max-height: 48px;
          object-fit: contain;
        }

        .logo {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--accent-primary);
        }

        .logo span {
          color: var(--text-primary);
        }

        .mobile-close {
          display: none;
          background: transparent;
          color: var(--text-secondary);
        }

        .nav-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-tertiary);
          margin: 1.5rem 0 0.5rem 0.75rem;
          letter-spacing: 0.1em;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          color: var(--text-secondary);
          transition: var(--transition-smooth);
          margin-bottom: 0.25rem;
        }

        .nav-item:hover {
          background: rgba(var(--accent-primary-rgb), 0.08);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--accent-primary);
          color: white;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .sidebar-footer {
          margin-top: auto;
          padding-top: 1rem;
          border-top: 1px solid var(--glass-border);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding: 0.5rem;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          background: var(--accent-secondary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px;
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          background: transparent;
          color: var(--accent-danger);
          font-weight: 600;
          transition: var(--transition-smooth);
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .layout-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .mobile-topbar {
          display: none;
          height: var(--topbar-height);
          background: var(--bg-secondary);
          padding: 0 1rem;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
        }

        .menu-toggle {
          background: transparent;
          color: var(--text-primary);
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: -100%;
            z-index: 1000;
            border-radius: 0;
          }
          
          .sidebar.open {
            left: 0;
          }
          
          .mobile-topbar {
            display: flex;
          }
          
          .mobile-close {
            display: block;
          }
        }
      `}} />
    </div>
  );
};

export default Layout;
