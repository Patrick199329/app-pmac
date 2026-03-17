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
    History,
    UserPlus,
    X,
    Trash2,
    Key
} from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const ManageAccess = () => {
    const [userData, setUserData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generatingReport, setGeneratingReport] = useState(false);
    const [search, setSearch] = useState('');
    const [showNewUserModal, setShowNewUserModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [creatingUser, setCreatingUser] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', plan: 'BASICO' });
    const [resetForm, setResetForm] = useState({ password: '' });

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

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreatingUser(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dxgxdgnuzimhgmwhdkcd.supabase.co';
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3hkZ251emltaGdtd2hka2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODkxMzYsImV4cCI6MjA4NzM2NTEzNn0.Dv5hMleFScPsE3xGWVdwM1qOD1Dgf6CZQ9DuNF_5C8U';

            const response = await fetch(`${baseUrl}/functions/v1/admin-create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                    'apikey': anonKey
                },
                body: JSON.stringify({ ...newUserForm, action: 'create' })
            });

            const resData = await response.json();
            if (!response.ok) throw new Error(resData.error || "Erro ao criar usuário");

            alert("Usuário criado com sucesso!");
            setShowNewUserModal(false);
            setNewUserForm({ name: '', email: '', password: '', plan: 'BASICO' });
            fetchData();
        } catch (err) {
            console.error("Create User Error:", err);
            alert(`Falha ao criar usuário: ${err.message}`);
        } finally {
            setCreatingUser(false);
        }
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
        
        fetchData();
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Tem certeza que deseja EXCLUIR permanentemente a conta de ${user.name}? Esta ação não pode ser desfeita.`)) {
            return;
        }

        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dxgxdgnuzimhgmwhdkcd.supabase.co';
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3hkZ251emltaGdtd2hka2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODkxMzYsImV4cCI6MjA4NzM2NTEzNn0.Dv5hMleFScPsE3xGWVdwM1qOD1Dgf6CZQ9DuNF_5C8U';

            const response = await fetch(`${baseUrl}/functions/v1/admin-create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                    'apikey': anonKey
                },
                body: JSON.stringify({ action: 'delete', targetUserId: user.id })
            });

            if (!response.ok) throw new Error("Erro ao excluir usuário");

            alert("Usuário excluído com sucesso.");
            fetchData();
        } catch (err) {
            console.error("Delete Error:", err);
            alert("Erro ao excluir usuário.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setCreatingUser(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dxgxdgnuzimhgmwhdkcd.supabase.co';
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3hkZ251emltaGdtd2hka2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODkxMzYsImV4cCI6MjA4NzM2NTEzNn0.Dv5hMleFScPsE3xGWVdwM1qOD1Dgf6CZQ9DuNF_5C8U';

            const response = await fetch(`${baseUrl}/functions/v1/admin-create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                    'apikey': anonKey
                },
                body: JSON.stringify({ 
                    action: 'reset-password', 
                    targetUserId: selectedUser.id,
                    password: resetForm.password 
                })
            });

            if (!response.ok) throw new Error("Erro ao resetar senha");

            alert("Senha resetada! O usuário deverá trocá-la no próximo acesso.");
            setShowResetModal(false);
            setResetForm({ password: '' });
        } catch (err) {
            console.error("Reset Error:", err);
            alert("Falha ao resetar senha.");
        } finally {
            setCreatingUser(false);
        }
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

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                }
                .modal-content {
                    width: 100%;
                    max-width: 500px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--glass-border);
                    border-radius: 1rem;
                    padding: 2rem;
                    position: relative;
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                .modal-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group label {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                }
                .form-group input, .form-group select {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--glass-border);
                    color: var(--text-primary);
                    padding: 0.8rem 1rem;
                    borderRadius: 0.5rem;
                    font-size: 1rem;
                }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .btn-primary {
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                    padding: 0.8rem 1.5rem;
                    border-radius: 0.5rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .btn-secondary {
                    background: transparent;
                    color: var(--text-secondary);
                    border: 1px solid var(--glass-border);
                    padding: 0.8rem 1.5rem;
                    border-radius: 0.5rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .close-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                }
                `
            }} />

            <div className="admin-header">
                <div className="header-title">
                    <h1>Controle de Acesso</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Monitoramento de prazos e acessos em tempo real.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button 
                        className="btn-primary" 
                        onClick={() => setShowNewUserModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <UserPlus size={18} />
                        Novo Usuário
                    </button>
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
                                                <button className="action-btn grant" onClick={() => handleGrant(u.id)} title="Dar Acesso"><ShieldCheck size={16} /></button>
                                            )}
                                            <button 
                                                className="action-btn report" 
                                                onClick={() => { setSelectedUser(u); setShowResetModal(true); }}
                                                title="Resetar Senha"
                                                style={{ color: 'var(--accent-warning)' }}
                                            >
                                                <Key size={16} />
                                            </button>
                                            <button 
                                                className="action-btn revoke" 
                                                onClick={() => handleDeleteUser(u)}
                                                title="Excluir Usuário"
                                                style={{ color: 'var(--accent-danger)' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {generatingReport && <LoadingOverlay message="Gerando Relatório Personalizado" subtitle="Isso pode levar alguns segundos..." />}
            
            {showNewUserModal && (
                <div className="modal-overlay fade-in">
                    <div className="modal-content glass-panel">
                        <div className="modal-header">
                            <h2>Cadastrar Novo Usuário</h2>
                            <button className="close-btn" onClick={() => setShowNewUserModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="modal-form">
                            <div className="form-group">
                                <label>Nome Completo</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={newUserForm.name}
                                    onChange={e => setNewUserForm({...newUserForm, name: e.target.value})}
                                    placeholder="Ex: João Silva" 
                                />
                            </div>
                            <div className="form-group">
                                <label>E-mail</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={newUserForm.email}
                                    onChange={e => setNewUserForm({...newUserForm, email: e.target.value})}
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Senha Temporária</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={newUserForm.password}
                                    onChange={e => setNewUserForm({...newUserForm, password: e.target.value})}
                                    placeholder="Crie uma senha inicial"
                                />
                            </div>
                            <div className="form-group">
                                <label>Plano Inicial</label>
                                <select 
                                    value={newUserForm.plan}
                                    onChange={e => setNewUserForm({...newUserForm, plan: e.target.value})}
                                >
                                    <option value="BASICO">Básico</option>
                                    <option value="OURO">Ouro</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowNewUserModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={creatingUser}>
                                    {creatingUser ? 'Criando...' : 'Cadastrar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showResetModal && (
                <div className="modal-overlay fade-in">
                    <div className="modal-content glass-panel">
                        <div className="modal-header">
                            <h2>Resetar Senha</h2>
                            <button className="close-btn" onClick={() => setShowResetModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Usuário: <strong>{selectedUser?.name}</strong><br/>
                            Defina uma nova senha temporária. Ele será solicitado a mudar no primeiro login.
                        </p>
                        <form onSubmit={handleResetPassword} className="modal-form">
                            <div className="form-group">
                                <label>Nova Senha Temporária</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={resetForm.password}
                                    onChange={e => setResetForm({ password: e.target.value })}
                                    placeholder="Senha provisória" 
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowResetModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={creatingUser}>
                                    {creatingUser ? 'Atualizando...' : 'Confirmar Novo Reset'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageAccess;
