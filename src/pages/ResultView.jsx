import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
  BarChart2,
  AlertTriangle,
  Info,
  RefreshCw,
  Loader2,
  ChevronRight,
  Download,
  FileText as FileIcon
} from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

const ResultView = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [reportAsset, setReportAsset] = useState(null);
  const [userPlan, setUserPlan] = useState('BASICO');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchResult = async () => {
      setLoading(true);

      let idToFetch = attemptId;

      // If 'latest', find the most recent result for user
      if (attemptId === 'latest') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }
        const { data: latest } = await supabase
          .from('results')
          .select('attempt_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latest) {
          idToFetch = latest.attempt_id;
        } else {
          setLoading(false);
          return;
        }
      }

      const { data: res } = await supabase
        .from('results')
        .select('*')
        .eq('attempt_id', idToFetch)
        .single();

      const { data: att } = await supabase
        .from('attempts')
        .select('*')
        .eq('id', idToFetch)
        .single();

      setResult(res);
      setAttempt(att);

      // Fetch Plan and Report
      if (res && att?.kind === 'SUBTYPE') {
        const ownerId = att.user_id;
        if (ownerId) {
          const { data: pass } = await supabase
            .from('access_passes')
            .select('plan')
            .eq('user_id', ownerId)
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const plan = pass?.plan || 'BASICO';
          setUserPlan(plan);

          const subtypeCode = `T${res.type_result}${att.meta_json.winner?.slice(-1)}`;
          const { data: asset } = await supabase
            .from('report_assets')
            .select('*')
            .eq('subtype', subtypeCode)
            .eq('plan', plan)
            .single();

          if (asset) setReportAsset(asset);
        }
      }

      setLoading(false);
    };

    fetchResult();
  }, [attemptId, navigate]);

  const handleDownloadReport = async () => {
    if (!reportAsset || !result || !attempt) return;

    // If it's just a static PDF, download directly
    if (reportAsset.asset_type === 'PDF') {
      window.open(reportAsset.file_url, '_blank');
      return;
    }

    // Trigger the Edge Function for dynamic generation using fetch for better debugging
    setGenerating(true);
    try {
      const subtypeCode = `T${result.type_result}${attempt.meta_json.winner?.slice(-1)}`;
      const { data: { session } } = await supabase.auth.getSession();

      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dxgxdgnuzimhgmwhdkcd.supabase.co';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3hkZ251emltaGdtd2hka2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODkxMzYsImV4cCI6MjA4NzM2NTEzNn0.Dv5hMleFScPsE3xGWVdwM1qOD1Dgf6CZQ9DuNF_5C8U';

      const response = await fetch(`${baseUrl}/functions/v1/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': anonKey
        },
        body: JSON.stringify({ subtypeCode, userPlan })
      });

      const resText = await response.text().catch(() => "Sem corpo de resposta");
      let resData = null;
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        // Não é JSON
      }

      if (!response.ok) {
        const errorMsg = resData?.error || resData?.details || resText || `Erro HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      if (resData?.url) {
        // Engatilhar download direto para evitar bloqueio de popup
        const link = document.createElement('a');
        link.href = resData.url;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error("URL de download não recebida do servidor.");
      }
    } catch (err) {
      console.error("Error generating report:", err);
      // Limitar o tamanho da mensagem para o alert
      const msg = err.message || "Erro desconhecido";
      alert(`Falha na Geração: ${msg.substring(0, 200)}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Processando Resultado" subtitle="Preparando seu relatório de perfil..." />;
  }

  if (generating) {
    return <LoadingOverlay message="Preparando seu Dossiê" subtitle="Personalizando seu relatório... Isso pode levar alguns segundos." />;
  }

  if (!result) {
    return (
      <div className="empty-state glass-panel fade-in">
        <div className="empty-icon"><BarChart2 size={48} /></div>
        <h2>Nenhum resultado encontrado</h2>
        <p>Você ainda não concluiu o questionário básico.</p>
        <Link to="/access" className="primary-btn">Iniciar Teste</Link>
      </div>
    );
  }

  return (
    <div className="result-container fade-in">
      <div className="result-card glass-panel">
        <div className="result-header">
          <div className="header-icon"><BarChart2 size={32} /></div>
          <h1>Resultado da Avaliação</h1>
          <span className="timestamp">Realizado em {new Date(result.created_at).toLocaleDateString('pt-BR')}</span>
        </div>

        {result.status_copy === 'DONE' && (
          <div className="outcome-box success">
            <div className="score-badge">
              {attempt?.kind === 'SUBTYPE' ? (
                <span className="archetype-shorthand">T{result.type_result}{attempt.meta_json.winner?.slice(-1)}</span>
              ) : (
                `T${result.type_result}`
              )}
            </div>
            <div className="outcome-text">
              <h2>
                {attempt?.kind === 'SUBTYPE' && attempt.meta_json.archetype_title ? (
                  <>
                    <span className="archetype-label">Seu Perfil Final:</span>
                    <br />
                    <span className="archetype-title">{attempt.meta_json.archetype_title}</span>
                  </>
                ) : (
                  `Seu Tipo: PMAC T${result.type_result}`
                )}
              </h2>
              <p>
                {attempt?.kind === 'SUBTYPE'
                  ? `Análise concluída com sucesso. Você é uma personalidade Tipo ${result.type_result} com instinto dominante ${attempt.meta_json.winner?.endsWith('A') ? 'Autopreservação' : attempt.meta_json.winner?.endsWith('S') ? 'Social' : 'Relacional'}.`
                  : `Com base em suas respostas, sua personalidade predominante se alinha ao Tipo ${result.type_result}.`
                }
              </p>
            </div>
          </div>
        )}

        {result.status_copy === 'DONE' && attempt?.kind === 'SUBTYPE' && (
          <div className="report-delivery-box glass-panel fade-in" style={{
            marginTop: '-1rem',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(16, 185, 129, 0.1))',
            border: '1px solid var(--accent-primary)',
            padding: '2rem'
          }}>
            <div className="delivery-icon">
              <FileIcon size={40} color="var(--accent-primary)" />
            </div>
            <div className="delivery-content">
              <h3>Seu Relatório Completo ({userPlan})</h3>
              <p>O dossiê detalhado do seu perfil PMAC está pronto para download.</p>
              {reportAsset ? (
                <button
                  onClick={handleDownloadReport}
                  className="primary-btn download-btn"
                  style={{ marginTop: '1rem', background: 'var(--accent-primary)' }}
                  disabled={generating}
                >
                  <Download size={20} />
                  <span>{reportAsset.asset_type === 'DOCX' ? 'Gerar Relatório Personalizado' : 'Baixar Relatório PDF'}</span>
                </button>
              ) : (
                <div className="no-report-msg">
                  <AlertTriangle size={16} />
                  <span>Relatório sendo processado. Disponível em breve.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {result.status_copy === 'TIE' && (
          <div className="outcome-box warning">
            <div className="header-row">
              <AlertTriangle size={32} />
              <h2>Empate Detectado</h2>
            </div>
            <p>Suas respostas indicam uma distribuição equilibrada entre mais de um tipo.</p>
            <div className="tie-info">
              <Info size={16} />
              <span>Você precisará realizar o Questionário de Desempate (DE) para definir seu perfil.</span>
            </div>
            <Link to="/de/start" className="primary-btn pulse" style={{ marginTop: '1.5rem' }}>
              Ir para Desempate
            </Link>
          </div>
        )}

        {result.status_copy === 'INCONSISTENT' && (
          <div className="outcome-box danger">
            <div className="header-row">
              <AlertTriangle size={32} />
              <h2>Resultado Inconsistente</h2>
            </div>
            <p>Não foi possível identificar um padrão claro. Conforme as regras:</p>
            <ul className="rules-list">
              <li>Você deve assistir ao <strong>vídeo da segunda instrução</strong> antes de repetir.</li>
              <li>Se ocorrer uma segunda inconsistência, haverá uma pausa obrigatória de 24 horas.</li>
            </ul>
            <Link to="/video/intro_2" className="primary-btn" style={{ marginTop: '1.5rem' }}>
              Assistir Instrução 2
            </Link>
          </div>
        )}

        <div className="result-details">
          <h3>
            {attempt?.kind === 'SUBTYPE' ? 'Distribuição de Instintos' : 'Distribuição de Pontos'}
          </h3>
          <div className="chart-container">
            {attempt?.meta_json?.counts ? (
              Object.entries(attempt.meta_json.counts)
                .sort((a, b) => b[1] - a[1]) // Sort by count
                .map(([type, count]) => {
                  let label = `T${type}`;
                  let isWinner = false;

                  if (attempt?.kind === 'SUBTYPE') {
                    const instinctMap = { '1': 'Autopreservação', '2': 'Social', '3': 'Relacional' };
                    label = instinctMap[type] || type;
                    // Check if this instinct is the winner
                    const winningInstinctCode = attempt.meta_json.winner?.slice(-1);
                    const currentInstinctLetter = type === '1' ? 'A' : type === '2' ? 'S' : 'R';
                    isWinner = winningInstinctCode === currentInstinctLetter;
                  } else {
                    isWinner = parseInt(type) === result.type_result;
                  }

                  return (
                    <div key={type} className={`chart-row ${isWinner ? 'winner-row' : ''}`}>
                      <span className="type-label">{label}</span>
                      <div className="bar-wrapper">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(count / (attempt?.kind === 'SUBTYPE' ? 5 : 15)) * 100}%`,
                            background: isWinner ? 'var(--accent-primary)' : 'var(--text-tertiary)'
                          }}
                        ></div>
                      </div>
                      <span className="count-value">{count}</span>
                    </div>
                  );
                })
            ) : (
              <div className="no-data-msg">Dados de distribuição não disponíveis para este resultado.</div>
            )}
          </div>
        </div>

        <div className="actions">
          <Link to="/access" className="secondary-btn" style={{ maxWidth: '300px', margin: '0 auto' }}>
            <RefreshCw size={18} />
            <span>Refazer Teste</span>
          </Link>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .result-container {
          display: flex;
          justify-content: center;
          padding: 2rem 0;
        }

        .result-card {
          width: 100%;
          max-width: 800px;
          padding: 3rem;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .result-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .header-icon {
          width: 64px;
          height: 64px;
          background: rgba(139, 92, 246, 0.1);
          color: var(--accent-primary);
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .timestamp {
          font-size: 0.875rem;
          color: var(--text-tertiary);
        }

        .outcome-box {
          padding: 2.5rem;
          border-radius: 1.5rem;
          display: flex;
          gap: 2rem;
          align-items: center;
        }

        .outcome-box.success { background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); }
        .outcome-box.warning { background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.1); flex-direction: column; align-items: flex-start; }
        .outcome-box.danger { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); flex-direction: column; align-items: flex-start; }
        
        .report-delivery-box {
          display: flex;
          align-items: center;
          gap: 2rem;
          border-radius: 1.5rem;
        }

        .delivery-icon {
          width: 80px;
          height: 80px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .delivery-content h3 { font-size: 1.25rem; margin-bottom: 0.25rem; color: var(--text-primary); }
        .delivery-content p { font-size: 0.9rem; color: var(--text-tertiary); }

        .no-report-msg {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          color: var(--accent-warning);
          font-size: 0.85rem;
          font-weight: 600;
        }

        .download-btn {
          width: fit-content !important;
        }

        .score-badge {
          font-size: 3rem;
          font-weight: 900;
          color: var(--accent-secondary);
          background: rgba(16, 185, 129, 0.1);
          min-width: 120px;
          height: 120px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          text-align: center;
        }

        .archetype-shorthand {
          font-size: 2rem;
          line-height: 1;
        }

        .archetype-label {
          font-size: 1rem;
          color: var(--text-tertiary);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .archetype-title {
          font-size: 2rem;
          color: var(--accent-secondary);
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 800;
        }

        .winner-row .type-label {
          color: var(--accent-primary);
        }

        .header-row {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .rules-list {
          text-align: left;
          margin: 1rem 0;
          padding-left: 1.5rem;
          font-size: 0.95rem;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .rules-list li {
          line-height: 1.5;
        }

        .tie-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .chart-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .chart-row {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .type-label {
          width: 140px;
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bar-wrapper {
          flex: 1;
          height: 12px;
          background: var(--bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 1s ease-out;
          opacity: 0.9;
        }

        .count-value {
          width: 20px;
          text-align: right;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .no-data-msg {
          font-size: 0.875rem;
          color: var(--text-tertiary);
          padding: 1rem;
          border: 1px dashed var(--glass-border);
          border-radius: 0.5rem;
          text-align: center;
        }

        .actions {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }

        .actions > * {
          flex: 1;
        }

        @media (max-width: 600px) {
          .outcome-box {
            flex-direction: column;
            text-align: center;
          }
          .actions {
            flex-direction: column;
          }
        }
      `}} />
    </div>
  );
};

export default ResultView;
