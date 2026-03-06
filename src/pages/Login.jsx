import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

const Login = () => {
  const { settings } = useAppSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const translateError = (err) => {
    const message = err.toLowerCase();
    if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (message.includes('email not confirmed')) return 'Por favor, confirme seu e-mail antes de entrar.';
    if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento.';
    return 'Erro ao entrar. Verifique seus dados.';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(translateError(authError.message));
      setLoading(false);
    } else {
      navigate('/access');
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
          <h1>Bem-vindo de volta</h1>
          <p>Entre na sua conta para acessar o questionário</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLogin} className="auth-form">
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="input-extra">
              <Link to="/forgot-password" title="Esqueci minha senha" className="forgot-password-link">
                Esqueci minha senha
              </Link>
            </div>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
            <span>Entrar</span>
          </button>
        </form>

        <div className="auth-footer">
          Não tem uma conta? <Link to="/signup">Cadastre-se</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
