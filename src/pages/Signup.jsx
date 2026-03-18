import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, Loader2, CheckCircle2, Check, X, ShieldCheck } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

const Signup = () => {
    const { settings } = useAppSettings();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    
    // Password rules validation
    const hasMinLength = password.length >= 6;
    const hasNumber = /\d/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    
    // We only strictly require length as per Supabase defaults, but others are recommended
    const isPasswordValid = hasMinLength; 

    const translateError = (err) => {
        const message = err.toLowerCase();
        if (message.includes('user already registered')) return 'Este e-mail já está cadastrado.';
        if (message.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
        if (message.includes('new row violates row-level security')) {
            return null;
        }
        if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento antes de tentar novamente.';
        return 'Ocorreu um erro ao criar sua conta. Verifique os dados e tente novamente.';
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name
                    }
                }
            });

            if (authError) {
                setError(translateError(authError.message));
                setLoading(false);
                return;
            }

            if (data?.user) {
                // Profile creation is already handled by a database trigger (handle_new_user)
                // so we don't need to manually insert here, which was causing 409 Conflict errors.
                
                if (!data.session) {
                    setSuccess(true);
                } else {
                    navigate('/access');
                }
            }
        } catch (err) {
            setError('Erro inesperado. Tente novamente mais tarde.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="auth-container">
                <div className="auth-card glass-panel fade-in">
                    <div className="auth-header">
                        <div className="auth-logo-wrapper">
                            {settings.logo_url ? (
                                <img src={settings.logo_url} alt={settings.app_name} className="auth-logo-img" />
                            ) : (
                                <div className="logo auth-logo" style={{ color: 'var(--accent-secondary)' }}>
                                    <CheckCircle2 size={48} style={{ margin: '0 auto 1.5rem', display: 'block' }} />
                                </div>
                            )}
                        </div>
                        <h1 style={{ color: '#fff' }}>Verifique seu e-mail</h1>
                        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            Enviamos um link de confirmação para <strong>{email}</strong>.
                            Por favor, clique no link para ativar sua conta e começar o teste.
                        </p>
                    </div>

                    <div className="auth-footer" style={{ marginTop: '1rem' }}>
                        <Link to="/login" className="primary-btn" style={{ width: '100%', padding: '0.8rem' }}>
                            Ir para o Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

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
                    <h1>Crie sua conta</h1>
                    <p>Preencha os dados abaixo para começar</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSignup} className="auth-form">
                    <div className="input-group">
                        <label><User size={16} /> Nome Completo</label>
                        <input
                            type="text"
                            placeholder="Ex: João Silva"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

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

                    <div className="input-group">
                        <label><Lock size={16} /> Senha</label>
                        <input
                            type="password"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <div className="password-rules">
                            <span className="input-hint" style={{marginBottom: '0.2rem', opacity: 0.8}}><ShieldCheck size={12} /> Segurança da Senha:</span>
                            <div className={`rule-item ${hasMinLength ? 'valid' : (password.length > 0 ? 'invalid' : '')}`}>
                                {hasMinLength ? <Check size={14} /> : <X size={14} />}
                                <span>Pelo menos 6 caracteres</span>
                            </div>
                            <div className={`rule-item ${hasNumber ? 'valid' : ''}`}>
                                {hasNumber ? <Check size={14} /> : <div style={{width: 14}} />}
                                <span>Pelo menos um número (recomendado)</span>
                            </div>
                            <div className={`rule-item ${hasUpperCase ? 'valid' : ''}`}>
                                {hasUpperCase ? <Check size={14} /> : <div style={{width: 14}} />}
                                <span>Pelo menos uma letra maiúscula (recomendado)</span>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="auth-submit" disabled={loading || !isPasswordValid}>
                        {loading ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
                        <span>{loading ? 'Criando Conta...' : 'Cadastrar'}</span>
                    </button>
                </form>

                <div className="auth-footer">
                    Já tem uma conta? <Link to="/login">Entre agora</Link>
                </div>
            </div>
        </div>
    );
};

export default Signup;
