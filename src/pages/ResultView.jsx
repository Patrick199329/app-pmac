import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, getUserActivePlan } from '../services/supabase';
import confetti from 'canvas-confetti';
import {
  BarChart2,
  AlertTriangle,
  Info,
  RefreshCw,
  Loader2,
  ChevronRight,
  Download,
  FileText as FileIcon,
  Video
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
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);

  useEffect(() => {
    const fetchResult = async () => {
      setLoading(true);
      try {
        let idToFetch = attemptId;

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

        // Confetti if success
        if (res?.status_copy === 'DONE') {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#8b5cf6', '#10b981', '#ffffff']
          });
        }

        // Auto-redirect if TIE for direct flow
        if (res?.status_copy === 'TIE') {
          navigate('/de/start');
          return;
        }

        // Fetch Plan and Report
        if (res && att) {
          const ownerId = att.user_id;
          if (ownerId) {
            const plan = await getUserActivePlan(ownerId);
            setUserPlan(plan);

            let foundAsset = null;

            if (plan === 'OURO' && att?.kind === 'SUBTYPE') {
              const subtypeCode = `T${res.type_result}${att.meta_json.winner?.slice(-1)}`;
              const { data: asset } = await supabase
                .from('report_assets')
                .select('*')
                .eq('subtype', subtypeCode)
                .eq('plan', 'OURO')
                .maybeSingle();

              if (asset) foundAsset = asset;
            }

            if (!foundAsset) {
              const { data: asset } = await supabase
                .from('report_assets')
                .select('*')
                .eq('subtype', `T${res.type_result}`)
                .eq('plan', 'BASICO')
                .maybeSingle();

              if (asset) foundAsset = asset;
            }

            if (foundAsset) setReportAsset(foundAsset);
          }
        }

        // Fetch Final Video
        const { data: videoData } = await supabase
          .from('videos')
          .select('url')
          .eq('key', 'intro_2')
          .single();
        if (videoData?.url) setFinalVideoUrl(videoData.url);
      } catch (err) {
        console.error("Error fetching result:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [attemptId, navigate]);

  const handleDownloadReport = async () => {
    if (!reportAsset || !result || !attempt) return;

    if (reportAsset.asset_type === 'PDF') {
      window.open(reportAsset.file_url, '_blank');
      return;
    }

    setGenerating(true);
    try {
      const isSubtype = attempt?.kind === 'SUBTYPE';
      const subtypeCode = isSubtype
        ? `T${result.type_result}${attempt.meta_json.winner?.slice(-1)}`
        : `T${result.type_result}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sessão expirada. Por favor, saia e entre novamente.");
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dxgxdgnuzimhgmwhdkcd.supabase.co';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3hkZ251emltaGdtd2hka2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODkxMzYsImV4cCI6MjA4NzM2NTEzNn0.Dv5hMleFScPsE3xGWVdwM1qOD1Dgf6CZQ9DuNF_5C8U';

      const response = await fetch(`${baseUrl}/functions/v1/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          subtypeCode,
          userPlan,
          isBasic: userPlan === 'BASICO',
          archetypeTitle: attempt.meta_json?.archetype_title
        })
      });

      const resText = await response.text().catch(() => "Sem corpo de resposta");
      let resData = null;
      try { resData = JSON.parse(resText); } catch (e) {}

      if (!response.ok) {
        const errorMsg = resData?.error || resData?.details || resText || `Erro HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      if (resData?.url) {
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
      alert(`Falha na Geração: ${err.message || "Erro desconhecido"}`);
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
        <Link to="/access" className="primary-btn">Iniciar Questionário PMAC®</Link>
      </div>
    );
  }

  return (
    <div className="result-container fade-in">
      <div className="result-card glass-panel">
        <div className="result-header">
          <div className="header-icon"><BarChart2 size={32} /></div>
          <h1>Resultado PMAC®</h1>
          <span className="timestamp">Realizado em {new Date(result.created_at).toLocaleDateString('pt-BR')}</span>
        </div>

        {result.status_copy === 'DONE' && (
          <div className="outcome-box success">
            <div className="outcome-text">
              <h2>
                <span className="archetype-label">Seu Perfil:</span>
                <br />
                <span className="archetype-title">
                  {userPlan === 'OURO' && attempt?.kind === 'SUBTYPE' && attempt.meta_json.archetype_title 
                    ? attempt.meta_json.archetype_title 
                    : (
                      <>
                        {result.type_result === 1 && 'Perfeccionista'}
                        {result.type_result === 2 && 'Ajudador'}
                        {result.type_result === 3 && 'Realizador'}
                        {result.type_result === 4 && 'Emocional'}
                        {result.type_result === 5 && 'Analítico'}
                        {result.type_result === 6 && 'Questionador'}
                        {result.type_result === 7 && 'Entusiasta'}
                        {result.type_result === 8 && 'Dominador'}
                        {result.type_result === 9 && 'Mediador'}
                      </>
                    )
                  }
                </span>
              </h2>
              <p>
                {userPlan === 'OURO' && attempt?.kind === 'SUBTYPE' && attempt.meta_json.archetype_title
                  ? `Com base em suas respostas, sua essência comportamental é de um ${attempt.meta_json.archetype_title}.`
                  : `Com base em suas respostas, sua essência comportamental é de um ${result.type_result === 1 ? 'Perfeccionista' :
                    result.type_result === 2 ? 'Ajudador' :
                      result.type_result === 3 ? 'Realizador' :
                        result.type_result === 4 ? 'Emocional' :
                          result.type_result === 5 ? 'Analítico' :
                            result.type_result === 6 ? 'Questionador' :
                              result.type_result === 7 ? 'Entusiasta' :
                                result.type_result === 8 ? 'Dominador' : 'Mediador'
                  }.`
                }
              </p>
            </div>
          </div>
        )}

        {result.status_copy === 'DONE' && finalVideoUrl && (
          <div className="final-video-section glass-panel fade-in">
            <div className="video-section-header">
               <Video size={20} className="accent-text" />
               <h3>Mensagem Final</h3>
            </div>
            <div className="video-container">
              {finalVideoUrl.includes('youtube.com') || finalVideoUrl.includes('youtu.be') ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={finalVideoUrl.includes('v=') 
                    ? finalVideoUrl.replace('watch?v=', 'embed/').split('&')[0]
                    : finalVideoUrl.includes('youtu.be/')
                      ? `https://www.youtube.com/embed/${finalVideoUrl.split('youtu.be/')[1]}`
                      : finalVideoUrl}
                  title="Vídeo Final"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <video src={finalVideoUrl} controls className="native-video" />
              )}
            </div>
          </div>
        )}

        {result.status_copy === 'DONE' && (attempt?.kind === 'SUBTYPE' || userPlan === 'BASICO') && (
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
              <p>{userPlan === 'OURO' ? 'Seu Relatório PMAC® está pronto para download.' : 'Seu Relatório PMAC® está pronto para download.'}</p>
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
                  <span>Seu Relatório PMAC® está sendo processado. Disponível em breve.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {result.status_copy === 'TIE' && (
          <div className="outcome-box warning">
            {/* UI oculta para fluxo direto - Redirecionando para desempate */}
          </div>
        )}

        {result.status_copy === 'INCONSISTENT' && (
          <div className="outcome-box danger">
            <div className="header-row">
              <AlertTriangle size={32} />
              <h2>Resultado Inconsistente</h2>
            </div>
            <p>Não foi possível identificar um padrão claro em suas respostas.</p>
            <p>Recomendamos refazer o questionário com mais calma e atenção a cada afirmação.</p>
            <Link to="/access" className="primary-btn" style={{ marginTop: '1.5rem' }}>
              Refazer Questionário PMAC®
            </Link>
          </div>
        )}


        <div className="actions">
          <Link to="/access" className="secondary-btn" style={{ maxWidth: '300px', margin: '0 auto' }}>
            <RefreshCw size={18} />
            <span>Refazer Questionário PMAC®</span>
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
        
        .final-video-section {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          background: rgba(255, 255, 255, 0.02);
        }

        .video-section-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .video-section-header h3 {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .video-container {
          position: relative;
          padding-top: 56.25%; /* 16:9 */
          background: black;
          border-radius: 1rem;
          overflow: hidden;
          border: 1px solid var(--glass-border);
        }

        .video-container iframe, .native-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }

        .native-video {
          object-fit: contain;
        }
        
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
