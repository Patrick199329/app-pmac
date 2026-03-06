import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
    ClipboardList,
    Printer,
    ChevronLeft,
    CheckCircle2,
    AlertCircle,
    History,
    ArrowRight
} from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const AuditReport = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [journey, setJourney] = useState([]);

    useEffect(() => {
        const fetchAuditData = async () => {
            setLoading(true);

            try {
                // 1. Fetch User Data (using the view we know works and has all info)
                const { data: userData, error: userError } = await supabase
                    .from('admin_user_controls_view')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (userError || !userData) {
                    console.error("Error fetching user for audit:", userError);
                    // Fallback to basic profile if view fails for some reason
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', userId)
                        .single();
                    setUser(profile || { name: 'Usuário não encontrado', id: userId });
                } else {
                    setUser(userData);
                }

                // 2. Fetch All Attempts for this user
                const { data: attempts, error: attError } = await supabase
                    .from('attempts')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: true });

                if (attError) throw attError;

                if (!attempts || attempts.length === 0) {
                    setJourney([]);
                    setLoading(false);
                    return;
                }

                // 3. For each attempt, fetch answers
                const expandedJourney = await Promise.all(attempts.map(async (att) => {
                    const { data: answers, error: ansError } = await supabase
                        .from('answers')
                        .select(`
                            id,
                            question_id,
                            option_id,
                            questions:questions (text, order_index),
                            options:options (text, code, score_type)
                        `)
                        .eq('attempt_id', att.id)
                        .order('created_at', { ascending: true });

                    return {
                        ...att,
                        answers: (answers || []).map(ans => ({
                            ...ans,
                            // Ensure questions/options are correctly mapped if keys differ
                            questions: ans.questions,
                            options: ans.options
                        }))
                    };
                }));

                setJourney(expandedJourney);
            } catch (err) {
                console.error("Audit Report Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAuditData();
    }, [userId]);

    if (loading) return <LoadingOverlay message="Gerando Auditoria" subtitle="Rastreando jornada completa do usuário..." />;

    const getKindLabel = (kind) => {
        switch (kind) {
            case 'BASIC': return 'Questionário Básico (BA)';
            case 'TIE_BREAKER': return 'Desempate (DE)';
            case 'SUBTYPE': return 'Análise de Instintos (ST)';
            default: return kind;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'DONE': return <span className="badge success">Concluído</span>;
            case 'TIE': return <span className="badge warning">Empate</span>;
            case 'INCONSISTENT': return <span className="badge danger">Inconsistente</span>;
            case 'IN_PROGRESS': return <span className="badge info">Em Progresso</span>;
            default: return <span className="badge">{status}</span>;
        }
    };

    return (
        <div className="audit-container fade-in">
            <div className="no-print audit-actions-top">
                <button className="secondary-btn" onClick={() => navigate('/admin/access')}>
                    <ChevronLeft size={18} />
                    <span>Voltar</span>
                </button>
                <button className="primary-btn" onClick={() => window.print()}>
                    <Printer size={18} />
                    <span>Imprimir Relatório</span>
                </button>
            </div>

            <div className="audit-document glass-panel">
                <header className="doc-header">
                    <div className="header-top">
                        <div className="doc-type">RELATÓRIO DE AUDITORIA DE JORNADA</div>
                        <div className="doc-id">ID: {userId.slice(0, 8)}</div>
                    </div>
                    <h1>{user?.name}</h1>
                    <div className="user-meta">
                        <span><strong>E-mail:</strong> {user?.email}</span>
                        <span><strong>Início da Jornada:</strong> {journey[0] ? new Date(journey[0].created_at).toLocaleString('pt-BR') : 'N/A'}</span>
                    </div>
                </header>

                <div className="journey-summary">
                    <h3>Resumo do Caminho</h3>
                    <div className="steps-flow">
                        {journey.map((att, idx) => (
                            <React.Fragment key={att.id}>
                                <div className="flow-node">
                                    <div className={`node-icon ${att.status}`}>
                                        {att.status === 'DONE' ? <CheckCircle2 size={16} /> : <History size={16} />}
                                    </div>
                                    <div className="node-info">
                                        <div className="node-kind">{getKindLabel(att.kind)}</div>
                                        <div className="node-status">{att.status}</div>
                                    </div>
                                </div>
                                {idx < journey.length - 1 && <ArrowRight size={16} className="flow-arrow" />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="attempts-detail">
                    {journey.map((att, idx) => (
                        <section key={att.id} className="attempt-section">
                            <div className="section-header">
                                <div className="step-number">ETAPA {idx + 1}</div>
                                <h2>{getKindLabel(att.kind)}</h2>
                                {getStatusBadge(att.status)}
                            </div>

                            <div className="attempt-meta">
                                <span>Iniciado em: {new Date(att.started_at).toLocaleString('pt-BR')}</span>
                                {att.finished_at && <span>Finalizado em: {new Date(att.finished_at).toLocaleString('pt-BR')}</span>}
                            </div>

                            <table className="answers-table">
                                <thead>
                                    <tr>
                                        <th width="40">#</th>
                                        <th>Pergunta</th>
                                        <th>Resposta Escolhida</th>
                                        <th width="100">Tipo/Cod</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {att.answers.map((ans, aIdx) => (
                                        <tr key={ans.id}>
                                            <td>{aIdx + 1}</td>
                                            <td className="q-text">{ans.questions?.text}</td>
                                            <td className="ans-text">{ans.options?.text}</td>
                                            <td className="code-cell">
                                                <span className="code-tag">{ans.options?.code}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {att.answers.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="empty-answers">Nenhuma resposta registrada para esta etapa.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {att.meta_json && att.meta_json.counts && (
                                <div className="outcome-snapshot">
                                    <h4>Resultado da Etapa:</h4>
                                    <div className="counts-row">
                                        {Object.entries(att.meta_json.counts).map(([type, count]) => (
                                            <div key={type} className={`count-item ${count > 0 ? 'highlight' : ''}`}>
                                                <span className="type-label">T{type}</span>
                                                <span className="type-value">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .audit-container {
                    padding: 2rem;
                    max-width: 1000px;
                    margin: 0 auto;
                }

                .audit-actions-top {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 2rem;
                }

                .audit-document {
                    background: white;
                    color: #1e293b;
                    padding: 4rem;
                    border-radius: 0; /* Standard for docs */
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                }

                .doc-header {
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 2rem;
                    margin-bottom: 3rem;
                }

                .header-top {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                    letter-spacing: 0.1em;
                    margin-bottom: 1rem;
                }

                .doc-header h1 {
                    font-size: 2.5rem;
                    color: #0f172a;
                    margin: 0 0 1rem 0;
                }

                .user-meta {
                    display: flex;
                    gap: 2rem;
                    font-size: 0.9rem;
                    color: #475569;
                }

                .journey-summary {
                    background: #f8fafc;
                    padding: 2rem;
                    border-radius: 1rem;
                    margin-bottom: 4rem;
                    border: 1px solid #e2e8f0;
                }

                .journey-summary h3 {
                    font-size: 1rem;
                    margin-bottom: 1.5rem;
                    color: #0f172a;
                }

                .steps-flow {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .flow-node {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: white;
                    padding: 0.75rem 1.25rem;
                    border-radius: 0.75rem;
                    border: 1px solid #e2e8f0;
                }

                .node-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .node-icon.DONE { background: #dcfce7; color: #16a34a; }
                .node-icon.TIE { background: #fef3c7; color: #d97706; }
                .node-icon.INCONSISTENT { background: #fee2e2; color: #dc2626; }
                .node-icon.IN_PROGRESS { background: #e0f2fe; color: #0284c7; }

                .node-kind { font-size: 0.75rem; font-weight: 700; color: #0f172a; }
                .node-status { font-size: 0.65rem; color: #64748b; text-transform: uppercase; }

                .attempt-section {
                    margin-bottom: 5rem;
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .step-number {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: white;
                    background: #0f172a;
                    padding: 4px 12px;
                    border-radius: 4px;
                }

                .section-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                    color: #0f172a;
                }

                .badge {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 20px;
                    text-transform: uppercase;
                }

                .badge.success { background: #dcfce7; color: #16a34a; }
                .badge.warning { background: #fef3c7; color: #d97706; }
                .badge.danger { background: #fee2e2; color: #dc2626; }
                .badge.info { background: #e0f2fe; color: #0284c7; }

                .attempt-meta {
                    font-size: 0.85rem;
                    color: #64748b;
                    display: flex;
                    gap: 2rem;
                    margin-bottom: 2rem;
                }

                .answers-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 2rem;
                }

                .answers-table th {
                    text-align: left;
                    font-size: 0.75rem;
                    color: #64748b;
                    text-transform: uppercase;
                    padding: 1rem;
                    border-bottom: 2px solid #f1f5f9;
                }

                .answers-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.9rem;
                    vertical-align: top;
                }

                .q-text { font-weight: 600; color: #1e293b; }
                .ans-text { color: #475569; }

                .code-tag {
                    font-family: monospace;
                    font-size: 0.7rem;
                    background: #f1f5f9;
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                .outcome-snapshot {
                    background: #f1f5f9;
                    padding: 1.5rem;
                    border-radius: 0.75rem;
                }

                .outcome-snapshot h4 {
                    font-size: 0.8rem;
                    margin-bottom: 1rem;
                    color: #475569;
                }

                .counts-row {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .count-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: white;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    min-width: 40px;
                    border: 1px solid #e2e8f0;
                }

                .count-item.highlight {
                    border-color: #8b5cf6;
                    background: #f5f3ff;
                }

                .count-item.highlight .type-label { color: #8b5cf6; }

                .count-item .type-label { font-size: 0.7rem; font-weight: 800; color: #94a3b8; }
                .count-item .type-value { font-size: 1rem; font-weight: 900; }

                @media print {
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    .audit-container { padding: 0; max-width: 100%; }
                    .audit-document { box-shadow: none; padding: 0; width: 100%; }
                    .glass-panel { border: none !important; backdrop-filter: none !important; }
                    .attempt-section { page-break-inside: avoid; }
                }
            `}} />
        </div>
    );
};

export default AuditReport;
