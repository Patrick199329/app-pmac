import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, getUserActivePlan } from '../services/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

const QuestionnaireFinish = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const attemptId = searchParams.get('attemptId');
    const [status, setStatus] = useState('calculating'); // calculating, success, error

    useEffect(() => {
        const calculateResult = async () => {
            if (!attemptId) {
                navigate('/access');
                return;
            }

            try {
                // 1. Fetch all answers for this attempt with their option codes
                const { data: answers, error: answersError } = await supabase
                    .from('answers')
                    .select(`
                        option_id,
                        options (code, score_type)
                    `)
                    .eq('attempt_id', attemptId);

                if (answersError || !answers) {
                    throw answersError || new Error("Answers not found");
                }

                // 2. Count types (using codes for reliability)
                const counts = {};
                for (let i = 1; i <= 9; i++) counts[i] = 0;

                answers.forEach(ans => {
                    const code = ans.options?.code;
                    if (code && code.startsWith('T')) {
                        const type = parseInt(code.substring(1, 2));
                        if (!isNaN(type)) {
                            counts[type]++;
                        }
                    }
                });

                // 3. Algorithm based on PMAC Rules 4, 5 and 6
                // Sort counts to analyze distribution
                const sortedCounts = Object.entries(counts)
                    .map(([type, count]) => ({ type: parseInt(type), count }))
                    .sort((a, b) => b.count - a.count);

                const first = sortedCounts[0];
                const second = sortedCounts[1];
                const third = sortedCounts[2];

                let finalStatus = 'INCONSISTENT'; // Default
                let typeResult = null;
                let winners = [];

                // Rule 4a: Count >= 5 of a single type (no tie for first)
                if (first.count >= 5 && first.count > second.count) {
                    finalStatus = 'DONE';
                    typeResult = first.type;
                    winners = [first.type];
                }
                // Rule 4b: Count == 4, no one else has 3 or 4
                else if (first.count === 4 && second.count < 3) {
                    finalStatus = 'DONE';
                    typeResult = first.type;
                    winners = [first.type];
                }
                // Rule 5: Ties (Regra 5a revisada - Agora inclusiva para qualquer empate)
                else if (sortedCounts.filter(item => item.count > 0).length > 1) {
                    finalStatus = 'TIE';
                    // Todos os tipos que obtiveram pelo menos 1 resposta estão empatados
                    winners = sortedCounts
                        .filter(item => item.count > 0)
                        .map(item => item.type);
                }
                // Rule 6: Inconsistency (Apenas se não houver NENHUMA resposta válida)
                else {
                    finalStatus = 'INCONSISTENT';
                    winners = [];
                }


                // 5. Update Attempt and Results
                const { data: { user } } = await supabase.auth.getUser();

                const { error: attemptUpdateError } = await supabase
                    .from('attempts')
                    .update({
                        status: finalStatus,
                        finished_at: new Date().toISOString(),
                        meta_json: {
                            counts,
                            winners,
                            processed_at: new Date().toISOString(),
                            distribution: sortedCounts
                        }
                    })
                    .eq('id', attemptId);

                if (attemptUpdateError) throw attemptUpdateError;

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
                        // Se o plano for Ouro, segue para subtipo. Se for Básico, vai para o resultado.
                        if (userPlan === 'OURO') {
                            navigate(`/st/start?type=${typeResult}`);
                        } else {
                            navigate(`/result/${attemptId}`);
                        }
                    } else {
                        navigate(`/result/${attemptId}`);
                    }
                }, 100);

            } catch (err) {
                console.error("Evaluation error:", err);
                setStatus('error');
            }
        };

        calculateResult();
    }, [attemptId, navigate]);

    if (status === 'calculating') {
        return <LoadingOverlay message="Analisando seu perfil" subtitle="Processando suas respostas para identificar seu tipo PMAC..." />;
    }

    return (
        <div className="finish-container fade-in">
            <div className="finish-card glass-panel">
                {status === 'success' && (
                    <div className="finish-content">
                        {/* UI oculta para fluxo direto */}
                    </div>
                )}

                {status === 'error' && (
                    <div className="finish-content animate-error">
                        <AlertCircle className="danger-icon" size={80} />
                        <h2>Ops! Algo deu errado.</h2>
                        <p>Não conseguimos processar seu resultado neste momento.</p>
                        <button className="primary-btn" onClick={() => navigate('/access')}>Tentar Novamente</button>
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
                .danger-icon { color: var(--accent-danger); }
                .accent-text { color: var(--accent-primary); }

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

export default QuestionnaireFinish;
