import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

const ForgotPassword = () => {
    const { settings } = useAppSettings();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [submitted, setSubmitted] = useState(false);

    const handleResetRequest = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (resetError) {
            setError(resetError.message === 'User not found' ? 'E-mail não encontrado.' : 'Erro ao processar solicitação. Tente novamente.');
            setLoading(false);
        } else {
            setSubmitted(true);
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card glass-panel fade-in">
                <div className="auth-header">
                    <div className="auth-logo-wrapper">
                        {settings.logo_url ? (
                            <img src={settings.logo_url} alt={settings.app_name} className="auth-logo-img" />
                        ) : (
                            <div className="logo auth-logo">{settings.app_name}</div>
                        )}
                    </div>
                    <h1>Recuperar senha</h1>
                    <p>Enviaremos um link de recuperação para o seu e-mail</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                {!submitted ? (
                    <form onSubmit={handleResetRequest} className="auth-form">
                        <div className="input-group">
                            <label><Mail size={16} /> Email</label>
                            <input
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="auth-submit" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : <Mail size={20} />}
                            <span>Enviar Link</span>
                        </button>
                    </form>
                ) : (
                    <div className="auth-success-state">
                        <div className="success-icon-wrapper">
                            <CheckCircle2 size={48} color="var(--accent-secondary)" />
                        </div>
                        <h3>E-mail enviado!</h3>
                        <p>Verifique sua caixa de entrada (e a pasta de spam) para o link de alteração de senha.</p>
                    </div>
                )}

                <div className="auth-footer">
                    <Link to="/login" className="back-link">
                        <ArrowLeft size={16} /> Voltar para o Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
