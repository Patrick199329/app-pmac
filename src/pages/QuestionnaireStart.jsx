import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Play, Loader2, ClipboardList, Info } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

const QuestionnaireStart = () => {
    const { settings } = useAppSettings();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleStart = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return;
        }

        try {
            // Check for previous attempts to enforce Rules
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            const isAdmin = profile?.role === 'ADMIN';

            const { data: previousAttempts } = await supabase
                .from('attempts')
                .select('created_at, status, id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (previousAttempts && previousAttempts.length > 0) {
                const firstAttemptDate = new Date(previousAttempts[0].created_at);
                const tenDaysInMs = 10 * 24 * 60 * 60 * 1000;
                const now = new Date();

                if (now - firstAttemptDate > tenDaysInMs && !isAdmin) {
                    alert('Seu prazo de 10 dias para responder o questionário expirou. Contate o suporte.');
                    setLoading(false);
                    return;
                }

                // Check for valid IN_PROGRESS attempt to resume
                // It must have 10 question IDs in order to be valid for current BASIC version
                const inProgress = previousAttempts.find(a =>
                    a.status === 'IN_PROGRESS'
                );

                if (inProgress) {
                    // Fetch that attempt's meta to check size
                    const { data: attMeta } = await supabase
                        .from('attempts')
                        .select('meta_json')
                        .eq('id', inProgress.id)
                        .single();

                    if (attMeta?.meta_json?.question_order?.length === 10) {
                        navigate(`/basic/q/0?attemptId=${inProgress.id}`);
                        return;
                    } else {
                        // Cleanup corrupted attempt found
                        await supabase.from('answers').delete().eq('attempt_id', inProgress.id);
                        await supabase.from('attempts').delete().eq('id', inProgress.id);
                    }
                }
            }

            // 1. Fetch BASIC question set ID
            const { data: qSet } = await supabase
                .from('question_sets')
                .select('id')
                .eq('key', 'BASIC')
                .single();

            if (!qSet) {
                alert('Questionário BASIC não encontrado. Contate o suporte.');
                setLoading(false);
                return;
            }

            // 2. Fetch all questions for this set
            const { data: questions } = await supabase
                .from('questions')
                .select('id')
                .eq('question_set_id', qSet.id);

            if (!questions || questions.length === 0) {
                alert('Nenhuma pergunta cadastrada para o questionário BASIC.');
                setLoading(false);
                return;
            }

            // 3. Shuffle question order
            const shuffledIds = questions.map(q => q.id).sort(() => Math.random() - 0.5);

            // 4. Create attempt
            const { data: attempt, error } = await supabase
                .from('attempts')
                .insert([{
                    user_id: user.id,
                    kind: 'BASIC',
                    status: 'IN_PROGRESS',
                    meta_json: { question_order: shuffledIds, current_seed: Math.random() }
                }])
                .select()
                .single();

            if (error) throw error;

            // 5. Navigate to first question
            navigate(`/basic/q/0?attemptId=${attempt.id}`);
        } catch (err) {
            console.error(err);
            alert('Erro ao iniciar questionário. Verifique sua conexão.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="start-container fade-in">
            <div className="info-card glass-panel">
                <div className="info-header">
                    <ClipboardList size={32} className="accent-text" />
                    <h1>{settings.basic_intro_title}</h1>
                </div>

                <div className="info-content">
                    <div className="info-item">
                        <Info size={20} />
                        <p>{settings.basic_intro_item1}</p>
                    </div>
                    <div className="info-item">
                        <Info size={20} />
                        <p>{settings.basic_intro_item2}</p>
                    </div>
                    <div className="info-item">
                        <Info size={20} />
                        <p>{settings.basic_intro_item3}</p>
                    </div>
                </div>

                <button
                    className="primary-btn pulse"
                    onClick={handleStart}
                    disabled={loading}
                    style={{ width: '100%', padding: '1.25rem', marginTop: '1rem' }}
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={24} />
                    ) : (
                        <Play size={24} />
                    )}
                    <span>{settings.basic_intro_btn}</span>
                </button>
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
                .info-card {
                    max-width: 640px;
                    width: 100%;
                    padding: 4rem;
                    display: flex;
                    flex-direction: column;
                    gap: 2.5rem;
                    border: 1px solid rgba(139, 92, 246, 0.2);
                }
                .info-header {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.5rem;
                }
                .info-header h1 {
                    font-size: 2.25rem;
                    color: var(--text-primary);
                    margin: 0;
                }
                .info-content {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .info-item {
                    display: flex;
                    gap: 1.5rem;
                    padding: 1.5rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--glass-border);
                    border-radius: 1.25rem;
                    font-size: 1rem;
                    color: var(--text-secondary);
                    line-height: 1.6;
                    align-items: flex-start;
                }
                .info-item svg {
                    flex-shrink: 0;
                    margin-top: 0.25rem;
                    color: var(--accent-primary);
                }
            `}} />
        </div>
    );
};

export default QuestionnaireStart;
