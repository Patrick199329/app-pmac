# Estrutura de Dados (Banco de Dados)

O sistema utiliza o PostgreSQL (via Supabase) com a seguinte modelagem:

## Tabelas Principais

### `profiles`
Armazena dados dos usuários e seu nível de acesso.
- `id`: UUID (Primary Key / Auth Link)
- `name`: Nome completo
- `role`: 'USER' ou 'ADMIN'

### `question_sets`
Define os tipos de questionários.
- `key`: 'BASIC' ou 'TIE_BREAKER'
- `title`: Nome legível

### `questions`
As perguntas do sistema.
- `id`: UUID
- `question_set_id`: FK para question_sets
- `text`: O enunciado
- `order_index`: Ordem de exibição (1-10)
- `use_in_3rd_round_tiebreaker`: Booleano que define se a questão será reutilizada em rodadas avançadas de empate (Rodada 3+).

### `options`
As alternativas de resposta.
- `question_id`: FK para questions
- `code`: Código técnico (ex: T1BAPP01)
- `text`: O texto da opção
- `score_type`: Inteiro mapeando o tipo (1-9)

### `attempts`
As tentativas de teste de cada usuário.
- `status`: 'IN_PROGRESS', 'DONE', 'TIE', 'INCONSISTENT'
- `meta_json`: Armazena a contagem final e a distribuição de pontos
- `finished_at`: Data da conclusão

### `results`
Cópia otimizada para visualização rápida.
- `type_result`: O tipo vencedor (se houver)
- `status_copy`: Espelho do status da tentativa

### `video_views`
Rastro de visualização de instruções.
- `video_key`: Identificador do vídeo (intro_1, intro_2)
- `user_id`: FK para profiles

### `access_passes`
Gerenciamento de planos e validade de acesso.
- `plan`: 'BASICO' ou 'OURO'
- `status`: 'ACTIVE' ou 'REVOKED'
- `user_id`: FK para profiles

### `report_assets`
Configuração de arquivos para download.
- `subtype`: Código do tipo (T2) ou subtipo (T2A)
- `plan`: Plano ao qual o arquivo pertence
- `asset_type`: 'PDF' (estático) ou 'DOCX' (template para preenchimento dinâmico)
- `file_url`: Link de acesso público no Storage
