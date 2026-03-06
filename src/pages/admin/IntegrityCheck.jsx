import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2, RefreshCw, Layers } from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const IntegrityCheck = () => {
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, valid: 0, invalid: 0 });

    const runCheck = async () => {
        setLoading(true);

        // Fetch everything to analyze
        const { data: sets } = await supabase.from('question_sets').select('*');
        const { data: questions } = await supabase.from('questions').select('*, options(*)');

        const newIssues = [];
        let validCount = 0;

        questions.forEach((q) => {
            const setName = sets.find(s => s.id === q.question_set_id)?.key || 'DESCONHECIDO';
            const qIssues = [];

            // RULES BY SET
            if (setName === 'BASIC') {
                if (q.options.length !== 9) {
                    qIssues.push(`[BASIC] Possui ${q.options.length} opções (deveria ter 9)`);
                }
                const types = q.options.map(o => o.score_type);
                const uniqueTypes = new Set(types);
                for (let i = 1; i <= 9; i++) {
                    if (!uniqueTypes.has(i)) qIssues.push(`[BASIC] Tipo faltante: ${i}`);
                }
                if (uniqueTypes.size !== types.length) qIssues.push('[BASIC] Tipos repetidos detectados');
            }
            else if (setName === 'TIE_BREAKER') {
                if (q.options.length !== 18) {
                    qIssues.push(`[DESEMPATE] Possui ${q.options.length} opções (deveria ter 18)`);
                }
                const checkSuffix = (suffix) => {
                    const filtered = q.options.filter(o => o.code?.endsWith(suffix));
                    if (filtered.length !== 9) qIssues.push(`[DESEMPATE] Variante ${suffix} possui ${filtered.length} opções (deveria ter 9)`);
                    const types = new Set(filtered.map(o => o.score_type));
                    if (types.size !== 9 && filtered.length === 9) qIssues.push(`[DESEMPATE] Variante ${suffix} não cobre os 9 tipos`);
                }
                checkSuffix('01');
                checkSuffix('02');
            }
            else if (setName.startsWith('SUBTYPE_')) {
                if (q.options.length !== 6) {
                    qIssues.push(`[SUBTIPO] Possui ${q.options.length} opções (deveria ter 6)`);
                }
                const checkSuffix = (suffix) => {
                    const filtered = q.options.filter(o => o.code?.endsWith(suffix));
                    if (filtered.length !== 3) qIssues.push(`[SUBTIPO] Variante ${suffix} possui ${filtered.length} opções (deveria ter 3)`);
                    const types = new Set(filtered.map(o => o.score_type));
                    if (types.size !== 3 && filtered.length === 3) qIssues.push(`[SUBTIPO] Variante ${suffix} não cobre os 3 instintos (A,S,R)`);
                }
                checkSuffix('01');
                checkSuffix('02');
            }

            if (qIssues.length > 0) {
                newIssues.push({
                    id: q.id,
                    set: setName,
                    text: q.text,
                    reasons: qIssues
                });
            } else {
                validCount++;
            }
        });

        setIssues(newIssues);
        setStats({
            total: questions.length,
            valid: validCount,
            invalid: newIssues.length
        });
        setLoading(false);
    };

    useEffect(() => {
        runCheck();
    }, []);

    if (loading) return <LoadingOverlay message="Analisando Integridade" subtitle="Verificando regras de todos os estágios..." />;

    // Group issues by Set for better visualization
    const groupedIssues = issues.reduce((acc, current) => {
        if (!acc[current.set]) acc[current.set] = [];
        acc[current.set].push(current);
        return acc;
    }, {});

    return (
        <div className="admin-page fade-in">
            <div className="admin-header">
                <div className="title-row">
                    <ShieldCheck className="accent-text" size={32} />
                    <div>
                        <h1>Validador de Integridade (MULTISTAGE)</h1>
                        <p>Verificando consistência de Basic, Desempate e Subtipos.</p>
                    </div>
                </div>
                <button className="secondary-btn" onClick={runCheck}>
                    <RefreshCw size={18} />
                    <span>Recalcular</span>
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card glass-panel">
                    <span className="stat-label">Total de Perguntas</span>
                    <span className="stat-value">{stats.total}</span>
                </div>
                <div className="stat-card glass-panel valid">
                    <span className="stat-label">Válidas</span>
                    <span className="stat-value">{stats.valid}</span>
                </div>
                <div className="stat-card glass-panel invalid">
                    <span className="stat-label">Com Erros</span>
                    <span className="stat-value">{stats.invalid}</span>
                </div>
            </div>

            <div className="integrity-results">
                {issues.length === 0 ? (
                    <div className="success-banner glass-panel">
                        <CheckCircle2 size={48} />
                        <div>
                            <h3>Tudo em perfeita ordem!</h3>
                            <p>Todos os estágios (Básico, DE, Subtipos) estão com os dados íntegros conforme o algoritmo.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grouped-issues">
                        {Object.keys(groupedIssues).map(setName => (
                            <div key={setName} className="set-section">
                                <div className="set-header">
                                    <Layers size={18} />
                                    <span>Set: {setName}</span>
                                    <span className="error-count">{groupedIssues[setName].length} erros</span>
                                </div>

                                <div className="issues-list">
                                    {groupedIssues[setName].map(issue => (
                                        <div key={issue.id} className="issue-item glass-panel">
                                            <div className="issue-header">
                                                <AlertCircle size={16} className="danger-text" />
                                                <span className="q-id">Question ID: {issue.id.slice(0, 8)}...</span>
                                            </div>
                                            <p className="q-preview">{issue.text}</p>
                                            <ul className="reasons-list">
                                                {issue.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .title-row { display: flex; align-items: center; gap: 1rem; }
        .title-row h1 { margin-bottom: 0px; }
        .title-row p { font-size: 0.875rem; color: var(--text-tertiary); }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }

        .stat-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .stat-label { font-size: 0.875rem; color: var(--text-tertiary); font-weight: 600; }
        .stat-value { font-size: 2rem; font-weight: 800; }

        .stat-card.valid { border-left: 4px solid var(--accent-secondary); }
        .stat-card.invalid { border-left: 4px solid var(--accent-danger); }

        .set-section {
            margin-bottom: 3rem;
        }

        .set-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1.5rem;
            padding: 0.75rem 1.5rem;
            background: var(--bg-secondary);
            border-radius: 0.5rem;
            border: 1px solid var(--glass-border);
            font-weight: 700;
            color: var(--accent-primary);
        }

        .error-count {
            margin-left: auto;
            background: rgba(239, 68, 68, 0.1);
            color: var(--accent-danger);
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
        }

        .success-banner {
          display: flex;
          align-items: center;
          gap: 2rem;
          padding: 3rem;
          background: rgba(16, 185, 129, 0.05);
          color: var(--accent-secondary);
        }

        .issues-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1rem;
        }

        .issue-item {
          padding: 1.25rem;
          background: var(--glass-panel-bg);
          border-left: 4px solid var(--accent-danger);
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .issue-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .q-id { font-size: 0.7rem; font-family: monospace; color: var(--text-tertiary); }

        .q-preview {
          font-size: 0.9rem;
          color: var(--text-primary);
          margin-bottom: 1.25rem;
          font-weight: 500;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .reasons-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: auto;
        }

        .reasons-list li {
          font-size: 0.8rem;
          color: var(--text-secondary);
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .reasons-list li::before {
          content: '•';
          color: var(--accent-danger);
          font-weight: bold;
        }
      `}} />
        </div>
    );
};

export default IntegrityCheck;
