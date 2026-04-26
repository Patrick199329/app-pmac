import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2
} from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const ManageQuestions = () => {
  const [selectedSet, setSelectedSet] = useState('BASIC'); // 'BASIC', 'TIE_BREAKER', 'SUBTYPE'
  const [selectedSubtype, setSelectedSubtype] = useState(1); // 1-9
  const [qSet, setQSet] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedSet, selectedSubtype]);

  const fetchData = async () => {
    setLoading(true);
    let key = selectedSet;
    if (selectedSet === 'SUBTYPE') {
      key = `SUBTYPE_T${selectedSubtype}`;
    }

    const { data: set } = await supabase
      .from('question_sets')
      .select('*')
      .eq('key', key)
      .single();

    setQSet(set);

    if (set) {
      const { data: qs } = await supabase
        .from('questions')
        .select(`
                    *,
                    options (*)
                `)
        .eq('question_set_id', set.id)
        .order('order_index', { ascending: true });

      setQuestions(qs || []);
    } else {
      setQuestions([]);
    }
    setLoading(false);
  };

  // Form State
  const [qText, setQText] = useState('');
  const [useIn3rdRound, setUseIn3rdRound] = useState(false);
  const [options, setOptions] = useState([]);

  const resetForm = (e) => {
    setQText('');
    setUseIn3rdRound(false);
    if (selectedSet === 'BASIC') {
      setOptions(Array.from({ length: 9 }, (_, i) => ({
        code: `T${i + 1}`,
        text: '',
        score_type: i + 1
      })));
    } else if (selectedSet === 'TIE_BREAKER') {
      const deOptions = [];
      for (let t = 1; t <= 9; t++) {
        deOptions.push({ code: `T${t}DE...01`, text: '', score_type: t });
        deOptions.push({ code: `T${t}DE...02`, text: '', score_type: t });
      }
      setOptions(deOptions);
    } else {
      // Subtype: 3 Instincts * 2 variants = 6 options
      const stOptions = [];
      const instincts = ['A', 'S', 'R'];
      instincts.forEach((ins, idx) => {
        stOptions.push({ code: `ST${selectedSubtype}${ins}01`, text: '', score_type: idx + 1 });
        stOptions.push({ code: `ST${selectedSubtype}${ins}02`, text: '', score_type: idx + 1 });
      });
      setOptions(stOptions);
    }
    setEditingQuestion(null);
    if (e !== false) {
      setIsAdding(false);
    }
  };

  // Correct useEffect to reset form when adding
  useEffect(() => {
    if (isAdding && !editingQuestion) {
      resetForm(false);
    }
  }, [isAdding, editingQuestion, selectedSet, selectedSubtype]);

  const handleSaveQuestion = async () => {
    if (!qText || options.some(o => !o.text)) {
      alert('Por favor, preencha o enunciado e todas as opções.');
      return;
    }

    setLoading(true);
    try {
      if (editingQuestion) {
        // Update
        await supabase.from('questions').update({ 
          text: qText,
          use_in_3rd_round_tiebreaker: useIn3rdRound
        }).eq('id', editingQuestion.id);

        // Update options
        for (const opt of options) {
          if (opt.id) {
            await supabase.from('options').update({ text: opt.text }).eq('id', opt.id);
          } else {
            await supabase.from('options').insert([{ ...opt, question_id: editingQuestion.id }]);
          }
        }
      } else {
        // Create
        const { data: newQ } = await supabase
          .from('questions')
          .insert([{
            question_set_id: qSet.id,
            text: qText,
            order_index: questions.length,
            use_in_3rd_round_tiebreaker: useIn3rdRound
          }])
          .select()
          .single();

        const optsToInsert = options.map(o => ({ ...o, question_id: newQ.id }));
        await supabase.from('options').insert(optsToInsert);
      }

      await fetchData();
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar questionário.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Excluir esta pergunta?')) {
      await supabase.from('questions').delete().eq('id', id);
      fetchData();
    }
  };

  const startEdit = (q) => {
    setEditingQuestion(q);
    setQText(q.text);
    setUseIn3rdRound(q.use_in_3rd_round_tiebreaker || false);
    // Sort options by score_type to keep consistent
    const sortedOpts = [...q.options].sort((a, b) => a.score_type - b.score_type);
    setOptions(sortedOpts);
    setIsAdding(true);
  };

  if (loading && questions.length === 0) {
    return <LoadingOverlay message="Carregando Base" subtitle="Acessando banco de questões..." />;
  }

  return (
    <div className="manage-questions-layout fade-in">
      {/* Sidebar Navigation */}
      <aside className="sets-sidebar glass-panel">
        <div className="sidebar-group">
          <h3>PRINCIPAIS</h3>
          <button
            className={`set-nav-item ${selectedSet === 'BASIC' ? 'active' : ''}`}
            onClick={() => setSelectedSet('BASIC')}
          >
            <div className="set-indicator">BA</div>
            <span>Básico (10q)</span>
          </button>
          <button
            className={`set-nav-item ${selectedSet === 'TIE_BREAKER' ? 'active' : ''}`}
            onClick={() => setSelectedSet('TIE_BREAKER')}
          >
            <div className="set-indicator">DE</div>
            <span>Desempate (5q)</span>
          </button>
        </div>

        <div className="sidebar-group">
          <h3>SUBTIPOS (INSTINTOS)</h3>
          <div className="subtype-grid-nav">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(t => (
              <button
                key={t}
                className={`subtype-nav-btn ${selectedSet === 'SUBTYPE' && selectedSubtype === t ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSet('SUBTYPE');
                  setSelectedSubtype(t);
                }}
              >
                T{t}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="questions-main-content">
        <header className="admin-header">
          <div>
            <h1>{qSet?.title || 'Carregando...'}</h1>
            <p className="admin-subtitle">
              {selectedSet === 'SUBTYPE'
                ? `Gerenciando as questões de instinto para o Tipo ${selectedSubtype}`
                : `Gerenciando o questionário de fluxo principal`}
            </p>
          </div>
          <button className="primary-btn" onClick={() => setIsAdding(true)}>
            <Plus size={20} />
            <span>Nova Pergunta</span>
          </button>
        </header>

        <div className="questions-list">
          {loading ? (
            <div className="loading-state-box">
              <Loader2 className="animate-spin" size={32} />
              <span>Carregando banco de dados...</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="empty-state-box">
              <HelpCircle size={48} />
              <h3>Nenhuma pergunta cadastrada</h3>
              <p>Comece adicionando a primeira pergunta para este conjunto.</p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="question-item glass-panel">
                <div className="q-info">
                  <span className="q-index">#{idx + 1}</span>
                  <div className="q-content-text">
                    <p>{q.text}</p>
                    {q.use_in_3rd_round_tiebreaker && (
                      <span className="de-flag-pill">Repetir a partir do 3º desempate</span>
                    )}
                  </div>
                </div>
                <div className="q-actions">
                  <button className="icon-btn edit" onClick={() => startEdit(q)} title="Editar">
                    <Edit2 size={18} />
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDelete(q.id)} title="Excluir">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modals and Overlays */}
      {isAdding && (
        <div className="modal-overlay">
          <div className="admin-modal glass-panel">
            <div className="modal-header">
              <h2>{editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}</h2>
              <button className="close-btn" onClick={resetForm}><X size={24} /></button>
            </div>

            <div className="modal-body">
              <div className="input-group">
                <label>Enunciado da Pergunta</label>
                <textarea
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="Ex: Como você se comporta sob estresse?"
                />
              </div>

              <div className="input-group checkbox-group">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={useIn3rdRound}
                    onChange={(e) => setUseIn3rdRound(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <span className="label-text">Repetir a partir do 3º desempate</span>
                </label>
              </div>

              <div className="options-editor">
                <label>Opções de Resposta</label>
                <div className="options-grid-admin">
                  {options.map((opt, i) => (
                    <div key={i} className="option-row">
                      <div className="type-badge">
                        {selectedSet === 'SUBTYPE'
                          ? ['A', 'S', 'R'][opt.score_type - 1]
                          : `T${opt.score_type}`}
                      </div>
                      <div className="option-info-admin">
                        <input
                          type="text"
                          className="opt-code-input"
                          value={opt.code}
                          onChange={(e) => {
                            const newOpts = [...options];
                            newOpts[i].code = e.target.value.toUpperCase();
                            setOptions(newOpts);
                          }}
                          placeholder="Código (Ex: T1...)"
                          title="Fique à vontade para completar com o código da planilha."
                        />
                        <input
                          type="text"
                          className="opt-text-input"
                          value={opt.text}
                          onChange={(e) => {
                            const newOpts = [...options];
                            newOpts[i].text = e.target.value;
                            setOptions(newOpts);
                          }}
                          placeholder="Digite a frase correspondente..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary-btn" onClick={resetForm}>Cancelar</button>
              <button className="primary-btn" onClick={handleSaveQuestion}>
                <Save size={20} />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .manage-questions-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 2rem;
          min-height: calc(100vh - 120px);
          max-width: 1400px;
          margin: 0 auto;
          position: relative;
        }

        /* Sidebar Styles */
        .sets-sidebar {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          height: fit-content;
          position: sticky;
          top: 2rem;
          background: var(--bg-secondary);
        }

        .sidebar-group h3 {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--text-tertiary);
          letter-spacing: 0.15em;
          margin-bottom: 1.25rem;
          padding-left: 0.5rem;
          text-transform: uppercase;
        }

        .set-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.85rem 1.25rem;
          border-radius: 0.75rem;
          background: transparent;
          color: var(--text-secondary);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 0.75rem;
          text-align: left;
          border: 1px solid transparent;
        }

        .set-nav-item:hover {
          background: rgba(var(--accent-primary-rgb), 0.05);
          color: var(--text-primary);
        }

        .set-nav-item.active {
          background: rgba(139, 92, 246, 0.08);
          color: var(--accent-primary);
          border-color: rgba(139, 92, 246, 0.2);
          font-weight: 600;
        }

        .set-indicator {
          width: 32px;
          height: 32px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 900;
        }

        .set-nav-item.active .set-indicator {
          background: var(--accent-primary);
          color: white;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .subtype-grid-nav {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        .subtype-nav-btn {
          height: 48px;
          background: var(--bg-tertiary);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          color: var(--text-tertiary);
          font-weight: 800;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .subtype-nav-btn:hover {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .subtype-nav-btn.active {
          background: var(--accent-secondary);
          border-color: var(--accent-secondary);
          color: white;
          box-shadow: 0 8px 20px -6px rgba(16, 185, 129, 0.4);
        }

        /* Main Content Styles */
        .questions-main-content {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-secondary);
          padding: 2rem;
          border-radius: 1.5rem;
          border: 1px solid var(--glass-border);
        }

        .admin-header h1 {
          font-size: 1.75rem;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
        }

        .admin-subtitle {
          color: var(--text-tertiary);
          font-size: 0.95rem;
        }

        .questions-list {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .question-item {
          padding: 1.75rem 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
          background: var(--glass-panel-bg);
          border-radius: 1.25rem;
          border: 1px solid var(--glass-border);
        }

        .question-item:hover {
          background: var(--bg-secondary);
          border-color: var(--accent-primary);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
        }

        .q-info {
          display: flex;
          align-items: flex-start;
          gap: 2rem;
        }

        .q-index {
          font-size: 1.5rem;
          font-weight: 900;
          color: var(--accent-primary);
          opacity: 0.2;
          font-family: 'Outfit', sans-serif;
          margin-top: -0.25rem;
        }

        .question-item p {
          font-size: 1.125rem;
          line-height: 1.6;
          color: var(--text-primary);
          flex: 1;
        }

        .q-actions {
          display: flex;
          gap: 1rem;
        }

        .icon-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          background: var(--bg-tertiary);
          color: var(--text-tertiary);
          border: 1px solid transparent;
        }

        .icon-btn.edit:hover { 
          background: rgba(139, 92, 246, 0.1); 
          color: var(--accent-primary);
          border-color: rgba(139, 92, 246, 0.2);
        }
        .icon-btn.danger:hover { 
          background: rgba(239, 68, 68, 0.08); 
          color: var(--accent-danger);
          border-color: rgba(239, 68, 68, 0.2);
        }

        /* Modal & Overlay - FULL SCREEN FIX */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          z-index: 9999;
          padding: 4rem 2rem;
          overflow-y: auto;
        }

        .admin-modal {
          width: 100%;
          max-width: 900px;
          background: var(--bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: 2rem;
          display: flex;
          flex-direction: column;
          box-shadow: var(--glass-shadow);
          position: relative;
        }

        .modal-header {
          padding: 2.5rem 3rem;
          border-bottom: 1px solid var(--glass-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h2 {
          font-size: 1.5rem;
          color: var(--text-primary);
          margin: 0;
        }

        .close-btn {
          background: var(--bg-tertiary);
          color: var(--text-tertiary);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--accent-danger);
        }

        .modal-body {
          padding: 3rem;
          display: flex;
          flex-direction: column;
          gap: 3rem;
        }

        .input-group label {
          display: block;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-group textarea {
          width: 100%;
          min-height: 110px;
          background: var(--bg-primary);
          border: 1px solid var(--glass-border);
          padding: 1.5rem;
          border-radius: 1rem;
          color: var(--text-primary);
          font-size: 1.1rem;
          line-height: 1.6;
          font-family: inherit;
          resize: vertical;
          transition: border-color 0.2s;
        }

        .input-group textarea:focus {
          border-color: var(--accent-primary);
          outline: none;
        }

        .options-editor > label {
          display: block;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .options-grid-admin {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }

        .option-row {
          display: flex;
          gap: 1.25rem;
          align-items: center;
          padding: 1.25rem;
          background: var(--bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: 1rem;
          transition: all 0.2s;
        }

        .option-row:focus-within {
          border-color: var(--accent-primary);
          background: rgba(var(--accent-primary-rgb), 0.05);
        }

        .type-badge {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: var(--accent-primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 0.85rem;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .option-info-admin {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .opt-code-input {
          font-size: 0.7rem !important;
          font-weight: 800;
          color: var(--accent-primary) !important;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .opt-code-input::placeholder {
          color: var(--text-tertiary);
        }

        .opt-text-input {
          font-size: 1rem !important;
          color: var(--text-primary) !important;
        }

        .option-info-admin input {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 1rem;
          padding: 0;
          outline: none;
          width: 100%;
        }

        .modal-footer {
          padding: 2.5rem 3rem;
          border-top: 1px solid var(--glass-border);
          display: flex;
          justify-content: flex-end;
          gap: 1.5rem;
          background: rgba(2, 6, 23, 0.2);
          border-radius: 0 0 2rem 2rem;
        }

        .loading-state-box, .empty-state-box {
          padding: 8rem 0;
          background: rgba(15, 23, 42, 0.2);
          border-radius: 2rem;
          border: 1px dashed var(--glass-border);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          color: var(--text-tertiary);
        }

        @media (max-width: 1100px) {
          .manage-questions-layout { grid-template-columns: 1fr; }
          .sets-sidebar { position: static; height: auto; }
          .options-grid-admin { grid-template-columns: 1fr; }
        }

        /* Checkbox & Pill Styles */
        .checkbox-group { 
          margin: 1.5rem 0;
          padding: 0 0.5rem;
        }
        .checkbox-container.checkbox-container {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 1.25rem !important;
          cursor: pointer;
          user-select: none;
          padding: 0;
          margin: 0;
          text-transform: none;
        }
        .checkbox-container input { 
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }
        .checkmark {
          width: 24px;
          height: 24px;
          background: var(--bg-tertiary);
          border: 2px solid var(--glass-border);
          border-radius: 6px;
          position: relative;
          transition: all 0.2s;
          flex-shrink: 0;
          display: block;
        }
        .checkbox-container:hover .checkmark {
          border-color: var(--accent-primary);
          background: rgba(139, 92, 246, 0.05);
        }
        .checkbox-container input:checked + .checkmark {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.3);
        }
        .checkmark:after {
          content: "";
          position: absolute;
          display: none;
          left: 8px;
          top: 4px;
          width: 6px;
          height: 11px;
          border: solid white;
          border-width: 0 2.5px 2.5px 0;
          transform: rotate(45deg);
        }
        .checkbox-container input:checked + .checkmark:after { 
          display: block; 
        }
        .label-text { 
          font-weight: 700; 
          color: var(--text-primary); 
          font-size: 1.05rem;
          letter-spacing: 0.02em;
          text-transform: none !important;
        }

        .de-flag-pill {
          display: flex;
          align-items: center;
          width: fit-content;
          padding: 0.25rem 0.75rem;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          color: var(--accent-primary);
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: 3rem;
          margin-top: 0.5rem;
          text-transform: uppercase;
        }
        .q-content-text { flex: 1; display: flex; flex-direction: column; }
      `}} />
    </div>
  );
};

export default ManageQuestions;
