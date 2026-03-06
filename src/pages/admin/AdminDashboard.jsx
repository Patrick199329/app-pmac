import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import {
    Users,
    HelpCircle,
    PlayCircle,
    ShieldCheck,
    BarChart,
    ArrowUpRight,
    Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        users: 0,
        questions: 0,
        attempts: 0,
        activePasses: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const { count: qs } = await supabase.from('questions').select('*', { count: 'exact', head: true });
            const { count: atts } = await supabase.from('attempts').select('*', { count: 'exact', head: true });
            const { count: passes } = await supabase.from('access_passes').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');

            setStats({
                users: users || 0,
                questions: qs || 0,
                attempts: atts || 0,
                activePasses: passes || 0
            });
        };

        fetchStats();
    }, []);

    const menuCards = [
        { title: 'Controle de Acesso', desc: 'Gerenciar permissões e passes dos usuários.', icon: Users, link: '/admin/access', color: '#8b5cf6' },
        { title: 'Banco de Questões', desc: 'Editar perguntas e alternativas do teste BASIC.', icon: HelpCircle, link: '/admin/questions', color: '#10b981' },
        { title: 'Vídeos', desc: 'Configurar URL do vídeo introdutório obrigatório.', icon: PlayCircle, link: '/admin/videos', color: '#f59e0b' },
        { title: 'Entrega de Relatórios', desc: 'Mapping de PDFs por subtipo e plano (Básico/Ouro).', icon: FileText, link: '/admin/reports', color: '#ec4899' },
        { title: 'Integridade', desc: 'Validar consistência das perguntas cadastradas.', icon: ShieldCheck, link: '/admin/integrity', color: '#ef4444' },
        { title: 'Configuração', desc: 'Identidade visual, logos e cores da plataforma.', icon: Settings, link: '/admin/config', color: '#6366f1' },
    ];

    return (
        <div className="admin-page fade-in">
            <h1>Dashboard Administrativo</h1>
            <p className="admin-subtitle">Bem-vindo ao centro de controle da plataforma PMAC V2.</p>

            <div className="stats-grid">
                <div className="stat-card glass-panel">
                    <span className="stat-label">Usuários Totais</span>
                    <span className="stat-value">{stats.users}</span>
                </div>
                <div className="stat-card glass-panel">
                    <span className="stat-label">Passes Ativos</span>
                    <span className="stat-value">{stats.activePasses}</span>
                </div>
                <div className="stat-card glass-panel">
                    <span className="stat-label">Perguntas BÁSCIO</span>
                    <span className="stat-value">{stats.questions}</span>
                </div>
                <div className="stat-card glass-panel">
                    <span className="stat-label">Testes Realizados</span>
                    <span className="stat-value">{stats.attempts}</span>
                </div>
            </div>

            <div className="admin-menu-grid">
                {menuCards.map(card => (
                    <Link key={card.title} to={card.link} className="menu-card glass-panel">
                        <div className="card-icon" style={{ background: `${card.color}20`, color: card.color }}>
                            <card.icon size={24} />
                        </div>
                        <div className="card-content">
                            <h3>{card.title}</h3>
                            <p>{card.desc}</p>
                        </div>
                        <ArrowUpRight size={20} className="arrow-icon" />
                    </Link>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .admin-subtitle {
          color: var(--text-tertiary);
          margin-bottom: 2.5rem;
        }

        .admin-menu-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .menu-card {
          padding: 2rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          position: relative;
          transition: var(--transition-smooth);
        }

        .menu-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent-primary);
        }

        .card-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: var(--bg-tertiary) !important;
        }

        .card-content h3 { font-size: 1.125rem; margin-bottom: 0.25rem; color: var(--text-primary); }
        .card-content p { font-size: 0.875rem; color: var(--text-tertiary); }

        .arrow-icon {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          color: var(--text-tertiary);
          opacity: 0.5;
        }

        @media (max-width: 600px) {
          .admin-menu-grid { grid-template-columns: 1fr; }
        }
      `}} />
        </div>
    );
};

export default AdminDashboard;
