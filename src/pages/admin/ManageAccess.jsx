import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import {
    ShieldCheck,
    ShieldX,
    Search,
    CheckCircle2,
    XCircle,
    Calendar,
    FileText,
    History
} from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const ManageAccess = () => {
    const [userData, setUserData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generatingReport, setGeneratingReport] = useState(false);
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        setLoading(true);
        const { data: users, error: viewError } = await supabase
            .from('admin_user_controls_view')
            .select('*')
            .order('pass_granted_at', { ascending: false, nullsFirst: false });

        if (viewError) console.error("Error fetching admin controls view:", viewError);

        // Fetch roles from profiles to allow management
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, role');

        const merged = (users || []).map(u => ({
            ...u,
            role: profiles?.find(p => p.id === u.id)?.role || 'USER'
        }));

        setUserData(merged);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleGrant = async (userId) => {
        const { error } = await supabase
            .from('access_passes')
            .insert([{
                user_id: userId,
                status: 'ACTIVE',
                granted_by_admin: true,
                plan: 'BASICO'
            }]);
        if (!error) fetchData();
    };

    const handleUpdateRole = async (userId, newRole) => {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);
        if (!error) fetchData();
    };

    const handleUpdatePlan = async (userId, newPlan) => {
        setUserData(prev => prev.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
        const { data: activePass } = await supabase
            .from('access_passes')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'ACTIVE')
            .limit(1)
            .single();

        if (activePass) {
            await supabase.from('access_passes').update({ plan: newPlan }).eq('id', activePass.id);
        } else {
            await supabase.from('profiles').update({ plan: newPlan }).eq('id', userId);
        }

        const { data: refreshed } = await supabase
            .from('admin_user_controls_view')
            .select('*')
            .order('pass_granted_at', { ascending: false, nullsFirst: false });
        if (refreshed) setUserData(refreshed);
    };

    const handleRevoke = async (userId) => {
        const { data: currentPass } = await supabase
            .from('access_passes')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (currentPass) {
            const { error } = await supabase
                .from('access_passes')
                .update({ status: 'REVOKED' })
                .eq('id', currentPass.id);
            if (!error) fetchData();
        }
    };

    const handleViewReport = async (user) => {
        if (!user.latest_result_type) {
            alert("Este usuário ainda não concluiu o teste ou não possui um perfil definido.");
            return;
        }

        setGeneratingReport(true);
        try {
            // Buscamos a tentativa real para pegar o código "winner" (ex: ST4A) de forma precisa
            const { data: attempt, error: attError } = await supabase
                .from('attempts')
                .select('meta_json')
                .eq('id', user.latest_attempt_id)
                .single();

            if (attError || !attempt) throw new Error("Não foi possível localizar os dados da tentativa.");

            const isOuro = (user.plan || 'BASICO') === 'OURO';
            const winnerCode = attempt.meta_json?.winner; // Ex: ST4A

            // Constrói o código: T2 para Básico, T2A para Ouro
            let subtypeCode = `T${user.latest_result_type}`;
            if (isOuro && winnerCode) {
                subtypeCode += winnerCode.slice(-1);
            }

            console.log(`Admin Gerando (${isOuro ? 'OURO' : 'BASICO'}): ${subtypeCode} para ${user.name}`);

            const { data: { session } } = await supabase.auth.getSession();

            const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dxgxdgnuzimhgmwhdkcd.supabase.co';
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3hkZ251emltaGdtd2hka2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODkxMzYsImV4cCI6MjA4NzM2NTEzNn0.Dv5hMleFScPsE3xGWVdwM1qOD1Dgf6CZQ9DuNF_5C8U';

            const response = await fetch(`${baseUrl}/functions/v1/generate-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                    'apikey': anonKey
                },
                body: JSON.stringify({
                    subtypeCode,
                    userPlan: user.plan || 'BASICO',
                    targetUserId: user.id // O segredo para gerar para outros
                })
            });

            const resText = await response.text();
            let resData = null;
            try { resData = JSON.parse(resText); } catch (e) { }

            if (!response.ok) {
                throw new Error(resData?.error || resText || `Erro HTTP ${response.status}`);
            }

            if (resData?.url) {
                const link = document.createElement('a');
                link.href = resData.url;
                link.setAttribute('download', '');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                throw new Error("URL de download não recebida.");
            }
        } catch (err) {
            console.error("Admin Report Error:", err);
            alert(`Falha ao gerar relatório: ${err.message}`);
        } finally {
            setGeneratingReport(false);
        }
    };

    const filtered = userData.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase()) ||
        `T${u.latest_result_type}`.toLowerCase().includes(search.toLowerCase()) ||
        u.latest_archetype_title?.toLowerCase().includes(search.toLowerCase())
    );

    const getDaysRemaining = (expiryDate) => {
        if (!expiryDate) return null;
        const diff = new Date(expiryDate) - new Date();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    if (loading && userData.length === 0) {
        return <LoadingOverlay message="Gerenciando Usuários" subtitle="Buscando lista completa..." />;
    }

    return (
        <div className="admin-page fade-in">
            <style dangerouslySetInnerHTML={{
                __html: `
                .admin-page {
                    max-width: 1400px;
                    margin: 0 auto;
                    width: 100%;
                }
                .users-table-wrapper {
                    width: 100%;
                    overflow-x: auto;
                }
                .admin-table {
                    width: 100%;
                }
                .admin-table th:nth-child(1), .admin-table td:nth-child(1) { width: 220px; }
                .admin-table th:nth-child(2), .admin-table td:nth-child(2) { width: 130px; }
                .admin-table th:nth-child(3), .admin-table td:nth-child(3) { width: 100px; }
                .admin-table th:nth-child(4), .admin-table td:nth-child(4) { width: 100px; }
                .admin-table th:nth-child(8), .admin-table td:nth-child(8) { width: 140px; }
                `
            }} />

            <div className="admin-header">
                <div className="header-title">
                    <h1>Controle de Acesso</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Monitoramento de prazos e acessos em tempo real.
                    </p>
                </div>
                <div className="search-bar glass-panel">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, e-mail ou ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="users-table-wrapper glass-panel">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Usuário</th>
                            <th>Passe</th>
                            <th>Plano</th>
                            <th>Cargo</th>
                            <th>Conclusão</th>
                            <th>Perfil</th>
                            <th>Último Login</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(u => {
                            const isActive = u.pass_status === 'ACTIVE';
                            const passDays = getDaysRemaining(u.pass_expiry_date);
                            const completionDays = getDaysRemaining(u.completion_deadline);

                            return (
                                <tr key={u.id}>
                                    <td>
                                        <div className="user-cell">
                                            <div className="user-avatar">{u.name?.[0]?.toUpperCase() || '?'}</div>
                                            <div className="user-info-text">
                                                <span className="user-name">{u.name || 'Sem nome'}</span>
                                                <span className="user-email">{u.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="status-indicator">
                                            {isActive ? (
                                                <div className={`status-pill ${passDays > 0 ? 'success' : 'danger'}`}>
                                                    <CheckCircle2 size={12} />
                                                    <span>{passDays > 0 ? `Ativo (${passDays}d)` : 'Expirado'}</span>
                                                </div>
                                            ) : (
                                                <div className="status-pill danger">
                                                    <XCircle size={12} />
                                                    <span>Inativo</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <select
                                            className="plan-select"
                                            value={u.plan || 'BASICO'}
                                            onChange={(e) => handleUpdatePlan(u.id, e.target.value)}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--glass-border)',
                                                color: 'var(--text-primary)',
                                                padding: '0.3rem 0.5rem',
                                                borderRadius: '0.4rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="BASICO">Básico</option>
                                            <option value="OURO">Ouro</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            className="plan-select"
                                            value={u.role || 'USER'}
                                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--glass-border)',
                                                color: 'var(--text-primary)',
                                                padding: '0.3rem 0.5rem',
                                                borderRadius: '0.4rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="USER">Usuário</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </td>
                                    <td>
                                        {u.test_started_at ? (
                                            <div className="status-indicator">
                                                <div className={`status-pill ${completionDays > 0 ? 'warning' : 'danger'}`}>
                                                    <Calendar size={12} />
                                                    <span>{completionDays > 0 ? `${completionDays}d` : 'Expirado'}</span>
                                                </div>
                                            </div>
                                        ) : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>-</span>}
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.8rem' }}>
                                            {u.latest_result_status === 'DONE' ? (
                                                <div className="profile-pill">
                                                    <span className="profile-type">T{u.latest_result_type}</span>
                                                </div>
                                            ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : '-'}
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            {u.latest_attempt_id && (
                                                <>
                                                    <button className="action-btn report" onClick={() => handleViewReport(u)} title="Ver Relatório">
                                                        <FileText size={16} />
                                                    </button>
                                                    <button className="action-btn audit" onClick={() => window.open(`/admin/audit/${u.id}`, '_blank')} title="Auditoria">
                                                        <History size={16} />
                                                    </button>
                                                </>
                                            )}
                                            {isActive ? (
                                                <button className="action-btn revoke" onClick={() => handleRevoke(u.id)}><ShieldX size={16} /></button>
                                            ) : (
                                                <button className="action-btn grant" onClick={() => handleGrant(u.id)}><ShieldCheck size={16} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {generatingReport && <LoadingOverlay message="Gerando Relatório Personalizado" subtitle="Isso pode levar alguns segundos..." />}
        </div>
    );
};

export default ManageAccess;
