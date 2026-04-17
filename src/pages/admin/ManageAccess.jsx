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
    const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', plan: 'BASICO', partnerId: '' });
    const [resetForm, setResetForm] = useState({ password: '' });
    const [currentProfile, setCurrentProfile] = useState(null);
    const [partnerQuota, setPartnerQuota] = useState(null);
    const [showQuotaModal, setShowQuotaModal] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [quotaForm, setQuotaForm] = useState({ basic_limit: 0, gold_limit: 0, basic_used: 0, gold_used: 0 });
    const [updatingQuota, setUpdatingQuota] = useState(false);
    const [allProfiles, setAllProfiles] = useState([]);

    const fetchData = async () => {
        setLoading(true);
        
        // 1. Get Current User and Role
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) return;

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        setCurrentProfile(profile);

        const isPartner = profile?.role === 'PARTNER';

        // 2. Fetch Quota if Partner
        if (isPartner) {
            const { data: quota } = await supabase.from('partner_quotas').select('*').eq('partner_id', currentUser.id).single();
            setPartnerQuota(quota);
        }

        // 3. Fetch Users
        let query = supabase.from('admin_user_controls_view').select('*');
        if (isPartner) {
            query = query.eq('partner_id', currentUser.id);
        }
        
        const { data: users, error: viewError } = await query.order('pass_granted_at', { ascending: false, nullsFirst: false });

        if (viewError) console.error("Error fetching admin controls view:", viewError);

        // Fetch roles and names from profiles for lookup
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, role');
        
        setAllProfiles(profiles || []);

        const merged = (users || []).map(u => ({
            ...u,
            role: profiles?.find(p => p.id === u.id)?.role || 'USER'
        }));

        setUserData(merged);
        setLoading(false);
    };

    const formatProfile = (u) => {
        if (u.latest_result_status !== 'DONE') return '-';
        
        const typeNames = {
            1: 'Perfeccionista',
            2: 'Ajudador',
            3: 'Realizador',
            4: 'Emocional',
            5: 'Analítico',
            6: 'Questionador',
            7: 'Entusiasta',
            8: 'Dominador',
            9: 'Mediador'
        };

        const baseTypeName = typeNames[u.latest_result_type] || '';

        if (u.plan !== 'OURO' || !u.latest_archetype_code) {
            return baseTypeName;
        }
        
        return u.latest_archetype_title || baseTypeName;
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreatingUser(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: { 
                    ...newUserForm, 
                    action: 'create',
                    partnerId: currentProfile?.role === 'PARTNER' 
                        ? currentProfile.id 
                        : (newUserForm.partnerId || null)
                }
            });

            if (error) throw error;

            alert("Usuário criado com sucesso!");
            setShowNewUserModal(false);
            setNewUserForm({ name: '', email: '', password: '', plan: 'BASICO', partnerId: '' });
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
        const user = userData.find(u => u.id === userId);
        const planToGrant = user?.plan || 'SEM_PLANO';

        const { error } = await supabase
            .from('access_passes')
            .insert([{
                user_id: userId,
                status: 'ACTIVE',
                granted_by_admin: true,
                plan: planToGrant
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
        try {
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: {
                    action: 'update-plan',
                    targetUserId: userId,
                    newPlan: newPlan
                }
            });

            if (error) throw error;

            setUserData(prev => prev.map(u => 
                u.id === userId ? { ...u, plan: newPlan === 'SEM_PLANO' ? null : newPlan } : u
            ));
            
            fetchData(); // Refresh everything to update status pills
        } catch (err) {
            console.error("Plan Update Error:", err);
            alert(`Falha ao atualizar plano: ${err.message}`);
        }
    };

    const handleOpenQuotaModal = async (user) => {
        setSelectedPartner(user);
        const { data: quota } = await supabase
            .from('partner_quotas')
            .select('*')
            .eq('partner_id', user.id)
            .maybeSingle();
        
        setQuotaForm({ 
            basic_limit: quota?.basic_limit || 0, 
            gold_limit: quota?.gold_limit || 0,
            basic_used: quota?.basic_used || 0,
            gold_used: quota?.gold_used || 0
        });
        setShowQuotaModal(true);
    };

    const handleUpdateQuota = async (e) => {
        e.preventDefault();
        if (!selectedPartner) return;
        setUpdatingQuota(true);
        try {
            const { error } = await supabase
                .from('partner_quotas')
                .upsert({
                    partner_id: selectedPartner.id,
                    basic_limit: parseInt(quotaForm.basic_limit),
                    gold_limit: parseInt(quotaForm.gold_limit),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            alert("Cota atualizada com sucesso!");
            setShowQuotaModal(false);
            fetchData();
        } catch (err) {
            console.error("Error updating quota:", err);
            alert("Falha ao atualizar cota: " + err.message);
        } finally {
            setUpdatingQuota(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Tem certeza que deseja EXCLUIR permanentemente a conta de ${user.name}? Esta ação não pode ser desfeita.`)) {
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: { action: 'delete', targetUserId: user.id }
            });

            if (error) throw error;

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
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: { 
                    action: 'reset-password', 
                    targetUserId: selectedUser.id,
                    password: resetForm.password 
                }
            });

            if (error) throw error;

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

            const { data, error } = await supabase.functions.invoke('generate-report', {
                body: {
                    subtypeCode,
                    userPlan: user.plan || 'BASICO',
                    targetUserId: user.id
                }
            });

            if (error) throw error;

            if (data?.url) {
                const link = document.createElement('a');
                link.href = data.url;
                link.setAttribute('download', '');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                throw new Error("URL de download não recebida.");
            }
        } catch (err) {
            console.error("Admin Report Error:", err);
            
            // Tenta extrair a mensagem de erro do corpo da resposta (caso seja JSON da Edge Function)
            let displayMessage = err.message;
            if (err.context?.json?.error) {
                displayMessage = err.context.json.error;
            } else if (err.details) {
                displayMessage = err.details;
            }

            alert(`Falha ao gerar relatório: ${displayMessage}`);
        } finally {
            setGeneratingReport(false);
        }
    };

    const filtered = userData.filter(u => {
        const formatted = formatProfile(u);
        return (
            u.name?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase()) ||
            u.id.toLowerCase().includes(search.toLowerCase()) ||
            formatted.toLowerCase().includes(search.toLowerCase())
        );
    });

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
                    width: 100%;
                    max-width: 100%;
                    padding: 2rem;
                    min-height: calc(100vh - 4rem);
                    background: var(--bg-primary);
                }
                .users-table-wrapper {
                    width: 100%;
                    max-height: calc(100vh - 280px); /* Leave room for header */
                    overflow: auto;
                    margin-top: 1rem;
                    /* Custom Scrollbar */
                    scrollbar-width: thin;
                    scrollbar-color: var(--accent-primary) var(--bg-secondary);
                    position: relative;
                }
                .users-table-wrapper::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .users-table-wrapper::-webkit-scrollbar-track {
                    background: var(--bg-secondary);
                    border-radius: 4px;
                }
                .users-table-wrapper::-webkit-scrollbar-thumb {
                    background: var(--accent-primary);
                    border-radius: 4px;
                    border: 2px solid var(--bg-secondary);
                }
                .admin-table {
                    width: 100%;
                    min-width: 1200px;
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .admin-table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    background: var(--bg-secondary);
                    box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);
                }
                .admin-table th:nth-child(1), .admin-table td:nth-child(1) { width: 220px; }
                .admin-table th:nth-child(2), .admin-table td:nth-child(2) { width: 130px; }
                .admin-table th:nth-child(3), .admin-table td:nth-child(3) { width: 100px; }
                .admin-table th:nth-child(4), .admin-table td:nth-child(4) { width: 100px; }
                .admin-table th:nth-child(5) { width: 150px; }
                .admin-table th:nth-child(9), .admin-table td:nth-child(9) { width: 140px; }

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
                    z-index: 2000;
                    padding: 2rem 1rem;
                    overflow-y: auto;
                }
                .modal-content {
                    width: 100%;
                    max-width: 500px;
                    max-height: calc(100vh - 4rem);
                    overflow-y: auto;
                    background: var(--bg-secondary);
                    border: 1px solid var(--glass-border);
                    border-radius: 1rem;
                    padding: 2rem;
                    position: relative;
                    margin: auto;
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
                    border-radius: 0.5rem;
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
                .quota-indicator {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--glass-border);
                    padding: 0.5rem 1rem;
                    border-radius: 0.6rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                }
                .quota-label {
                    color: var(--text-tertiary);
                    font-weight: 600;
                }
                .quota-value {
                    font-weight: 800;
                }
                .quota-value.success { color: var(--accent-success); }
                .quota-value.danger { color: var(--accent-danger); }
                `
            }} />

            <div className="admin-header">
                <div className="header-title">
                    <h1>Controle de Acesso</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        {currentProfile?.role === 'PARTNER' 
                            ? "Gerencie os usuários cadastrados por sua unidade."
                            : "Monitoramento de prazos e acessos em tempo real."}
                    </p>
                    {partnerQuota && (
                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                            <div className="quota-indicator">
                                <span className="quota-label">Básico:</span>
                                <span className={`quota-value ${partnerQuota.basic_used >= partnerQuota.basic_limit ? 'danger' : 'success'}`}>
                                    {partnerQuota.basic_used}/{partnerQuota.basic_limit}
                                </span>
                            </div>
                            <div className="quota-indicator">
                                <span className="quota-label">Ouro:</span>
                                <span className={`quota-value ${partnerQuota.gold_used >= partnerQuota.gold_limit ? 'danger' : 'success'}`}>
                                    {partnerQuota.gold_used}/{partnerQuota.gold_limit}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button 
                        className="btn-primary" 
                        onClick={() => {
                            if (currentProfile?.role === 'PARTNER') {
                                if (!partnerQuota) {
                                    alert("Cota não configurada. Entre em contato com o administrador.");
                                    return;
                                }
                                
                                const hasBasic = partnerQuota.basic_used < partnerQuota.basic_limit;
                                const hasGold = partnerQuota.gold_used < partnerQuota.gold_limit;

                                if (!hasBasic && !hasGold) {
                                    alert("Sua cota total de usuários esgotou. Entre em contato com o suporte.");
                                    return;
                                }

                                // Auto-select available plan
                                if (!hasBasic && hasGold) {
                                    setNewUserForm(prev => ({ ...prev, plan: 'OURO' }));
                                } else if (!hasBasic && !hasGold) {
                                    setNewUserForm(prev => ({ ...prev, plan: 'SEM_PLANO' }));
                                } else {
                                    setNewUserForm(prev => ({ ...prev, plan: 'BASICO' }));
                                }
                            } else {
                                // Admin defaults to SEM_PLANO for new partners/users if they prefer
                                setNewUserForm(prev => ({ ...prev, plan: 'SEM_PLANO' }));
                            }
                            setShowNewUserModal(true);
                        }}
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
                            {currentProfile?.role === 'ADMIN' && <th>Vínculo</th>}
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
                                                <div className="status-pill" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                                                    <XCircle size={12} />
                                                    <span>Sem Plano</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <select
                                            className="plan-select"
                                            value={u.plan || 'SEM_PLANO'}
                                            onChange={(e) => handleUpdatePlan(u.id, e.target.value)}
                                            disabled={currentProfile?.role === 'PARTNER'} 
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--glass-border)',
                                                color: 'var(--text-primary)',
                                                padding: '0.3rem 0.5rem',
                                                borderRadius: '0.4rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                cursor: currentProfile?.role === 'PARTNER' ? 'not-allowed' : 'pointer',
                                                opacity: currentProfile?.role === 'PARTNER' ? 0.6 : 1
                                            }}
                                        >
                                            <option value="SEM_PLANO">Sem Plano</option>
                                            <option value="BASICO">Básico</option>
                                            <option value="OURO">Ouro</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            className="plan-select"
                                            value={u.role || 'USER'}
                                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                            disabled={currentProfile?.role === 'PARTNER'} // Partners cannot change roles
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--glass-border)',
                                                color: 'var(--text-primary)',
                                                padding: '0.3rem 0.5rem',
                                                borderRadius: '0.4rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                cursor: currentProfile?.role === 'PARTNER' ? 'not-allowed' : 'pointer',
                                                opacity: currentProfile?.role === 'PARTNER' ? 0.6 : 1
                                            }}
                                        >
                                            <option value="USER">Usuário</option>
                                            <option value="PARTNER">Parceiro</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </td>
                                    {currentProfile?.role === 'ADMIN' && (
                                        <td>
                                            <span style={{ fontSize: '0.8rem', color: u.partner_id ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                                                {u.partner_id ? (allProfiles.find(p => p.id === u.partner_id)?.name || 'Parceiro') : '-'}
                                            </span>
                                        </td>
                                    )}
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
                                                    <span className="profile-type">{formatProfile(u)}</span>
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
                                                    {currentProfile?.role === 'ADMIN' && (
                                                        <button className="action-btn audit" onClick={() => window.open(`/admin/audit/${u.id}`, '_blank')} title="Auditoria">
                                                            <History size={16} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {isActive ? (
                                                <button className="action-btn revoke" onClick={() => handleRevoke(u.id)} title="Revogar Acesso"><ShieldX size={16} /></button>
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
                                            {currentProfile?.role === 'ADMIN' && u.role === 'PARTNER' && (
                                                <button 
                                                    className="action-btn audit" 
                                                    onClick={() => handleOpenQuotaModal(u)}
                                                    title="Gerenciar Cota"
                                                    style={{ color: 'var(--accent-primary)' }}
                                                >
                                                    <Calendar size={16} />
                                                </button>
                                            )}
                                            {currentProfile?.role === 'ADMIN' && (
                                                <button 
                                                    className="action-btn revoke" 
                                                    onClick={() => handleDeleteUser(u)}
                                                    title="Excluir Usuário"
                                                    style={{ color: 'var(--accent-danger)' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
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
                                    <option value="SEM_PLANO">Sem Plano</option>
                                    {(currentProfile?.role !== 'PARTNER' || partnerQuota?.basic_used < partnerQuota?.basic_limit) && (
                                        <option value="BASICO">Básico</option>
                                    )}
                                    {(currentProfile?.role !== 'PARTNER' || partnerQuota?.gold_used < partnerQuota?.gold_limit) && (
                                        <option value="OURO">Ouro</option>
                                    )}
                                </select>
                            </div>
                            {currentProfile?.role === 'ADMIN' && (
                                <div className="form-group">
                                    <label>Vincular a Parceiro (Opcional)</label>
                                    <select 
                                        value={newUserForm.partnerId}
                                        onChange={e => setNewUserForm({...newUserForm, partnerId: e.target.value})}
                                    >
                                        <option value="">Nenhum (Uso Direto)</option>
                                        {allProfiles.filter(p => p.role === 'PARTNER').map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
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
            {showQuotaModal && (
                <div className="modal-overlay fade-in">
                    <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Gerenciar Cota</h2>
                            <button className="close-btn" onClick={() => setShowQuotaModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Parceiro: <strong>{selectedPartner?.name}</strong><br/>
                            Uso Atual: {quotaForm.basic_used} Básico / {quotaForm.gold_used} Ouro
                        </p>
                        <form onSubmit={handleUpdateQuota} className="modal-form">
                            <div className="form-group">
                                <label>Limite Plano Básico</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    required 
                                    value={quotaForm.basic_limit}
                                    onChange={e => setQuotaForm({...quotaForm, basic_limit: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Limite Plano Ouro</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    required 
                                    value={quotaForm.gold_limit}
                                    onChange={e => setQuotaForm({...quotaForm, gold_limit: e.target.value})}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowQuotaModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={updatingQuota}>
                                    {updatingQuota ? 'Atualizando...' : 'Salvar Alterações'}
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
