import React, { useEffect, useState } from 'react';
import { supabase, checkAccessPass } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, ShoppingCart, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

const AccessGating = () => {
  const [user, setUser] = useState(null);
  const [hasPass, setHasPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/login');
        return;
      }

      // 1. Get Profile separately for reliability
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!profile) {
        console.error("Profile not found for user:", authUser.id);
        setLoading(false);
        return;
      }

      // 2. Determine admin status immediately
      const isAdmin = profile.role === 'ADMIN';

      // 3. Check for active pass ONLY if not admin
      let passActive = isAdmin;

      if (!isAdmin) {
        const { data: passes } = await supabase
          .from('access_passes')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('status', 'ACTIVE')
          .order('created_at', { ascending: false });

        const latestPass = passes?.[0];
        if (latestPass) {
          const grantDate = new Date(latestPass.created_at);
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;
          if (new Date() - grantDate < thirtyDays) {
            passActive = true;
          }
        }
      }

      setUser(profile);
      setHasPass(passActive);
    } catch (err) {
      console.error("Error in fetchStatus:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleManualPurchase = async () => {
    setProcessing(true);
    const { error } = await supabase
      .from('access_passes')
      .insert([{
        user_id: user.id,
        status: 'ACTIVE',
        granted_by_admin: false
      }]);

    if (!error) {
      await fetchStatus();
    }
    setProcessing(false);
  };

  const handleStart = async () => {
    setProcessing(true);
    try {
      // 1. Get latest attempt
      const { data: latestAttempt } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      // Rule B: 10-day completion
      if (latestAttempt && latestAttempt.status !== 'DONE') {
        const startDate = new Date(latestAttempt.started_at);
        const tenDays = 10 * 24 * 60 * 60 * 1000;
        if (new Date() - startDate > tenDays && user.role !== 'ADMIN') {
          alert('Seu prazo de 10 dias para concluir este teste expirou. Entre em contato com o suporte.');
          setProcessing(false);
          return;
        }
      }

      // Rule: If already finished (DONE), block redo during 30 days
      if (latestAttempt?.status === 'DONE' && user.role !== 'ADMIN') {
        navigate(`/result/${latestAttempt.id}`);
        return;
      }

      // 3. Check for latest result status (TIE/INCONSISTENT logic)
      const { data: results } = await supabase
        .from('results')
        .select('status_copy, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      const lastResult = results?.[0];
      const secondToLast = results?.[1];

      // 24h Block Rule for Inconsistencies
      if (lastResult?.status_copy === 'INCONSISTENT' && secondToLast?.status_copy === 'INCONSISTENT' && user.role !== 'ADMIN') {
        const lastDate = new Date(lastResult.created_at);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (new Date() - lastDate < twentyFourHours) {
          alert('Segunda inconsistência detectada. Por favor, aguarde 24 horas para tentar novamente conforme as regras.');
          setProcessing(false);
          return;
        }
      }

      // DETERMINAR FLUXO
      if (lastResult?.status_copy === 'TIE') {
        navigate('/de/start');
        return;
      }

      if (lastResult?.status_copy === 'INCONSISTENT') {
        const { data: view2 } = await supabase
          .from('video_views')
          .select('completed_at')
          .eq('user_id', user.id)
          .eq('video_key', 'intro_2')
          .maybeSingle();

        if (!view2) {
          navigate('/video/intro_2');
          return;
        }
      }

      navigate('/video/intro_1');

    } catch (err) {
      console.error("Erro no redirecionamento do gating:", err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Verificando Acesso" subtitle="Validando suas credenciais de entrada..." />;
  }

  return (
    <div className="access-container fade-in">
      <div className="status-card glass-panel">
        <div className={`status-icon ${hasPass ? 'success' : 'locked'}`}>
          {hasPass ? <ShieldCheck size={48} /> : <ShieldAlert size={48} />}
        </div>

        <h1>{hasPass ? 'Acesso Liberado!' : 'Acesso Restrito'}</h1>
        <p>
          {hasPass
            ? 'Você possui um passe ativo. Clique no botão abaixo para iniciar o vídeo obrigatório e o questionário.'
            : 'Para realizar o questionário PMAC, você precisa de um passe de acesso ativo.'}
        </p>

        <div className="status-actions">
          {hasPass ? (
            <button className="primary-btn pulse" onClick={handleStart}>
              <span>Iniciar Jornada</span>
              <ArrowRight size={20} />
            </button>
          ) : (
            <>
              <button
                className="primary-btn"
                onClick={handleManualPurchase}
                disabled={processing}
              >
                {processing ? <Loader2 className="animate-spin" /> : <ShoppingCart size={20} />}
                <span>Adquirir Acesso (Demo)</span>
              </button>
              <button className="secondary-btn" onClick={fetchStatus}>
                <RefreshCw size={18} />
                <span>Atualizar Status</span>
              </button>
            </>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .access-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: calc(100vh - 100px);
        }

        .status-card {
          max-width: 500px;
          width: 100%;
          padding: 3rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .status-icon {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .status-icon.success {
          background: rgba(16, 185, 129, 0.1);
          color: var(--accent-secondary);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .status-icon.locked {
          background: rgba(245, 158, 11, 0.1);
          color: var(--accent-warning);
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .status-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
          margin-top: 1rem;
        }


        .pulse {
          animation: pulse-ring 2s infinite;
        }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }

        .status-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 1rem;
          color: var(--text-tertiary);
        }
      `}} />
    </div>
  );
};

export default AccessGating;
