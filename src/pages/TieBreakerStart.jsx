import React, { useEffect, useState } from 'react';
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

            // Fetch the latest TIE result
            const { data: latestTie } = await supabase
                .from('attempts')
                .select('meta_json')
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
            setChecking(false);
        };

        checkTie();
    }, [navigate]);

    const handleStart = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();

        try {
            // 1. Fetch DE Question Set
            const { data: qSet } = await supabase
                .from('question_sets')
                .select('id')
                .eq('key', 'TIE_BREAKER')
                .single();

            // 2. Fetch all 5 DE questions
            const { data: questions } = await supabase
                .from('questions')
                .select('id')
                .eq('question_set_id', qSet.id);

            // 3. Create NEW attempt for TIE_BREAKER
            // We store the tied types in meta to guide the engine
            const { data: attempt, error } = await supabase
                .from('attempts')
                .insert({
                    user_id: user.id,
                    kind: 'TIE_BREAKER',
                    status: 'IN_PROGRESS',
                    meta_json: {
                        tied_types: tiedTypes,
                        question_order: questions.map(q => q.id).sort(() => Math.random() - 0.5),
                        phrase_seeds: questions.map(() => Math.random() > 0.5 ? 1 : 0) // Select 01 or 02 suffix randomly para todas as questões (agora 7)
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
            <div className="start-card glass-panel">
                <div className="icon-badge">
                    <GitMerge size={32} />
                </div>
                <h1>{settings.tiebreaker_intro_title}</h1>
                <p>Identificamos um equilíbrio entre os tipos <strong>{tiedTypes.map(t => `T${t}`).join(', ')}</strong>.</p>

                <div className="info-box">
                    <Info size={20} />
                    <div>
                        <p>{settings.tiebreaker_intro_text}</p>
                        <ul className="rules-summary">
                            <li>{settings.tiebreaker_intro_item1}</li>
                            <li>{settings.tiebreaker_intro_item2}</li>
                            <li>{settings.tiebreaker_intro_item3}</li>
                        </ul>
                    </div>
                </div>

                <div className="action-area">
                    <button
                        className="primary-btn pulse"
                        onClick={handleStart}
                        disabled={loading}
                        style={{ width: '100%', padding: '1.25rem' }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={24} />
                                <span>Preparando Desempate...</span>
                            </>
                        ) : (
                            <>
                                <Play size={24} />
                                <span>{settings.tiebreaker_intro_btn}</span>
                                <ChevronRight size={20} />
                            </>
                        )}
                    </button>
                </div>
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
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2rem;
                    border: 1px solid rgba(139, 92, 246, 0.2);
                }
                .icon-badge {
                    width: 80px;
                    height: 80px;
                    background: var(--bg-secondary);
                    color: var(--accent-primary);
                    border-radius: 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 0.5rem;
                    border: 1px solid var(--glass-border);
                }
                .start-card h1 {
                    font-size: 2.25rem;
                    color: var(--text-primary);
                    margin: 0;
                }
                .info-box {
                    background: var(--bg-secondary);
                    border: 1px solid var(--glass-border);
                    padding: 2rem;
                    border-radius: 1.25rem;
                    display: flex;
                    gap: 1.5rem;
                    text-align: left;
                    font-size: 1rem;
                    line-height: 1.6;
                    color: var(--text-secondary);
                }
                .rules-summary {
                    margin-top: 1rem;
                    padding-left: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .action-area {
                    margin-top: 1.5rem;
                    width: 100%;
                }
            `}} />
        </div>
    );
};

export default TieBreakerStart;
