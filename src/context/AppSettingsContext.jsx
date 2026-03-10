import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AppSettingsContext = createContext();

export const AppSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        app_name: 'PMAC V2',
        logo_url: null,
        logo_url_light: null,
        logo_url_dark: null,
        favicon_url: null,
        theme_mode: 'dark',
        primary_color: '#8b5cf6',
        secondary_color: '#10b981',
        bg_color: '#0f172a',
        // Textos de Orientação
        basic_intro_title: 'Teste Básico PMAC (T1-T9)',
        basic_intro_item1: 'Este questionário identificará seu perfil comportamental predominante entre os 9 tipos básicos.',
        basic_intro_item2: 'Não existem respostas certas ou erradas. Responda com sinceridade conforme sua natureza habitual.',
        basic_intro_item3: 'Cada pergunta possui 9 opções. Selecione a que melhor descreve você.',
        basic_intro_btn: 'Começar Minha Jornada Agora',
        subtype_intro_title: 'Módulo de Subtipo',
        subtype_intro_text: 'Agora vamos descobrir qual o seu instinto predominante através de 5 perguntas rápidas.',
        subtype_intro_item1: 'Isso definirá seu perfil completo entre os 27 perfis PMAC.',
        subtype_intro_item2: 'Escolha a frase que melhor descreve seu comportamento instintivo.',
        subtype_intro_btn: 'Descobrir meu Subtipo',
        tiebreaker_intro_title: 'Módulo de Desempate',
        tiebreaker_intro_text: 'Identificamos um equilíbrio entre os tipos selecionados.',
        tiebreaker_intro_item1: 'Este questionário curto de 7 perguntas ajudará a definir seu perfil predominante.',
        tiebreaker_intro_item2: 'Analise as frases com atenção redobrada.',
        tiebreaker_intro_item3: 'Escolha a que mais se aproxima da sua realidade atual.',
        tiebreaker_intro_btn: 'Iniciar Desempate'
    });
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (data && !error) {
            setSettings(data);
            applyTheme(data);
            // Salvar para o próximo carregamento imediato
            localStorage.setItem('app_pmac_settings', JSON.stringify(data));
        }
        setLoading(false);
    };

    const hexToRgb = (hex) => {
        if (!hex) return null;
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
    };

    const applyTheme = (s) => {
        const root = document.documentElement;
        if (s.theme_mode === 'light') {
            root.style.setProperty('--bg-primary', '#FDF8F5');
            root.style.setProperty('--bg-secondary', '#ffffff');
            root.style.setProperty('--bg-tertiary', '#f8fafc');
            root.style.setProperty('--text-primary', '#1e293b');
            root.style.setProperty('--text-secondary', '#334155');
            root.style.setProperty('--text-tertiary', '#64748b'); // Improved legibility (darker grey)
            root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.7)');
            root.style.setProperty('--glass-panel-bg', 'rgba(255, 255, 255, 0.8)');
            root.style.setProperty('--glass-border', 'rgba(139, 92, 246, 0.1)'); // Tinted border
            root.style.setProperty('--glass-shadow', '0 8px 32px rgba(25, 42, 69, 0.08)');
        } else {
            root.style.setProperty('--bg-primary', s.bg_color || '#0f172a');
            root.style.setProperty('--bg-secondary', '#1e293b');
            root.style.setProperty('--bg-tertiary', '#334155');
            root.style.setProperty('--text-primary', '#f8fafc');
            root.style.setProperty('--text-secondary', '#94a3b8');
            root.style.setProperty('--text-tertiary', '#64748b');
            root.style.setProperty('--glass-bg', 'rgba(30, 41, 59, 0.7)');
            root.style.setProperty('--glass-panel-bg', 'rgba(30, 41, 59, 0.4)');
            root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
            root.style.setProperty('--glass-shadow', '0 8px 32px 0 rgba(0, 0, 0, 0.37)');
        }

        // Apply dynamic colors
        if (s.primary_color) {
            root.style.setProperty('--accent-primary', s.primary_color);
            const rgb = hexToRgb(s.primary_color);
            if (rgb) root.style.setProperty('--accent-primary-rgb', rgb);
        }
        if (s.secondary_color) root.style.setProperty('--accent-secondary', s.secondary_color);

        // Update Document Head
        document.title = s.app_name;
        if (s.favicon_url) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = s.favicon_url;
        }
    };

    /**
     * Returns the appropriate logo URL based on current theme mode.
     * Prioritizes theme-specific logos, falls back to generic logo_url.
     */
    const getCurrentLogo = () => {
        if (settings.theme_mode === 'light') {
            return settings.logo_url_light || settings.logo_url;
        }
        return settings.logo_url_dark || settings.logo_url;
    };

    useEffect(() => {
        // Carregamento imediato do cache para evitar o flash de cores padrão
        const cached = localStorage.getItem('app_pmac_settings');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setSettings(parsed);
                applyTheme(parsed);
            } catch (e) {
                console.error("Erro ao carregar cache de temas", e);
            }
        }
        fetchSettings();
    }, []);

    const updateSettings = async (newSettings) => {
        const { error } = await supabase
            .from('app_settings')
            .update(newSettings)
            .eq('id', 1);

        if (!error) {
            setSettings(prev => ({ ...prev, ...newSettings }));
            applyTheme({ ...settings, ...newSettings });
            return true;
        }
        console.error("Update failed:", error);
        return false;
    };

    return (
        <AppSettingsContext.Provider value={{
            settings,
            loading,
            updateSettings,
            refreshSettings: fetchSettings,
            getCurrentLogo
        }}>
            {children}
        </AppSettingsContext.Provider>
    );
};

export const useAppSettings = () => useContext(AppSettingsContext);
