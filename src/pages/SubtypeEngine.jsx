import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Loader2, ChevronLeft } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

const SubtypeEngine = () => {
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
                const variant = attempt.meta_json.variant; // '01' or '02'

                // 1. Fetch Question
                const { data: qData } = await supabase
                    .from('questions')
                    .select('*')
                    .eq('id', qId)
                    .single();

                // 2. Fetch Options and filter by variant
                const { data: allOptions } = await supabase
                    .from('options')
                    .select('*')
                    .eq('question_id', qId);

                const filteredOptions = allOptions
                    .filter(opt => opt.code.endsWith(variant))
                    .sort(() => Math.random() - 0.5);

                // 3. Check existing answer
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
            await supabase
                .from('answers')
                .upsert({
                    attempt_id: attemptId,
                    question_id: question.id,
                    option_id: optionId
                }, { onConflict: 'attempt_id,question_id' });

            setTimeout(() => {
                if (currentStep < 4) {
                    navigate(`/st/q/${currentStep + 1}?attemptId=${attemptId}`);
                } else {
                    navigate(`/st/finish?attemptId=${attemptId}`);
                }
            }, 400);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <LoadingOverlay
                message="Carregando Subtipo"
                subtitle="Identificando seu instinto predominante..."
            />
        );
    }

    return (
        <div className="engine-container fade-in">
            <div className="progress-header">
                <div></div>
            </div>

            <div className="question-card glass-panel">
                <h2 className="question-text">{question.text}</h2>

                <div className="options-grid">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            className={`option-btn ${selectedOption === opt.id ? 'selected' : ''}`}
                            onClick={() => handleSelect(opt.id)}
                            disabled={saving}
                        >
                            <div className="option-indicator"></div>
                            <span className="option-text">{opt.text}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="engine-footer">
                <div></div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .engine-container { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; padding-bottom: 4rem; }
                .progress-header { display: flex; flex-direction: column; gap: 0.5rem; }
                .step-info { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); }
                .progress-bar-bg { height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden; }
                .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary)); transition: width 0.4s ease; }
                
                .question-card { padding: 3rem; border: 1px solid rgba(139, 92, 246, 0.2); }
                .question-icon { width: 48px; height: 48px; background: rgba(139, 92, 246, 0.1); color: var(--accent-primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 2rem; }
                .question-text { font-size: 1.5rem; line-height: 1.4; margin-bottom: 2.5rem; }
                
                .options-grid { display: flex; flex-direction: column; gap: 1rem; }
                .option-btn { 
                    display: flex; align-items: center; gap: 1.25rem; padding: 1.25rem 1.5rem; 
                    background: var(--bg-secondary); border: 1px solid var(--glass-border); 
                    border-radius: 1rem; color: var(--text-primary); text-align: left; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; 
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
                
                .option-indicator { width: 20px; height: 20px; border: 2px solid var(--text-tertiary); border-radius: 50%; flex-shrink: 0; position: relative; }
                .option-btn.selected .option-indicator { border-color: var(--accent-primary); background: var(--accent-primary); }
                .option-btn.selected .option-indicator::after { content: ''; position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); width: 8px; height: 8px; background: white; border-radius: 50%; }
                .option-text { font-size: 1.1rem; line-height: 1.5; }
                .engine-footer { display: flex; justify-content: flex-start; }
            `}} />
        </div>
    );
};

export default SubtypeEngine;
