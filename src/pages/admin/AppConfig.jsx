import React, { useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext';
import {
    Palette,
    Type,
    Image as ImageIcon,
    Save,
    RefreshCcw,
    Sun,
    Moon,
    Check,
    Target,
    ClipboardList,
    Info
} from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const AppConfig = () => {
    const { settings, updateSettings, loading } = useAppSettings();
    const [form, setForm] = useState(settings);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [activeTab, setActiveTab] = useState('visual');
 
    // Sincronizar o formulário administrativo com as configurações globais quando elas terminarem de carregar
    React.useEffect(() => {
        if (!loading && settings) {
            setForm(settings);
        }
    }, [settings, loading]);

    const handleSave = async () => {
        setSaving(true);
        const ok = await updateSettings(form);
        if (ok) {
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        }
        setSaving(false);
    };

    const applyPreset = (preset) => {
        const presets = {
            'pm-light': {
                theme_mode: 'light',
                primary_color: '#192A45',
                secondary_color: '#B38B4D',
                bg_color: '#FDF8F5'
            },
            'pm-dark': {
                theme_mode: 'dark',
                primary_color: '#B38B4D',
                secondary_color: '#192A45',
                bg_color: '#0A0F1A'
            },
            'modern-violet': {
                theme_mode: 'dark',
                primary_color: '#8b5cf6',
                secondary_color: '#d946ef',
                bg_color: '#0f172a'
            },
            'emerald': {
                theme_mode: 'light',
                primary_color: '#059669',
                secondary_color: '#0891b2',
                bg_color: '#F0F9FF'
            },
            'sunset': {
                theme_mode: 'dark',
                primary_color: '#f43f5e',
                secondary_color: '#fbbf24',
                bg_color: '#1a0b0b'
            }
        };

        if (presets[preset]) {
            setForm({ ...form, ...presets[preset] });
        }
    };

    if (loading) return <LoadingOverlay message="Carregando Configurações" />;

    return (
        <div className="admin-page fade-in">
            <div className="admin-header">
                <div>
                    <h1>Configurações do Aplicativo</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        Personalize a identidade visual, logos e cores da plataforma.
                    </p>
                </div>
                <button
                    className="primary-btn"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <RefreshCcw className="animate-spin" /> : <Save size={18} />}
                    <span>{success ? 'Salvo!' : 'Salvar Alterações'}</span>
                </button>
            </div>

            <div className="config-tabs">
                <button className={`tab-btn ${activeTab === 'visual' ? 'active' : ''}`} onClick={() => setActiveTab('visual')}>Aparência Visual</button>
                <button className={`tab-btn ${activeTab === 'texts' ? 'active' : ''}`} onClick={() => setActiveTab('texts')}>Textos de Orientação</button>
            </div>

            {activeTab === 'visual' ? (
                <div className="config-grid">
                    {/* Seção Identidade */}
                    <div className="config-section glass-panel">
                        <div className="section-title">
                            <Type size={20} />
                            <h3>Identidade Básica</h3>
                        </div>
                        <div className="form-group">
                            <label>Nome do Aplicativo</label>
                            <input
                                type="text"
                                className="glass-input"
                                value={form.app_name}
                                onChange={e => setForm({ ...form, app_name: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>URL do Favicon (.ico ou .png)</label>
                            <input
                                type="text"
                                className="glass-input"
                                value={form.favicon_url || ''}
                                onChange={e => setForm({ ...form, favicon_url: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Seção Logos */}
                    <div className="config-section glass-panel">
                        <div className="section-title">
                            <ImageIcon size={20} />
                            <h3>Logotipos por Tema</h3>
                        </div>

                        <div className="logo-dual-grid">
                            <div className="form-group">
                                <label>Logo Tema Claro</label>
                                <div className="logo-preview-container light">
                                    {form.logo_url_light ? (
                                        <img src={form.logo_url_light} alt="Light Logo Preview" className="logo-preview" />
                                    ) : (
                                        <div className="logo-placeholder">Sem Logo</div>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    className="glass-input"
                                    style={{ marginTop: '0.5rem' }}
                                    value={form.logo_url_light || ''}
                                    onChange={e => setForm({ ...form, logo_url_light: e.target.value })}
                                    placeholder="URL Logo p/ Fundo Claro"
                                />
                            </div>

                            <div className="form-group">
                                <label>Logo Tema Escuro</label>
                                <div className="logo-preview-container dark">
                                    {form.logo_url_dark ? (
                                        <img src={form.logo_url_dark} alt="Dark Logo Preview" className="logo-preview" />
                                    ) : (
                                        <div className="logo-placeholder">Sem Logo</div>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    className="glass-input"
                                    style={{ marginTop: '0.5rem' }}
                                    value={form.logo_url_dark || ''}
                                    onChange={e => setForm({ ...form, logo_url_dark: e.target.value })}
                                    placeholder="URL Logo p/ Fundo Escuro"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Seção Cores e Tema */}
                    <div className="config-section glass-panel" style={{ gridColumn: 'span 2' }}>
                        <div className="section-title">
                            <Palette size={20} />
                            <h3>Aparência e Cores</h3>
                        </div>

                        <div className="presets-wrapper">
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>PALETAS RÁPIDAS</label>
                            <div className="presets-container">
                                <button className="preset-btn" onClick={() => applyPreset('pm-light')}>
                                    <div className="preset-colors">
                                        <span style={{ background: '#192A45' }}></span>
                                        <span style={{ background: '#B38B4D' }}></span>
                                        <span style={{ background: '#FDF8F5' }}></span>
                                    </div>
                                    <span>P. Moreira (Light)</span>
                                </button>
                                <button className="preset-btn" onClick={() => applyPreset('pm-dark')}>
                                    <div className="preset-colors">
                                        <span style={{ background: '#B38B4D' }}></span>
                                        <span style={{ background: '#192A45' }}></span>
                                        <span style={{ background: '#0A0F1A' }}></span>
                                    </div>
                                    <span>P. Moreira (Dark)</span>
                                </button>
                                <button className="preset-btn" onClick={() => applyPreset('modern-violet')}>
                                    <div className="preset-colors">
                                        <span style={{ background: '#8b5cf6' }}></span>
                                        <span style={{ background: '#d946ef' }}></span>
                                        <span style={{ background: '#0f172a' }}></span>
                                    </div>
                                    <span>Modern Violet</span>
                                </button>
                            </div>
                        </div>

                        <div className="colors-grid">
                            <div className="form-group">
                                <label>Cor Primária (Accent)</label>
                                <div className="color-input-wrapper">
                                    <input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} />
                                    <input type="text" className="glass-input" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Cor Secundária</label>
                                <div className="color-input-wrapper">
                                    <input type="color" value={form.secondary_color} onChange={e => setForm({ ...form, secondary_color: e.target.value })} />
                                    <input type="text" className="glass-input" value={form.secondary_color} onChange={e => setForm({ ...form, secondary_color: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Fundo (Dark Mode)</label>
                                <div className="color-input-wrapper">
                                    <input type="color" value={form.bg_color} onChange={e => setForm({ ...form, bg_color: e.target.value })} />
                                    <input type="text" className="glass-input" value={form.bg_color} onChange={e => setForm({ ...form, bg_color: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="config-grid texts-grid">
                    {/* Teste Básico */}
                    <div className="config-section glass-panel">
                        <div className="section-title">
                            <ClipboardList size={20} />
                            <h3>Introdução: Teste Básico</h3>
                        </div>
                        <div className="form-group">
                            <label>Título da Página</label>
                            <input type="text" className="glass-input" value={form.basic_intro_title} onChange={e => setForm({ ...form, basic_intro_title: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Instrução 1 (Card)</label>
                            <textarea className="glass-input" value={form.basic_intro_item1} onChange={e => setForm({ ...form, basic_intro_item1: e.target.value })} rows={2} />
                        </div>
                        <div className="form-group">
                            <label>Instrução 2 (Card)</label>
                            <textarea className="glass-input" value={form.basic_intro_item2} onChange={e => setForm({ ...form, basic_intro_item2: e.target.value })} rows={2} />
                        </div>
                        <div className="form-group">
                            <label>Instrução 3 (Card)</label>
                            <textarea className="glass-input" value={form.basic_intro_item3} onChange={e => setForm({ ...form, basic_intro_item3: e.target.value })} rows={2} />
                        </div>
                        <div className="form-group">
                            <label>Texto do Botão</label>
                            <input type="text" className="glass-input" value={form.basic_intro_btn} onChange={e => setForm({ ...form, basic_intro_btn: e.target.value })} />
                        </div>
                    </div>

                    {/* Módulo de Subtipo */}
                    <div className="config-section glass-panel">
                        <div className="section-title">
                            <Target size={20} />
                            <h3>Introdução: Subtipo</h3>
                        </div>
                        <div className="form-group">
                            <label>Título da Página</label>
                            <input type="text" className="glass-input" value={form.subtype_intro_title} onChange={e => setForm({ ...form, subtype_intro_title: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Texto de Chamada</label>
                            <textarea className="glass-input" value={form.subtype_intro_text} onChange={e => setForm({ ...form, subtype_intro_text: e.target.value })} rows={2} />
                        </div>
                        <div className="form-group">
                            <label>Ponto Chave 1</label>
                            <input type="text" className="glass-input" value={form.subtype_intro_item1} onChange={e => setForm({ ...form, subtype_intro_item1: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Ponto Chave 2</label>
                            <input type="text" className="glass-input" value={form.subtype_intro_item2} onChange={e => setForm({ ...form, subtype_intro_item2: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Texto do Botão</label>
                            <input type="text" className="glass-input" value={form.subtype_intro_btn} onChange={e => setForm({ ...form, subtype_intro_btn: e.target.value })} />
                        </div>
                    </div>

                    {/* Módulo de Desempate */}
                    <div className="config-section glass-panel" style={{ gridColumn: 'span 2' }}>
                        <div className="section-title">
                            <RefreshCcw size={20} />
                            <h3>Introdução: Desempate</h3>
                        </div>
                        <div className="logo-dual-grid">
                            <div>
                                <div className="form-group">
                                    <label>Título da Página</label>
                                    <input type="text" className="glass-input" value={form.tiebreaker_intro_title} onChange={e => setForm({ ...form, tiebreaker_intro_title: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Texto de Chamada</label>
                                    <textarea className="glass-input" value={form.tiebreaker_intro_text} onChange={e => setForm({ ...form, tiebreaker_intro_text: e.target.value })} rows={2} />
                                </div>
                            </div>
                            <div>
                                <div className="form-group">
                                    <label>Itens de Orientação (Lista)</label>
                                    <input type="text" className="glass-input" style={{ marginBottom: '0.5rem' }} value={form.tiebreaker_intro_item1} onChange={e => setForm({ ...form, tiebreaker_intro_item1: e.target.value })} placeholder="Item 1" />
                                    <input type="text" className="glass-input" style={{ marginBottom: '0.5rem' }} value={form.tiebreaker_intro_item2} onChange={e => setForm({ ...form, tiebreaker_intro_item2: e.target.value })} placeholder="Item 2" />
                                    <input type="text" className="glass-input" value={form.tiebreaker_intro_item3} onChange={e => setForm({ ...form, tiebreaker_intro_item3: e.target.value })} placeholder="Item 3" />
                                </div>
                                <div className="form-group">
                                    <label>Texto do Botão</label>
                                    <input type="text" className="glass-input" value={form.tiebreaker_intro_btn} onChange={e => setForm({ ...form, tiebreaker_intro_btn: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Mensagem para Usuários de Parceiros */}
                    <div className="config-section glass-panel" style={{ gridColumn: 'span 2' }}>
                        <div className="section-title">
                            <Info size={20} />
                            <h3>Restrição de Relatório: Usuário de Parceiro</h3>
                        </div>
                        <div className="form-group">
                            <label>Mensagem Exibida no lugar do Download</label>
                            <textarea 
                                className="glass-input" 
                                value={form.partner_report_message || ''} 
                                onChange={e => setForm({ ...form, partner_report_message: e.target.value })} 
                                rows={3}
                                placeholder="Texto que o cliente final verá caso o relatório esteja bloqueado para ele."
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                                Esta mensagem aparecerá para usuários vinculados a parceiros, já que apenas o parceiro pode baixar o relatório.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .admin-page { max-width: 1000px; margin: 0 auto; }
                .admin-page h1 { margin-bottom: 0.5rem; }
                .admin-subtitle { color: var(--text-tertiary); margin-bottom: 2.5rem; }

                .config-tabs {
                    display: flex; gap: 0.5rem; margin-bottom: 2rem;
                    border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;
                }

                .tab-btn {
                    padding: 0.6rem 1.25rem; border-radius: 0.75rem; font-size: 0.85rem;
                    font-weight: 600; color: var(--text-tertiary); background: transparent;
                    transition: all 0.2s; border: 1px solid transparent; cursor: pointer;
                }

                .tab-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }
                .tab-btn.active { 
                    color: var(--accent-primary); 
                    background: rgba(139, 92, 246, 0.1); 
                    border-color: rgba(139, 92, 246, 0.2);
                }

                .texts-grid textarea {
                    resize: vertical; min-height: 80px; line-height: 1.5;
                }

                .config-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                }

                .config-section { 
                    padding: 2rem; 
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--glass-border);
                }

                .section-title h3 { margin: 0; font-size: 1.1rem; color: var(--text-primary); }

                .form-group label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-tertiary);
                    text-transform: uppercase;
                    margin-bottom: 0.75rem;
                    letter-spacing: 0.05em;
                }

                .glass-input {
                    width: 100%;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--glass-border);
                    padding: 0.875rem 1.25rem;
                    border-radius: 0.75rem;
                    color: var(--text-primary);
                    font-size: 0.95rem;
                    transition: border-color 0.2s;
                    outline: none;
                }

                .glass-input:focus { border-color: var(--accent-primary); }

                .logo-preview-container.light { background: #ffffff; }
                .logo-preview-container.dark { background: #1a1a1a; }

                .logo-dual-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }

                .logo-preview { max-height: 80%; max-width: 90%; object-fit: contain; }
                .logo-placeholder { color: var(--text-tertiary); font-size: 0.85rem; }

                .presets-wrapper { margin-bottom: 2rem; }
                .presets-container { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; }
                
                .preset-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    border-radius: 0.75rem;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--glass-border);
                    color: var(--text-primary);
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .preset-btn:hover { background: var(--bg-secondary); border-color: var(--accent-primary); transform: translateY(-2px); }
                .preset-colors { display: flex; border-radius: 4px; overflow: hidden; border: 1px solid var(--glass-border); }
                .preset-colors span { width: 14px; height: 14px; display: block; }

                .theme-toggle-btns {
                    display: flex;
                    gap: 0.5rem;
                    background: var(--bg-tertiary);
                    padding: 0.25rem;
                    border-radius: 0.75rem;
                    width: fit-content;
                    margin-top: 0.5rem;
                }
                
                .toggle-btn {
                    padding: 0.6rem 1.25rem;
                    border-radius: 0.5rem;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    background: transparent;
                }
                
                .toggle-btn.active {
                    background: var(--accent-primary);
                    color: #fff;
                }

                .colors-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                    margin-top: 2rem;
                    padding-top: 2rem;
                    border-top: 1px solid var(--glass-border);
                }

                .color-input-wrapper { display: flex; gap: 0.5rem; align-items: center; }

                input[type="color"] {
                    -webkit-appearance: none;
                    border: none;
                    width: 42px;
                    height: 42px;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    background: none;
                    padding: 0;
                }
                input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
                input[type="color"]::-webkit-color-swatch { border: none; border-radius: 0.5rem; }

                @media (max-width: 900px) {
                    .config-grid { grid-template-columns: 1fr; }
                    .colors-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default AppConfig;
