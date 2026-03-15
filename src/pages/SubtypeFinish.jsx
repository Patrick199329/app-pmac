import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

const SubtypeFinish = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const attemptId = searchParams.get('attemptId');
    const [status, setStatus] = useState('calculating'); // calculating, success, tie, error

    useEffect(() => {
        const calculateResult = async () => {
            if (!attemptId) {
                navigate('/access');
                return;
            }

            try {
                // 1. Fetch answers with scores
                const { data: answers } = await supabase
                    .from('answers')
                    .select(`options (score_type, code)`)
                    .eq('attempt_id', attemptId);

                // 2. Count A (1), S (2), R (3)
                const counts = { 1: 0, 2: 0, 3: 0 };
                answers.forEach(ans => {
                    const type = ans.options?.score_type;
                    if (type) counts[type]++;
                });

                const sorted = Object.entries(counts)
                    .map(([type, count]) => ({ type: parseInt(type), count }))
                    .sort((a, b) => b.count - a.count);

                const first = sorted[0];
                const second = sorted[1];

                const { data: attempt } = await supabase
                    .from('attempts')
                    .select('meta_json')
                    .eq('id', attemptId)
                    .single();

                if (first.count > second.count) {
                    // WE HAVE A WINNER
                    const map = { 1: 'A', 2: 'S', 3: 'R' };
                    const winningInstinct = map[first.type];
                    const archetypeCode = `ST${attempt.meta_json.base_type}${winningInstinct}`;

                    // Fetch final title
                    const { data: archetype } = await supabase
                        .from('archetypes')
                        .select('title')
                        .eq('code', archetypeCode)
                        .single();

                    await supabase
                        .from('attempts')
                        .update({
                            status: 'DONE',
                            finished_at: new Date().toISOString(),
                            meta_json: {
                                ...attempt.meta_json,
                                winner: archetypeCode,
                                archetype_title: archetype?.title,
                                counts // Store counts for the result chart!
                            }
                        })
                        .eq('id', attemptId);

                    await supabase
                        .from('results')
                        .upsert({
                            user_id: (await supabase.auth.getUser()).data.user.id,
                            attempt_id: attemptId,
                            type_result: attempt.meta_json.base_type,
                            status_copy: 'DONE',
                            // We might want to add archetype information to results table later
                        }, { onConflict: 'attempt_id' });

                    setStatus('success');
                    setTimeout(() => navigate(`/result/${attemptId}`), 100);
                } else {
                    // TIE (Regra 5) - Auto retry for direct flow
                    handleRetry();
                }
            } catch (err) {
                console.error(err);
                setStatus('error');
            }
        };

        calculateResult();
    }, [attemptId, navigate]);

    const handleRetry = async () => {
        setStatus('calculating');
        const { data: attempt } = await supabase
            .from('attempts')
            .select('*')
            .eq('id', attemptId)
            .single();

        // Create a new iteration (2ª Rodada com Variante 02 fixa)
        const { data: nextAttempt } = await supabase
            .from('attempts')
            .insert({
                user_id: attempt.user_id,
                kind: 'SUBTYPE',
                status: 'IN_PROGRESS',
                meta_json: {
                    ...attempt.meta_json,
                    variant: '02', // Sempre Variante 02 no empate do subtipo
                    iteration: (attempt.meta_json.iteration || 1) + 1,
                    question_order: attempt.meta_json.question_order.sort(() => Math.random() - 0.5)
                }
            })
            .select()
            .single();

        navigate(`/st/q/0?attemptId=${nextAttempt.id}`);
    };

    if (status === 'calculating') {
        return (
            <LoadingOverlay
                message="Analisando Instintos"
                subtitle="Processando suas respostas para definir seu subtipo..."
            />
        );
    }

    return (
        <div className="finish-container fade-in">
            <div className="finish-card glass-panel">
                {status === 'success' && (
                    <div className="finish-content">
                        {/* UI oculta para fluxo direto */}
                    </div>
                )}

                {status === 'tie' && (
                    <div className="finish-content">
                        {/* Auto-redirecionando para 2ª rodada */}
                    </div>
                )}

                {status === 'error' && (
                    <div className="finish-content animate-error">
                        <AlertCircle className="danger-icon" size={80} />
                        <h2>Erro no processamento.</h2>
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

                .pulse { animation: pulse-ring 2s infinite; }
                @keyframes pulse-ring {
                    0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(139, 92, 246, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
                }
            `}} />
        </div>
    );
};

export default SubtypeFinish;
