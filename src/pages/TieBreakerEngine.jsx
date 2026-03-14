import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Loader2, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

const TieBreakerEngine = () => {
    const { step } = useParams();
    const [searchParams] = useSearchParams();
    const attemptId = searchParams.get('attemptId');
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [question, setQuestion] = useState(null);
    const [options, setOptions] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [attemptMeta, setAttemptMeta] = useState(null);
    const [saving, setSaving] = useState(false);

    const currentStep = parseInt(step) || 0;

    useEffect(() => {
        const loadQuestionData = async () => {
            if (!attemptId) {
                navigate('/access');
                return;
            }

            setLoading(true);
            try {
                // 1. Fetch Attempt Meta
                const { data: attempt } = await supabase
                    .from('attempts')
                    .select('*')
                    .eq('id', attemptId)
                    .single();

                if (!attempt || attempt.status !== 'IN_PROGRESS') {
                    navigate('/access');
                    return;
                }

                setAttemptMeta(attempt.meta_json);
                const qId = attempt.meta_json.question_order[currentStep];
                const phraseSeed = attempt.meta_json.phrase_seeds[currentStep]; // 0 or 1
                const suffix = phraseSeed === 0 ? '01' : '02';

                // 2. Fetch Question
                const { data: qData } = await supabase
                    .from('questions')
                    .select('*')
                    .eq('id', qId)
                    .single();

                // 3. Fetch Options and filter by tied_types AND suffix
                const { data: allOptions } = await supabase
                    .from('options')
                    .select('*')
                    .eq('question_id', qId);

                const filteredOptions = [];
                for (const type of attempt.meta_json.tied_types) {
                    const typeOptions = allOptions.filter(o => {
                        const scoreTypeMatches = o.score_type == type;
                        const codeMatches = o.code && (o.code.startsWith('T' + type) || o.code.startsWith('ST' + type));
                        return scoreTypeMatches || codeMatches;
                    });
                    if (typeOptions.length > 0) {
                        // Priority 1: match the standard tie-breaker variant suffix ('01' or '02')
                        let pickedOpt = typeOptions.find(o => o.code && o.code.endsWith(suffix));
                        
                        // Priority 2: if no suffix match (e.g., in basic questions where suffixes vary), pick one deterministically
                        if (!pickedOpt) {
                            pickedOpt = typeOptions[phraseSeed % typeOptions.length];
                        }
                        
                        if (pickedOpt) {
                            filteredOptions.push(pickedOpt);
                        }
                    }
                }
                
                filteredOptions.sort(() => Math.random() - 0.5);

                // 4. Check if already answered
                const { data: existingAnswer } = await supabase
                    .from('answers')
                    .select('option_id')
                    .eq('attempt_id', attemptId)
                    .eq('question_id', qId)
                    .maybeSingle();

                setQuestion(qData);
                setOptions(filteredOptions);
                setSelectedOption(existingAnswer?.option_id || null);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadQuestionData();
    }, [currentStep, attemptId, navigate]);

    const handleSelect = async (optionId) => {
        setSelectedOption(optionId);
        setSaving(true);
        try {
            const { error } = await supabase
                .from('answers')
                .upsert({
                    attempt_id: attemptId,
                    question_id: question.id,
                    option_id: optionId
                }, { onConflict: 'attempt_id,question_id' });

            if (error) throw error;

            // Auto-advance with slight delay for UX
            setTimeout(() => {
                const totalQuestions = attemptMeta.question_order.length;
                if (currentStep < totalQuestions - 1) {
                    navigate(`/de/q/${currentStep + 1}?attemptId=${attemptId}`);
                } else {
                    navigate(`/de/finish?attemptId=${attemptId}`);
                }
            }, 400);
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar resposta.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <LoadingOverlay
                message="Carregando Desempate"
                subtitle="Refinando seus resultados..."
            />
        );
    }

    return (
        <div className="engine-container fade-in">
            <div className="progress-header">
                <div className="step-info">Questão {currentStep + 1} de {attemptMeta?.question_order?.length}</div>
                <div className="progress-bar-bg">
                    <div
                        className="progress-bar-fill"
                        style={{ width: `${((currentStep + 1) / (attemptMeta?.question_order?.length)) * 100}%` }}
                    ></div>
                </div>
            </div>

            <div className="question-card glass-panel">
                <div className="question-icon">
                    <HelpCircle size={24} />
                </div>
                <h2 className="question-text">{question.text}</h2>

                <div className="options-grid">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            className={`option-btn ${selectedOption === opt.id ? 'selected' : ''}`}
                            onClick={() => handleSelect(opt.id)}
                            disabled={saving}
                        >
                            <div className="check-indicator"></div>
                            <span className="option-text">{opt.text}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="engine-footer">
                <button
                    className="secondary-btn"
                    onClick={() => navigate(`/de/q/${currentStep - 1}?attemptId=${attemptId}`)}
                    disabled={currentStep === 0 || saving}
                    style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem' }}
                >
                    <ChevronLeft size={20} />
                    <span>Anterior</span>
                </button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .engine-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 2rem 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                    min-height: calc(100vh - 120px);
                }

                .progress-header { display: flex; flex-direction: column; gap: 0.75rem; }
                .progress-bar-bg { height: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; overflow: hidden; }
                .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary)); transition: width 0.4s ease; }

                .question-card { padding: 3rem; border: 1px solid rgba(139, 92, 246, 0.2); }
                .question-text { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin-bottom: 2rem; }

                .options-grid { display: flex; flex-direction: column; gap: 1rem; }
                .option-btn {
                    padding: 1.25rem 1.5rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--glass-border);
                    border-radius: 1rem;
                    color: var(--text-primary);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    cursor: pointer;
                    text-align: left;
                }

                .option-btn:hover:not(:disabled) {
                    border-color: var(--accent-primary);
                    background: var(--bg-primary);
                    transform: translateX(4px);
                }

                .option-btn.selected {
                    background: rgba(var(--accent-primary-rgb), 0.1);
                    border-color: var(--accent-primary);
                    box-shadow: 0 4px 12px rgba(var(--accent-primary-rgb), 0.1);
                }

                .option-text {
                    font-size: 1.1rem;
                    line-height: 1.5;
                    flex: 1;
                }

                .check-indicator {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 2px solid var(--text-tertiary);
                    flex-shrink: 0;
                    transition: all 0.2s ease;
                    position: relative;
                }

                .option-btn.selected .check-indicator {
                    border-color: var(--accent-primary);
                    background: var(--accent-primary);
                }

                .option-btn.selected .check-indicator::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 8px;
                    height: 8px;
                    background: white;
                    border-radius: 50%;
                }

                .engine-footer {
                    display: flex;
                    align-items: center;
                }

                .nav-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.75rem;
                    font-weight: 600;
                    transition: var(--transition-smooth);
                }

                .nav-btn.secondary {
                    background: transparent;
                    color: var(--text-secondary);
                }

                .nav-btn.secondary:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.05);
                }

                .nav-btn.primary {
                    background: var(--accent-primary);
                    color: white;
                }
            `}} />
        </div>
    );
};

export default TieBreakerEngine;
