import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, getUserActivePlan } from '../services/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import confetti from 'canvas-confetti';

const TieBreakerFinish = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const attemptId = searchParams.get('attemptId');
    const [resultData, setResultData] = useState(null);
    const [status, setStatus] = useState('calculating'); // calculating, success, error

    useEffect(() => {
        const calculateResult = async () => {
            if (!attemptId) {
                navigate('/access');
                return;
            }

            try {
                // ... (rest of the fetching and calculation logic remains the same until effects)
                // [Omit the unchanged lines for brevity in instruction, but I will provide the full block below]
                
                // 1. Fetch DE answers with their scores
                const { data: answers, error: answersError } = await supabase
                    .from('answers')
                    .select(`
                        option_id,
                        options (score_type)
                    `)
                    .eq('attempt_id', attemptId);

                if (answersError || !answers) throw answersError;

                const counts = {};
                answers.forEach(ans => {
                    const type = ans.options?.score_type;
                    if (type) counts[type] = (counts[type] || 0) + 1;
                });

                const sortedCounts = Object.entries(counts)
                    .map(([type, count]) => ({ type: parseInt(type), count }))
                    .sort((a, b) => b.count - a.count);

                const first = sortedCounts[0];
                const second = sortedCounts[1];

                let finalStatus = 'TIE';
                let typeResult = null;
                let winners = [];

                // Standard victory condition: strictly superior
                if (first && (!second || first.count > second.count)) {
                    finalStatus = 'DONE';
                    typeResult = first.type;
                    winners = [first.type];
                } else {
                    // NEW RULE: Exclusion of types with < 2 votes for the next round
                    // This rule applies when there is a tie for first place
                    const aboveThreshold = sortedCounts.filter(item => item.count >= 2);
                    
                    if (aboveThreshold.length === 1) {
                        // If only one type has >= 2 votes, they win by exclusion
                        finalStatus = 'DONE';
                        typeResult = aboveThreshold[0].type;
                        winners = [aboveThreshold[0].type];
                    } else if (aboveThreshold.length > 1) {
                        // Multiple types still in competition
                        finalStatus = 'TIE';
                        winners = aboveThreshold.map(item => item.type);
                    } else {
                        // Fallback: If no one has >= 2 votes (extreme fragmentation), 
                        // keep all types that have at least 1 vote to avoid stopping the flow
                        finalStatus = 'TIE';
                        winners = sortedCounts.filter(item => item.count > 0).map(item => item.type);
                    }
                }

                setResultData({ finalStatus, typeResult });

                // 4. Effects: Only confetti if someone WON
                if (finalStatus === 'DONE') {
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#8b5cf6', '#10b981', '#ffffff']
                    });
                }

                // 5. Update DB
                const { data: { user } } = await supabase.auth.getUser();

                await supabase.from('attempts').update({
                    status: finalStatus,
                    finished_at: new Date().toISOString(),
                    meta_json: { counts, winners, processed_at: new Date().toISOString(), distribution: sortedCounts }
                }).eq('id', attemptId);

                // 5a. Fetch active plan for redirection logic
                const userPlan = await getUserActivePlan(user.id);

                await supabase.from('results').upsert({
                    user_id: user.id,
                    attempt_id: attemptId,
                    type_result: typeResult,
                    status_copy: finalStatus
                }, { onConflict: 'attempt_id' });

                setStatus('success');
                setTimeout(() => {
                    if (finalStatus === 'DONE' && typeResult) {
                        if (userPlan === 'OURO') {
                            navigate(`/st/start?type=${typeResult}`);
                        } else {
                            navigate(`/result/${attemptId}`);
                        }
                    } else {
                        navigate(`/result/${attemptId}`);
                    }
                }, finalStatus === 'DONE' ? 2000 : 3500); // More time if it's a tie to read the message

            } catch (err) {
                console.error(err);
                setStatus('error');
            }
        };

        calculateResult();
    }, [attemptId, navigate]);

    if (status === 'calculating') {
        return <LoadingOverlay message="Finalizando desempate" subtitle="Analisando suas escolhas estratégicas..." />;
    }

    return (
        <div className="finish-container fade-in">
            <div className="finish-card glass-panel">
                {status === 'success' && (
                    <div className="finish-content animate-success">
                        {resultData?.finalStatus === 'DONE' ? (
                            <>
                                <CheckCircle className="success-icon" size={80} />
                                <h2>Desempate Concluído!</h2>
                                <p>Perfil identificado com sucesso.</p>
                                <div className="redirect-status">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Redirecionando para o resultado...</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="warning-icon" size={80} />
                                <h2>Empate Persistente</h2>
                                <p>Sua distribuição ainda está equilibrada.</p>
                                <p className="subtitle">Voltando ao resumo para nova rodada...</p>
                                <div className="redirect-status">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Redirecionando...</span>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {status === 'error' && (
                    <div className="finish-content animate-error">
                        <AlertCircle className="danger-icon" size={80} />
                        <h2>Erro no processamento.</h2>
                        <p>Não foi possível concluir esta etapa.</p>
                        <button className="primary-btn" onClick={() => navigate('/access')}>Sair</button>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .finish-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: calc(100vh - 100px);
                    padding: 2rem;
                    background: var(--bg-primary);
                }

                .finish-card {
                    max-width: 500px;
                    width: 100%;
                    padding: 4rem 3rem;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    border-radius: 2rem;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.15);
                }

                .finish-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.5rem;
                }

                .success-icon { color: var(--accent-secondary); filter: drop-shadow(0 0 15px rgba(16, 185, 129, 0.3)); }
                .warning-icon { color: var(--accent-warning); }
                .danger-icon { color: var(--accent-danger); }

                .finish-card h2 {
                    font-size: 2rem;
                    color: var(--text-primary);
                    margin: 0;
                }

                .finish-card p {
                    font-size: 1.1rem;
                    color: var(--text-secondary);
                    margin: 0;
                }

                .subtitle {
                    font-size: 0.95rem !important;
                    opacity: 0.8;
                }

                .redirect-status {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-top: 1rem;
                    padding: 0.75rem 1.5rem;
                    background: rgba(139, 92, 246, 0.05);
                    border-radius: 3rem;
                    color: var(--accent-primary);
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .animate-success { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
};

export default TieBreakerFinish;
