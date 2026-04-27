import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Play, Loader2, GitMerge, Info, ChevronRight } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAppSettings } from '../context/AppSettingsContext';

const TieBreakerStart = () => {
    const { settings } = useAppSettings();
    const [loading, setLoading] = useState(false);
    const [tiedTypes, setTiedTypes] = useState([]);
    const [checking, setChecking] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkTie = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }

            // Fetch the latest TIE result (could be from BASIC or a previous TIE_BREAKER)
            const { data: latestTie } = await supabase
                .from('attempts')
                .select('kind, meta_json')
                .eq('user_id', user.id)
                .eq('status', 'TIE')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!latestTie || !latestTie.meta_json?.winners) {
                navigate('/access');
                return;
            }

            setTiedTypes(latestTie.meta_json.winners);
            setPreviousAttempt(latestTie);
            setChecking(false);
        };

        checkTie();
    }, [navigate]);

    // Auto-start for direct flow
    const hasStarted = useRef(false);
    useEffect(() => {
        if (!checking && tiedTypes.length > 0 && !loading && !hasStarted.current) {
            hasStarted.current = true;
            handleStart();
        }
    }, [checking, tiedTypes, loading]);

    const [previousAttempt, setPreviousAttempt] = useState(null);

    const handleStart = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();

        try {
            // 1. Determine Iteration and Question Limit
            const prevIteration = previousAttempt?.kind === 'TIE_BREAKER' 
                ? (previousAttempt.meta_json?.iteration || 1) 
                : 0;
            const currentIteration = prevIteration + 1;
            const maxQuestions = tiedTypes.length === 2 ? 5 : 7;

            // 2. Fetch Question IDs
            let questions;
            
            if (currentIteration >= 3) {
                // Rule: 3rd iteration onwards uses BASIC set questions flagged for it
                const { data: qSetBasic } = await supabase
                    .from('question_sets')
                    .select('id')
                    .eq('key', 'BASIC')
                    .single();

                const { data: qBasic } = await supabase
                    .from('questions')
                    .select('id, order_index')
                    .eq('question_set_id', qSetBasic.id)
                    .eq('use_in_3rd_round_tiebreaker', true)
                    .limit(maxQuestions);
                
                questions = qBasic;
            } else {
                // Iterations 1 & 2 use TIE_BREAKER set
                const { data: qSetDE } = await supabase
                    .from('question_sets')
                    .select('id')
                    .eq('key', 'TIE_BREAKER')
                    .single();

                const { data: qDE } = await supabase
                    .from('questions')
                    .select('id, order_index')
                    .eq('question_set_id', qSetDE.id)
                    .order('order_index', { ascending: true })
                    .limit(maxQuestions);
                
                questions = qDE;
            }

            if (!questions || questions.length === 0) {
                throw new Error("Não foi possível carregar as questões de desempate.");
            }

            // 3. Define Phrase Seeds (Variants)
            // Iteration 1: All '0' (Suffix 01)
            // Iteration 2: All '1' (Suffix 02)
            // Iteration 3+: Suffix 01 (Seed 0) for BASIC consistency
            let phraseSeeds;
            if (currentIteration === 1) {
                phraseSeeds = questions.map(() => 0);
            } else if (currentIteration === 2) {
                phraseSeeds = questions.map(() => 1);
            } else {
                phraseSeeds = questions.map(() => 0); 
            }

            // 5. Create NEW attempt for TIE_BREAKER
            const { data: attempt, error } = await supabase
                .from('attempts')
                .insert({
                    user_id: user.id,
                    kind: 'TIE_BREAKER',
                    status: 'IN_PROGRESS',
                    meta_json: {
                        tied_types: tiedTypes,
                        iteration: currentIteration,
                        question_order: questions.map(q => q.id).sort(() => Math.random() - 0.5),
                        phrase_seeds: phraseSeeds
                    }
                })
                .select()
                .single();

            if (error) throw error;

            navigate(`/de/q/0?attemptId=${attempt.id}`);
        } catch (err) {
            console.error(err);
            alert('Erro ao iniciar desempate. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return <LoadingOverlay message="Analisando Resultados" subtitle="Verificando empate e preparando ambiente..." />;
    }

    return (
        <div className="start-container fade-in">
            <div className="start-card glass-panel" style={{ opacity: 0 }}>
                {/* UI oculta para fluxo direto - Auto-start ativo */}
                <Loader2 className="animate-spin" size={32} />
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .start-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: calc(100vh - 160px);
                    padding: 2rem;
                }
                .start-card {
                    max-width: 640px;
                    width: 100%;
                    padding: 4rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 2rem;
                }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}} />
        </div>
    );
};

export default TieBreakerStart;
