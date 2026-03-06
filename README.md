# PMAC V2 - Fase 1

Aplicativo web para execução de questionário comportamental PMAC (T1-T9).

## Tecnologias
- React + Vite
- Supabase (Auth, Database, RLS)
- Vanilla CSS (Premium Dark Theme)
- Lucide React (Icons)
- Framer Motion & Canvas Confetti (UX)

## Funcionalidades Implementadas (Fase 1)
- **Autenticação:** Login e Cadastro com perfis de Usuário e Admin.
- **Gating de Acesso:** Usuários só iniciam o teste se possuírem um passe ativo (liberado via Admin ou stub de compra).
- **Vídeo Obrigatório:** Bloqueio de avanço até a conclusão do vídeo de introdução.
- **Motor de Questionário:**
  - Randomização de perguntas e opções.
  - Barra de progresso dinâmica.
  - Salvamento automático de progresso.
- **Cálculo de Resultados:**
  - Identificação de tipo predominante.
  - Detecção de Empates (TIE).
  - Identificação de Inconsistências.
- **Área Admin:**
  - Gestão de Acessos (Liberar/Revogar).
  - Gestão de Vídeos.
  - CRUD de Perguntas e Opções (validação de 9 opções por pergunta).
  - Validador de Integridade do banco de dados.

## Como configurar o primeiro Admin
1. Cadastre-se normalmente na tela de `/signup`.
2. No painel do Supabase, execute o seguinte SQL (ou use a ferramenta de dados):
   ```sql
   UPDATE public.profiles SET role = 'ADMIN' WHERE email = 'seu-email@exemplo.com';
   ```
3. Faça logout e login novamente para acessar as ferramentas administrativas.

## Configuração do Banco de Dados
O script de migração já foi aplicado ao projeto Supabase `dxgxdgnuzimhgmwhdkcd`.
Caso precise rodar localmente, as chaves anônimas estão no arquivo `src/services/supabase.js`.
