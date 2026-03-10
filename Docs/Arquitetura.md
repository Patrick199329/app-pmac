# Arquitetura da Plataforma PMAC V2

A plataforma PMAC V2 foi desenvolvida utilizando tecnologias modernas para garantir alta performance, segurança de dados e uma experiência de usuário (UX) premium.

## Stack Tecnológica

- **Frontend**: React.js com Vite (SPA - Single Page Application).
- **Estilização**: CSS Vanilla com sistema de variáveis (Glassmorphism design).
- **Backend/Banco de Dados**: Supabase (PostgreSQL) para persistência e autenticação.
- **Ícones**: Lucide React.
- **Animações**: Framer Motion & CSS Transtions.

## Estrutura de Pastas

```text
/src
  /assets         # Imagens e recursos estáticos
  /components     # Componentes reutilizáveis (Layout, Sidebar)
  /services       # Cliente Supabase e funções de API
  /pages          # Páginas principais do fluxo
    /admin        # Área administrativa
    AccessGating.jsx    # Controle de acesso e travas de segurança
    QuestionnaireEngine.jsx # Motor de exibição das perguntas (Básico)
    TieBreakerEngine.jsx    # Motor de desempate (Regras DE)
    QuestionnaireFinish.jsx # Motor de cálculo e algoritmos (Básico)
    TieBreakerFinish.jsx    # Motor de cálculo (Desempate)
    ResultView.jsx      # Visualização e gráficos de resultados
  App.jsx         # Roteamento e estrutura principal
  index.css       # Design System (Cores, Tipografia, Efeitos)
```

## Fluxo de Autenticação e Acesso

1. **Login/Signup**: Autenticação via Supabase Auth.
2. **Access Gating**: Verifica se o usuário possui um "Passe de Acesso" ativo.
3. **Instruções**: Sistema obriga a visualização de vídeos antes de liberar o teste (Intro 1 para novos, Intro 2 para inconsistências).
4. **Roteamento Dinâmico (Plano BASICO vs OURO)**:
   - **Básico**: Após o algoritmo básico ou desempate, o sistema redireciona direto para `/result/:id`.
   - **Ouro**: Após o algoritmo básico ou desempate, o sistema redireciona para o módulo de subtipo (`/st/start`).
5. **Geração de Relatórios**: Sistema híbrido que entrega PDFs estáticos ou gera relatórios personalizados (DOCX para PDF) via Edge Functions + Conversor Railway.
