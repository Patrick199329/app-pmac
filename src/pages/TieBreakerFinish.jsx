import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import confetti from 'canvas-confetti';

const TieBreakerFinish = () => {
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
                // 1. Fetch DE answers with their scores
                const { data: answers, error: answersError } = await supabase
                    .from('answers')
                    .select(`
                        option_id,
                        options (score_type)
                    `)
                    .eq('attempt_id', attemptId);

                if (answersError || !answers) throw answersError;

                // 2. Count scores
                const counts = {};
                answers.forEach(ans => {
                    const type = ans.options?.score_type;
                    if (type) {
                        counts[type] = (counts[type] || 0) + 1;
                    }
                });

                // 3. Process Winner (must have more than others)
                const sortedCounts = Object.entries(counts)
                    .map(([type, count]) => ({ type: parseInt(type), count }))
                    .sort((a, b) => b.count - a.count);

                const first = sortedCounts[0];
                const second = sortedCounts[1];

                let finalStatus = 'TIE';
                let typeResult = null;
                let winners = [];

                if (first && (!second || first.count > second.count)) {
                    finalStatus = 'DONE';
                    typeResult = first.type;
                    winners = [first.type];
                } else {
                    // It's still a tie between whoever has the max count
                    finalStatus = 'TIE';
                    const maxCount = first.count;
                    winners = sortedCounts
                        .filter(item => item.count === maxCount)
                        .map(item => item.type);
                }

                // 4. Effects
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

                const { error: attError } = await supabase
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

                if (attError) throw attError;

                const { error: resError } = await supabase
                    .from('results')
                    .upsert({
                        user_id: user.id,
                        attempt_id: attemptId,
                        type_result: typeResult,
                        status_copy: finalStatus
                    }, { onConflict: 'attempt_id' });

                if (resError) throw resError;

                setStatus('success');
                setTimeout(() => {
                    if (finalStatus === 'DONE' && typeResult) {
                        navigate(`/st/start?type=${typeResult}`);
                    } else {
                        navigate(`/result/${attemptId}`);
                    }
                }, 2000);

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
                    <>
                        <CheckCircle className="success-text" size={64} />
                        <h2>Desempate Concluído!</h2>
                        <p>Redirecionando para o resultado final em instantes.</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <AlertCircle className="danger-text" size={64} />
                        <h2>Erro no processamento.</h2>
                        <p>Contate o suporte técnico.</p>
                        <button className="primary-btn" onClick={() => navigate('/access')}>Voltar</button>
                    </>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .finish-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: calc(100vh - 200px);
                }
                .finish-card {
                    max-width: 500px;
                    width: 100%;
                    padding: 4rem;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.5rem;
                }
                .success-text { color: var(--accent-secondary); }
                .danger-text { color: var(--accent-danger); }
            `}} />
        </div>
    );
};

export default TieBreakerFinish;
