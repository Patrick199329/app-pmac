import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { PlayCircle, Save, Loader2, Link as LinkIcon, AlertCircle, Video } from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const ManageVideos = () => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState({});
    const [messages, setMessages] = useState({});

    useEffect(() => {
        fetchVideos();
    }, []);

    const fetchVideos = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('videos')
            .select('*')
            .order('key', { ascending: true });

        // Ensure we have at least intro_1 and intro_2 for the UI
        const expectedKeys = ['intro_1', 'intro_2'];
        const existingData = data || [];

        const merged = expectedKeys.map(key => {
            const found = existingData.find(v => v.key === key);
            return found || { key, url: '' };
        });

        setVideos(merged);
        setLoading(false);
    };

    const handleUrlChange = (key, newUrl) => {
        setVideos(prev => prev.map(v => v.key === key ? { ...v, url: newUrl } : v));
    };

    const handleSave = async (key, url) => {
        const trimmedUrl = (url || '').trim();
        setSaveLoading(prev => ({ ...prev, [key]: true }));
        const { error } = await supabase
            .from('videos')
            .upsert({ key, url: trimmedUrl }, { onConflict: 'key' });

        if (error) {
            setMessages(prev => ({ ...prev, [key]: { type: 'error', text: 'Erro ao salvar.' } }));
        } else {
            setMessages(prev => ({ ...prev, [key]: { type: 'success', text: 'Salvo!' } }));
            setTimeout(() => setMessages(prev => ({ ...prev, [key]: null })), 3000);
            // Update local state with trimmed url
            setVideos(prev => prev.map(v => v.key === key ? { ...v, url: trimmedUrl } : v));
        }
        setSaveLoading(prev => ({ ...prev, [key]: false }));
    };

    if (loading) return <LoadingOverlay message="Carregando Vídeos" subtitle="Recuperando links de instrução..." />;

    return (
        <div className="admin-page fade-in">
            <div className="admin-header">
                <h1>Configuração de Vídeos</h1>
                <p>Gerencie os vídeos de instrução do sistema conforme as regras da metodologia.</p>
            </div>

            <div className="videos-grid">
                {videos.map((vid) => (
                    <div key={vid.key} className="admin-card glass-panel video-config-card">
                        <div className="card-header-icon">
                            <div className={`icon-box ${vid.key === 'intro_1' ? 'blue' : 'purple'}`}>
                                <Video size={24} />
                            </div>
                            <div>
                                <h3>{vid.key === 'intro_1' ? 'Instrução 1 (Início)' : 'Instrução 2 (Inconsistência)'}</h3>
                                <p className="key-label">Key: {vid.key}</p>
                            </div>
                        </div>

                        <p className="description">
                            {vid.key === 'intro_1'
                                ? 'Apresentado obrigatoriamente para todos os novos usuários antes do primeiro teste.'
                                : 'Apresentado obrigatoriamente para usuários que gerarem um resultado inconsistente.'}
                        </p>

                        <div className="input-group">
                            <label><LinkIcon size={14} /> Link do Vídeo</label>
                            <input
                                type="text"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={vid.url}
                                onChange={(e) => handleUrlChange(vid.key, e.target.value)}
                            />
                        </div>

                        {vid.url && (
                            <div className="admin-video-preview">
                                <iframe
                                    width="100%"
                                    height="200"
                                    src={vid.url.includes('youtube.com/watch?v=')
                                        ? vid.url.replace('watch?v=', 'embed/')
                                        : vid.url.includes('youtu.be/')
                                            ? `https://www.youtube.com/embed/${vid.url.split('youtu.be/')[1]}`
                                            : ''}
                                    title="Video Preview"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        )}

                        <div className="card-footer">
                            <div className="footer-left">
                                {messages[vid.key] && (
                                    <div className={`mini-message ${messages[vid.key].type}`}>
                                        <span>{messages[vid.key].text}</span>
                                    </div>
                                )}
                            </div>

                            <div className="footer-actions">
                                {vid.url && (
                                    <a
                                        href={vid.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="secondary-btn sm"
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <PlayCircle size={14} />
                                        <span>Testar</span>
                                    </a>
                                )}

                                <button
                                    className="primary-btn sm"
                                    onClick={() => handleSave(vid.key, vid.url)}
                                    disabled={saveLoading[vid.key]}
                                >
                                    {saveLoading[vid.key] ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    <span>Salvar</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .videos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 2rem;
            margin-top: 1rem;
        }

        .video-config-card {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .admin-video-preview {
            width: 100%;
            height: 200px;
            background: var(--bg-primary);
            border-radius: 0.5rem;
            overflow: hidden;
            border: 1px solid var(--glass-border);
        }

        .icon-box {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .icon-box.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .icon-box.purple { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

        .key-label { font-size: 0.7rem; font-family: monospace; color: var(--text-tertiary); margin-top: 2px; }
        .description { font-size: 0.875rem; color: var(--text-tertiary); line-height: 1.5; }

        .card-header-icon {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .card-header-icon h3 { font-size: 1.1rem; color: var(--text-primary); }

        .input-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          margin-bottom: 0.5rem;
        }

        .input-group input {
          width: 100%;
          background: var(--bg-tertiary);
          border: 1px solid var(--glass-border);
          padding: 0.875rem;
          border-radius: 0.5rem;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            margin-top: auto;
            padding-top: 1rem;
            border-top: 1px solid var(--glass-border);
        }

        .footer-actions {
            display: flex;
            gap: 0.75rem;
            align-items: center;
        }

        .primary-btn.sm {
            padding: 0.6rem 1.25rem;
            font-size: 0.875rem;
        }

        .mini-message {
            font-size: 0.75rem;
            font-weight: 600;
        }
        .mini-message.success { color: var(--accent-secondary); }
        .mini-message.error { color: var(--accent-danger); }

        @media (max-width: 600px) {
            .videos-grid { grid-template-columns: 1fr; }
        }
      `}} />
        </div>
    );
};

export default ManageVideos;
