import React, { useEffect, useState, useRef } from 'react';
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

    // Auto-start for direct flow
    const hasStarted = useRef(false);
    useEffect(() => {
        if (!checking && type && !loading && !hasStarted.current) {
            hasStarted.current = true;
            handleStart();
        }
    }, [checking, type, loading]);

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

export default SubtypeStart;
