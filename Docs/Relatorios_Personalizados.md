# Sistema de Geração de Relatórios Personalizados (PMAC V2)

Este documento descreve a arquitetura, o fluxo de dados e a configuração do sistema de geração de dossiês em PDF personalizados.

## 1. Arquitetura do Sistema

O sistema é composto por três partes principais trabalhando em conjunto:

1.  **Frontend (React/Vite)**: Onde o usuário clica no botão "Gerar Relatório". Ele envia uma requisição autenticada para o Supabase Edge Function.
2.  **Supabase Edge Function (`generate-report`)**: O "cérebro" do processo. Ele verifica quem é o usuário, busca o template correto no banco de dados, baixa o arquivo `.docx` e gerencia o cache.
3.  **Serviço de Conversão (Railway)**: Um microserviço Node.js que recebe o arquivo `.docx`, substitui os "placeholders" (como `{NOME}`) e converte o documento final para PDF em tempo real usando LibreOffice.

## 2. Fluxo de Execução

1.  **Início**: O usuário solicita o relatório no `ResultView`.
2.  **Autenticação**: A Edge Function valida o JWT do usuário.
3.  **Localização de Asset**: O sistema busca na tabela `report_assets` o template vinculado ao tipo do usuário (Ex: T4A) e ao seu plano (Básico/Premium).
4.  **Verificação de Cache**: Se o relatório já foi gerado recentemente e o template não mudou, o sistema entrega um link assinado do arquivo existente no Storage `reports`.
5.  **Processamento (Se não houver cache)**:
    *   Baixa o template `.docx` do bucket `report-templates`.
    *   Envia o arquivo para o serviço no Railway.
    *   O serviço substitui as variáveis e transforma em PDF.
6.  **Armazenamento**: O PDF gerado é salvo no bucket `reports` para uso futuro.
7.  **Entrega**: O sistema gera um link temporário (Signed URL) seguro e abre no navegador do usuário.

## 3. Estrutura de Dados

### Tabelas Criadas:
- `report_assets`: Contém o mapeamento entre o Perfil (T1..T9 + Instinto) e o arquivo template.
- `report_jobs`: Gerencia o controle de concorrência (evita que o mesmo usuário gere o mesmo relatório duas vezes ao mesmo tempo).
- `report_generation_logs`: Logs detalhados de cada tentativa de geração, tempo de processamento e erros.

### Buckets de Storage:
- `report-templates`: Armazena os arquivos Word originais (Admin).
- `report-files`: Armazena PDFs estáticos.
- `reports`: Armazena os PDFs personalizados gerados pela função (Pasta `reports/{user_id}/`).

## 4. Configuração Técnica (Segredos)

Para o funcionamento, as seguintes variáveis (Secrets) devem estar configuradas no Supabase:
- `INTERNAL_CONVERTER_URL`: URL do serviço no Railway.
- `INTERNAL_CONVERTER_TOKEN`: Token de segurança para autenticar a chamada entre Supabase e Railway.
- `SUPABASE_SERVICE_ROLE_KEY`: Chave mestra para acesso aos arquivos.

---
*Data da implementação: 04 de Março de 2026*
