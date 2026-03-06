import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

const QuestionnaireEngine = () => {
  const { index } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const attemptId = searchParams.get('attemptId');

  const qIndex = parseInt(index);

  const [attempt, setAttempt] = useState(null);
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        setErrorMsg(null);
        setSelectedOptionId(null);

        if (!attemptId) {
          navigate('/access');
          return;
        }

        // 1. Fetch Attempt
        const { data: att, error: attError } = await supabase
          .from('attempts')
          .select('*')
          .eq('id', attemptId)
          .single();

        if (attError || !att) {
          if (isMounted) navigate('/access');
          return;
        }
        if (isMounted) setAttempt(att);

        const questionOrder = att.meta_json?.question_order || [];
        const questionId = questionOrder[qIndex];

        if (!questionId) {
          if (qIndex >= questionOrder.length && questionOrder.length > 0) {
            if (isMounted) navigate(`/basic/finish?attemptId=${attemptId}`);
          } else {
            if (isMounted) setErrorMsg("Sequência de perguntas inválida.");
          }
          return;
        }

        // 2. Fetch Question
        const { data: q, error: qError } = await supabase
          .from('questions')
          .select('*')
          .eq('id', questionId)
          .single();

        if (qError) throw qError;
        if (isMounted) setQuestion(q);

        // 3. Fetch Options
        const { data: opts, error: oError } = await supabase
          .from('options')
          .select('*')
          .eq('question_id', questionId);

        if (oError) throw oError;

        // Shuffle and set
        if (isMounted) {
          setOptions([...opts].sort(() => Math.random() - 0.5));
        }

        // 4. Fetch existing answer
        const { data: existingAnswer } = await supabase
          .from('answers')
          .select('option_id')
          .eq('attempt_id', attemptId)
          .eq('question_id', questionId)
          .maybeSingle();

        if (isMounted && existingAnswer) {
          setSelectedOptionId(existingAnswer.option_id);
        }
      } catch (err) {
        console.error("Error loading question:", err);
        if (isMounted) setErrorMsg("Falha ao carregar dados. Verifique sua conexão.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [qIndex, attemptId, navigate]);

  const handleSelect = async (optionId) => {
    setSelectedOptionId(optionId);
    setErrorMsg(null);

    // Auto-advance logic (standardizing with DE engine)
    setSaveLoading(true);
    try {
      // Use UPSERT for maximum stability
      const { error } = await supabase
        .from('answers')
        .upsert({
          attempt_id: attemptId,
          question_id: question.id,
          option_id: optionId
        }, { onConflict: 'attempt_id, question_id' });

      if (error) throw error;

      setTimeout(() => {
        if (qIndex < (attempt.meta_json?.question_order?.length || 1) - 1) {
          navigate(`/basic/q/${qIndex + 1}?attemptId=${attemptId}`);
        } else {
          navigate(`/basic/finish?attemptId=${attemptId}`);
        }
      }, 400);

    } catch (err) {
      console.error("Critical error saving answer:", err);
      setErrorMsg("Não foi possível salvar sua resposta. Tente novamente.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePrevious = () => {
    if (qIndex > 0) {
      navigate(`/basic/q/${qIndex - 1}?attemptId=${attemptId}`);
    }
  };

  const handleSaveExit = async () => {
    if (selectedOptionId) {
      await supabase
        .from('answers')
        .upsert({
          attempt_id: attemptId,
          question_id: question.id,
          option_id: selectedOptionId
        }, { onConflict: 'attempt_id, question_id' });
    }
    navigate('/access');
  };

  const handleReset = async () => {
    if (attemptId) {
      await supabase.from('answers').delete().eq('attempt_id', attemptId);
      await supabase.from('attempts').delete().eq('id', attemptId);
    }
    navigate('/basic/start');
  };

  if (loading) {
    return (
      <LoadingOverlay
        message="Preparando Questionário"
        subtitle="Sua jornada de autodescoberta está começando..."
      />
    );
  }

  // Safety check for data corruption
  if (!attempt || !question || !attempt.meta_json?.question_order) {
    return (
      <div className="engine-container">
        <div className="question-card glass-panel" style={{ textAlign: 'center' }}>
          <AlertCircle size={48} className="danger-text" style={{ margin: '0 auto 1.5rem' }} />
          <h2>Dados do teste inconsistentes</h2>
          <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
            Houve uma atualização no questionário e seu progresso anterior não é mais compatível.
          </p>
          <button className="primary-btn" onClick={handleReset} style={{ margin: '0 auto' }}>
            Reiniciar Teste
          </button>
        </div>
      </div>
    );
  }

  const progress = ((qIndex + 1) / attempt.meta_json.question_order.length) * 100;

  return (
    <div className="engine-container fade-in">
      <div className="engine-header">
        <div className="progress-info">
          <span>Pergunta {qIndex + 1} de {attempt.meta_json.question_order.length}</span>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        <button className="exit-btn" onClick={handleSaveExit} title="Salvar e Sair">
          <Save size={18} />
          <span>Salvar e Sair</span>
        </button>
      </div>

      <div className="question-card glass-panel">
        <div className="question-text">
          <HelpCircle size={24} className="accent-text" />
          <h2>{question?.text || "Carregando texto..."}</h2>
        </div>

        <div className="options-grid">
          {options.map((opt) => (
            <button
              key={opt.id}
              className={`option-btn ${selectedOptionId === opt.id ? 'selected' : ''}`}
              onClick={() => handleSelect(opt.id)}
              disabled={saveLoading}
            >
              <div className="option-indicator"></div>
              <span className="option-text">{opt.text}</span>
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="engine-error-banner">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <div className="engine-footer">
        <button
          className="nav-btn prev"
          onClick={handlePrevious}
          disabled={qIndex === 0 || saveLoading}
        >
          <ChevronLeft size={24} />
          <span>Anterior</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .engine-container {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding-bottom: 4rem;
        }

        .engine-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
        }

        .progress-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .progress-info span {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .progress-bar-bg {
          height: 8px;
          background: var(--bg-secondary);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
          transition: width 0.4s ease;
        }

        .exit-btn {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          padding: 0.6rem 1rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          transition: var(--transition-smooth);
        }

        .exit-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
        }

        .question-card {
          padding: 3rem;
        }

        .question-text {
          display: flex;
          gap: 1rem;
          margin-bottom: 2.5rem;
        }

        .question-text h2 {
          font-size: 1.5rem;
          line-height: 1.4;
        }

        .options-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .option-btn {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          background: var(--bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: 1rem;
          color: var(--text-primary);
          text-align: left;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          font-size: 1rem;
          line-height: 1.5;
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

        .option-indicator {
          width: 20px;
          height: 20px;
          border: 2px solid var(--text-tertiary);
          border-radius: 50%;
          flex-shrink: 0;
          transition: var(--transition-smooth);
          position: relative;
        }

        .option-btn.selected .option-indicator {
          border-color: var(--accent-primary);
          background: var(--accent-primary);
        }

        .option-btn.selected .option-indicator::after {
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
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 2rem;
          border-radius: 0.75rem;
          font-weight: 700;
          transition: var(--transition-smooth);
          background: var(--bg-secondary);
          color: var(--text-secondary);
        }

        .nav-btn:hover:not(:disabled) {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .nav-btn.primary {
          background: var(--accent-primary);
          color: white;
        }

        .engine-error-banner {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 0.5rem;
          color: #fca5a5;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          animation: fadeIn 0.3s ease;
        }

        .nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 600px) {
          .nav-btn span {
            display: none;
          }
          .nav-btn {
            padding: 1rem;
          }
          .question-card {
            padding: 1.5rem;
          }
        }
      `}} />
    </div>
  );
};

export default QuestionnaireEngine;
