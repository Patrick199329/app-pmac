import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import {
    FileUp,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Trash2,
    Eye,
    Download,
    Settings,
    Layers
} from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const ManageReports = () => {
    const [mappings, setMappings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState(null);

    // 9 types * 3 instincts = 27 subtypes
    const types = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const instincts = [
        { key: 'A', label: 'Autopreservação' },
        { key: 'S', label: 'Social' },
        { key: 'R', label: 'Relacional' }
    ];
    const plans = ['BASICO', 'OURO'];

    const subtypesGold = types.flatMap(t => instincts.map(i => `T${t}${i.key}`));
    const subtypesBasic = types.map(t => `T${t}`);

    const fetchMappings = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('report_assets')
            .select('*');

        if (error) {
            console.error("Error fetching report assets:", error);
            setMappings([]);
        } else {
            setMappings(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchMappings();
    }, []);

    const calculateHash = async (file) => {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const handleFileUpload = async (subtype, plan, file) => {
        if (!file) return;

        setUploading(true);
        setStatus({ type: 'info', message: `Processando ${file.name}...` });

        try {
            const isDocx = file.name.toLowerCase().endsWith('.docx');
            const assetType = isDocx ? 'DOCX' : 'PDF';
            const bucketName = isDocx ? 'report-templates' : 'report-files';
            const hash = await calculateHash(file);

            const fileName = `${plan}_${subtype}_${Date.now()}${isDocx ? '.docx' : '.pdf'}`;
            const filePath = `templates/${fileName}`;

            // 1. Upload to Storage
            const { data: storageData, error: storageError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file);

            if (storageError) throw new Error(`Erro Storage: ${storageError.message}`);

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            // 3. Update/Insert in DB
            const existing = mappings.find(m => m.subtype === subtype && m.plan === plan);
            const version = existing ? (existing.template_version || 1) + 1 : 1;

            const { error: dbError } = await supabase
                .from('report_assets')
                .upsert({
                    subtype,
                    plan,
                    file_url: publicUrl,
                    file_path: filePath,
                    asset_type: assetType,
                    template_hash: hash,
                    template_version: version
                }, { onConflict: 'subtype,plan' });

            if (dbError) throw dbError;

            setStatus({ type: 'success', message: 'Relatório atualizado com sucesso!' });
            fetchMappings();
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: error.message || 'Erro ao processar upload.' });
        } finally {
            setUploading(false);
            setTimeout(() => setStatus(null), 3000);
        }
    };

    const handleDelete = async (id, filePath, assetType) => {
        if (!confirm('Tem certeza que deseja excluir este relatório?')) return;

        setLoading(true);
        try {
            const bucketName = assetType === 'DOCX' ? 'report-templates' : 'report-files';
            await supabase.storage.from(bucketName).remove([filePath]);
            const { error } = await supabase.from('report_assets').delete().eq('id', id);

            if (error) throw error;
            setStatus({ type: 'success', message: 'Excluído com sucesso.' });
            fetchMappings();
        } catch (error) {
            setStatus({ type: 'error', message: 'Erro ao excluir.' });
        } finally {
            setLoading(false);
            setTimeout(() => setStatus(null), 3000);
        }
    };

    if (loading && mappings.length === 0) return <LoadingOverlay message="Configurando Relatórios" />;

    return (
        <div className="admin-page fade-in">
            <div className="admin-header">
                <div>
                    <h1>Gerenciar Relatórios</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        Suba PDFs estáticos ou templates DOCX (com [NOME]) para cada subtipo.
                    </p>
                </div>
            </div>

            {status && (
                <div className={`status-banner ${status.type} glass-panel`}>
                    {status.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{status.message}</span>
                </div>
            )}

            <div className="reports-container">
                {plans.map(plan => (
                    <section key={plan} className="plan-section">
                        <h2 className="plan-title">{plan === 'BASICO' ? 'Plano Básico' : 'Plano Ouro'}</h2>
                        <div className="subtype-grid">
                            {(plan === 'BASICO' ? subtypesBasic : subtypesGold).map(subtype => {
                                const mapping = mappings.find(m => m.subtype === subtype && m.plan === plan);
                                return (
                                    <div key={`${plan}-${subtype}`} className={`subtype-card glass-panel ${mapping?.asset_type === 'DOCX' ? 'is-dynamic' : ''}`}>
                                        <div className="card-header">
                                            <div className="header-info">
                                                <span className="subtype-badge">{subtype}</span>
                                                {mapping && (
                                                    <span className={`type-indicator ${(mapping.asset_type || 'PDF').toLowerCase()}`}>
                                                        {mapping.asset_type === 'DOCX' ? <Settings size={10} /> : <FileText size={10} />}
                                                        {mapping.asset_type || 'PDF'}
                                                    </span>
                                                )}
                                            </div>
                                            {mapping ? (
                                                <div className="card-actions">
                                                    <a href={mapping.file_url} target="_blank" rel="noreferrer" title="Visualizar">
                                                        <Eye size={16} />
                                                    </a>
                                                    <button className="delete-btn" onClick={() => handleDelete(mapping.id, mapping.file_path, mapping.asset_type)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="empty-label">Vazio</span>
                                            )}
                                        </div>
                                        <div className="card-body">
                                            <label className="upload-btn">
                                                {uploading ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
                                                <span>{mapping ? 'Trocar' : 'Upload'}</span>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.docx"
                                                    hidden
                                                    disabled={uploading}
                                                    onChange={(e) => handleFileUpload(subtype, plan, e.target.files[0])}
                                                />
                                            </label>
                                            {mapping?.template_version && (
                                                <span className="v-label">v{mapping.template_version}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>

            <style>{`
                .status-banner {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem 1.5rem;
                    margin-bottom: 2rem;
                    border-radius: 0.75rem;
                }
                .status-banner.success { color: #10b981; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2); }
                .status-banner.error { color: #ef4444; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }
                .status-banner.info { color: #8b5cf6; background: rgba(139, 92, 246, 0.1); border-color: rgba(139, 92, 246, 0.2); }

                .plan-section { margin-bottom: 3rem; }
                .plan-title { font-size: 1.5rem; margin-bottom: 1.5rem; color: var(--accent-primary); border-left: 4px solid var(--accent-primary); padding-left: 1rem; }

                .subtype-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 1rem;
                }

                .subtype-card {
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    border: 1px solid var(--glass-border);
                    transition: all 0.2s;
                    position: relative;
                }

                .subtype-card.is-dynamic {
                    border-left: 3px solid var(--accent-secondary);
                    background: rgba(16, 185, 129, 0.03);
                }

                .subtype-card:hover { border-color: var(--accent-primary); transform: translateY(-2px); }

                .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
                .header-info { display: flex; flex-direction: column; gap: 0.25rem; }
                .subtype-badge { font-weight: 800; color: var(--text-primary); font-size: 1.1rem; }
                
                .type-indicator {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 0.6rem;
                    font-weight: 700;
                    padding: 2px 4px;
                    border-radius: 4px;
                    width: fit-content;
                }
                .type-indicator.pdf { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                .type-indicator.docx { background: rgba(16, 185, 129, 0.1); color: #10b981; }

                .empty-label { font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; }

                .card-actions { display: flex; gap: 0.25rem; }
                .card-actions a, .delete-btn { 
                    padding: 0.3rem; 
                    border-radius: 0.4rem; 
                    color: var(--text-tertiary); 
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                }
                .card-actions a:hover { color: var(--accent-primary); background: rgba(139, 92, 246, 0.1); }
                .delete-btn:hover { color: var(--accent-danger); background: rgba(239, 68, 68, 0.1); }

                .card-body {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: auto;
                }

                .upload-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.5rem 0.75rem;
                    background: var(--bg-tertiary);
                    border-radius: 0.5rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px dashed var(--glass-border);
                    flex: 1;
                    margin-right: 0.5rem;
                }

                .upload-btn:hover { background: var(--bg-secondary); border-color: var(--accent-primary); color: var(--accent-primary); }

                .v-label {
                    font-size: 0.65rem;
                    color: var(--text-tertiary);
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
};

export default ManageReports;
