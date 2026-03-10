import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import confetti from 'canvas-confetti';

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

                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                    setStatus('success');
                    setTimeout(() => navigate(`/result/${attemptId}`), 2500);
                } else {
                    // TIE (Regra 5)
                    if (attempt.meta_json.variant === '01') {
                        setStatus('tie');
                    } else {
                        // Tie even on second variant? Rule says "repeated again"
                        // We will allow one more retry or same variant if 02 already used
                        setStatus('tie');
                    }
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
                    <>
                        <CheckCircle className="success-text" size={64} />
                        <h2>Perfil Completo Definido!</h2>
                        <p>Preparando seu relatório personalizado...</p>
                    </>
                )}

                {status === 'tie' && (
                    <>
                        <RefreshCw className="accent-text" size={64} />
                        <h2>Empate de Instintos</h2>
                        <p>Houve um equilíbrio em suas respostas. Vamos realizar uma segunda rodada com frases alternativas para maior precisão.</p>
                        <button className="primary-btn" onClick={handleRetry}>Iniciar 2ª Rodada</button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <AlertCircle className="danger-text" size={64} />
                        <h2>Erro no processamento.</h2>
                        <button className="primary-btn" onClick={() => navigate('/access')}>Sair</button>
                    </>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .finish-container { display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 200px); }
                .finish-card { max-width: 500px; width: 100%; padding: 4rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
                .success-text { color: var(--accent-secondary); }
            `}} />
        </div>
    );
};

export default SubtypeFinish;
