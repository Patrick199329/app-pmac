# Regras de Avaliação e Algoritmos

Este documento detalha a inteligência implementada para o processamento dos resultados do Questionário Básico PMAC (T1-T9).

## 1. Classificação das Respostas
Cada uma das 10 perguntas possui 9 opções. Cada opção está vinculada a um **Código** (ex: `T1BAPP01`), onde o primeiro dígito após o 'T' identifica o Tipo de Personalidade (1 a 9).

## 2. Regras de Vitória (Rule 4)
O sistema declara um **Vencedor Único** (`DONE`) nos seguintes casos:
- **Regra 4a**: Um tipo possui 5 ou mais votos E é o maior de todos (sem empate no topo).
- **Regra 4b**: Um tipo possui exatamente 4 votos E nenhum outro tipo possui 3 ou mais votos.

## 3. Regras de Empate (Rule 5)
O status de **EMPATE** (`TIE`) é declarado para disparar o questionário de desempate (DE):
- **Regra 5a (Desempate Inclusivo)**: Quando nenhum tipo atinge a vitória (Regra 4), o sistema entra em status de **EMPATE** (`TIE`) incluindo **todos os tipos que receberam 1 ou mais votos**.
    - *Nota*: Por solicitação do cliente, a exclusão de perfis com poucos votos foi suspensa para evitar manipulação do resultado.

## 4. Inconsistência (Rule 6)
O status **INCONSISTENTE** foi simplificado para atender à demanda de inclusividade:
- **Removida**: A regra de fragmentação (ex: 2, 2, 2, 2, 1, 1) agora é tratada como **EMPATE** (TIE) inclusivo.
- **Mantida**: O status ocorre apenas em casos de erro técnico onde não há respostas válidas mapeadas para os tipos.

## 5. Travas de Reincidência (Regras D e E)
- **Primeira Inconsistência**: O usuário é obrigado a assistir ao vídeo de **Instrução 2** antes de repetir o teste.
- **Segunda Inconsistência (Consecutiva)**: Se o usuário gerar duas inconsistências seguidas, o sistema aplica um **bloqueio de 24 horas** para nova tentativa.

## 6. Questionário de Desempate (DE)

Quando o status **TIE** é atingido no questionário básico, o usuário é direcionado para o módulo de desempate.

### 6.1 Funcionamento do Motor DE
- **Estrutura**: 7 perguntas fixas com opções dinâmicas (expandido de 5 para 7).
- **Opções Dinâmicas**: O sistema filtra e exibe apenas as opções dos Tipos que estão em disputa no empate.
- **Variedade de Frases (Rodadas 1 e 2)**: Cada Tipo possui 2 opções de frase por pergunta no banco de desempate. O motor sorteia aleatoriamente entre a versão '01' ou '02'.
- **Repetição de Questões (Rodada 3+)**: A partir da 3ª iteração do desempate, o sistema transita automaticamente para um banco de reutilização.
    - O motor busca apenas as perguntas que foram marcadas com o flag **"Repetir a partir do 3º desempate"** no painel administrativo.
    - Isso permite que o cliente utilize perguntas do questionário básico ou de outros sets para evitar a fadiga do usuário com as frases do banco de desempate original.
- **Ordem**: Tanto as perguntas quanto as opções dentro delas são exibidas em ordem aleatória para garantir a isenção do teste.

### 6.2 Vitória no Desempate (Regra 7)
- **Vitória Direta**: O vencedor é definido quando um Tipo obtém uma quantidade de respostas **estritamente superior** a todos os demais tipos participantes do desempate.
- **Regra de Exclusão (Melhoria de Fluxo)**: Caso o empate persista (empate no topo), o sistema analisa a distribuição dos votos para a próxima rodada:
    - Tipos que obtiveram **menos de 2 pontos** (0 ou 1) são automaticamente **excluídos** das rodadas subsequentes.
    - Se após esta exclusão restar apenas **um único Tipo** com 2 ou mais pontos, este é declarado o **Vencedor** imediatamente, sem necessidade de nova rodada.
- **Repetição**: Caso o empate persista entre 2 ou mais tipos (ambos com 2 ou mais pontos), o processo se repete (Regra 5a recorrente) apenas com os tipos remanescentes até que um vencedor seja isolado.

### 7.1 Diferenciação de Jornada por Plano
O fluxo após a definição do Tipo Base (ou conclusão do Desempate) depende do plano do usuário:

- **Plano BÁSICO**: A jornada encerra imediatamente. O usuário é levado à tela de resultados, onde visualiza seu Tipo Principal (1 a 9) com nome amigável e tem acesso ao download do **Relatório de Perfil Básico**.
- **Plano OURO**: A jornada continua para o módulo de Subtipos para determinar o **Instinto Predominante** e o Arquétipo final.

### 7.2 Estrutura do Módulo de Subtipos (Plano Ouro)
- **Frequência**: 5 perguntas específicas para o Tipo Base identificado.
- **Opções**: 3 frases por pergunta, cada uma correspondendo a um instinto:
    - **A**: Autopreservação (Score Type 1)
    - **S**: Social (Score Type 2)
    - **R**: Relacional (Score Type 3)

### 7.2 Lógica de Variantes e Empate (Regra de Subtipo)
- **Variante Inicial ('01')**: O sistema utiliza o primeiro conjunto de frases (`01`) para as 5 perguntas.
- **Condição de Vitória**: O instinto que obtiver a pontuação mais alta, de forma **isolada** (ex: 3 votos para A, 1 para S, 1 para R), é declarado o vencedor.
- **Resolução de Empate**: Se houver empate entre os maiores pontuadores (ex: 2 para Social e 2 para Relacional), o sistema dispara uma **2ª rodada** imediata:
    - É sorteada uma nova ordem das mesmas 5 questões, mas utilizando as frases da **Variante '02'**.
    - O objetivo é desempatar as tendências através de uma perspectiva linguística diferente.

### 7.3 Determinação do Perfil Final (Arquétipo)
O resultado final é a combinação do Tipo Base + Instinto Vencedor, gerando um dos **27 Perfis PMAC** (ex: Tipo 1 + Relacional = *Perfeccionista Reformador*). Os dados finais são armazenados na tabela `results` vinculado ao `archetypes`.
