import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Loader2, Target, Info } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAppSettings } from '../context/AppSettingsContext';

const SubtypeStart = () => {
    const { settings } = useAppSettings();
    const [searchParams] = useSearchParams();
    const type = searchParams.get('type');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!type || isNaN(type)) {
            navigate('/access');
            return;
        }
        setChecking(false);
    }, [type, navigate]);

    const handleStart = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        try {
            // 1. Fetch Subtype Question Set for this specific type
            const setKey = `SUBTYPE_T${type}`;
            const { data: qSet } = await supabase
                .from('question_sets')
                .select('id')
                .eq('key', setKey)
                .single();

            // 2. Fetch all questions for this set
            const { data: questions } = await supabase
                .from('questions')
                .select('id')
                .eq('question_set_id', qSet.id);

            // 3. Create NEW attempt for SUBTYPE
            // We use variant '01' by default
            const { data: attempt, error } = await supabase
                .from('attempts')
                .insert({
                    user_id: user.id,
                    kind: 'SUBTYPE',
                    status: 'IN_PROGRESS',
                    meta_json: {
                        base_type: parseInt(type),
                        question_order: questions.map(q => q.id).sort(() => Math.random() - 0.5),
                        variant: '01',
                        iteration: 1
                    }
                })
                .select()
                .single();

            if (error) throw error;

            navigate(`/st/q/0?attemptId=${attempt.id}`);
        } catch (err) {
            console.error(err);
            alert('Erro ao iniciar análise de subtipo. Verifique se as questões estão cadastradas.');
        } finally {
            setLoading(false);
        }
    };

    if (checking) return <LoadingOverlay message="Analisando Perfil" subtitle="Preparando análise de instintos..." />;

    return (
        <div className="start-container fade-in">
            <div className="start-card glass-panel">
                <div className="icon-badge">
                    <Target size={32} />
                </div>
                <h1>{settings.subtype_intro_title}</h1>
                <p>Parabéns! Identificamos que seu perfil base é o <strong>Tipo {type}</strong>.</p>

                <div className="info-box">
                    <Info size={20} />
                    <div>
                        <p>{settings.subtype_intro_text}</p>
                        <ul className="rules-summary">
                            <li>{settings.subtype_intro_item1}</li>
                            <li>{settings.subtype_intro_item2}</li>
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
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <Target size={24} />
                        )}
                        <span>{settings.subtype_intro_btn}</span>
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
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }
                .icon-badge {
                    width: 80px;
                    height: 80px;
                    background: var(--bg-secondary);
                    color: var(--accent-secondary);
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

export default SubtypeStart;
