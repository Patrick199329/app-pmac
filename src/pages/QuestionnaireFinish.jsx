import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import confetti from 'canvas-confetti';

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
                // Rule 5: Ties
                else if (
                    (first.count === second.count && first.count >= 3) || // a, b: Multiple types share max (>=3)
                    (first.count === 4 && second.count === 3) ||       // c: 4 vs 3
                    (first.count === 3 && second.count === 2)          // d: 3 vs 2
                ) {
                    finalStatus = 'TIE';
                    // Determine winners for the tie-breaker
                    const maxVal = first.count;
                    winners = sortedCounts
                        .filter(item => item.count === maxVal || (maxVal === 4 && item.count === 3) || (maxVal === 3 && item.count === 2))
                        .map(item => item.type);
                }
                // Rule 6: Inconsistency (Any other case)
                else {
                    finalStatus = 'INCONSISTENT';
                    winners = [];
                }

                // 4. Final Processing
                if (finalStatus === 'DONE') {
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#8b5cf6', '#10b981', '#ffffff']
                    });
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

                const { error: resultError } = await supabase
                    .from('results')
                    .upsert({
                        user_id: user.id,
                        attempt_id: attemptId,
                        type_result: typeResult,
                        status_copy: finalStatus
                    }, { onConflict: 'attempt_id' });

                if (resultError) throw resultError;

                setStatus('success');
                setTimeout(() => {
                    if (finalStatus === 'DONE' && typeResult) {
                        navigate(`/st/start?type=${typeResult}`);
                    } else {
                        navigate(`/result/${attemptId}`);
                    }
                }, 2000);

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
                    <>
                        <CheckCircle className="success-text" size={64} />
                        <h2>Análise Concluída!</h2>
                        <p>Redirecionando para o seu resultado em instantes.</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <AlertCircle className="danger-text" size={64} />
                        <h2>Ops! Algo deu errado.</h2>
                        <p>Não conseguimos processar seu resultado. Por favor, tente novamente ou contate o suporte.</p>
                        <button className="primary-btn" onClick={() => navigate('/access')}>Voltar ao início</button>
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

export default QuestionnaireFinish;
