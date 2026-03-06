import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

const ResetPassword = () => {
    const { settings } = useAppSettings();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    // Check if we have a session (Supabase handles the recovery token automatically)
    useEffect(() => {
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                console.log('PASSWORD_RECOVERY event received');
            }
        });
    }, []);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setLoading(true);
        setError(null);

        const { error: updateError } = await supabase.auth.updateUser({
            password: password
        });

        if (updateError) {
            setError('Erro ao atualizar senha. O link pode ter expirado.');
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
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
                    <h1>Nova Senha</h1>
                    <p>Digite sua nova senha abaixo</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                {!success ? (
                    <form onSubmit={handleUpdatePassword} className="auth-form">
                        <div className="input-group">
                            <label><Lock size={16} /> Nova Senha</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label><Lock size={16} /> Confirmar Nova Senha</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="auth-submit" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : <Lock size={20} />}
                            <span>Atualizar Senha</span>
                        </button>
                    </form>
                ) : (
                    <div className="auth-success-state">
                        <div className="success-icon-wrapper">
                            <CheckCircle2 size={48} color="var(--accent-secondary)" />
                        </div>
                        <h3>Senha atualizada!</h3>
                        <p>Sua senha foi alterada com sucesso. Você será redirecionado para o login em instantes.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
