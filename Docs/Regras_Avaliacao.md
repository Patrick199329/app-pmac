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
- **Regra 5a/b**: Dois ou mais tipos empatam com a mesma pontuação máxima (sendo esta $\ge 3$).
- **Regra 5c**: Um tipo tem 4 votos e outro tem 3 votos.
- **Regra 5d**: Um tipo tem 3 votos e outro tem 2 votos.

## 4. Inconsistência (Rule 6)
O status **INCONSISTENTE** é aplicado quando a distribuição é muito fragmentada, impedindo uma análise confiável:
- Ocorre em qualquer caso que não se encaixe nas regras de Vitória ou Empate acima (ex: 2, 2, 2, 2, 1, 1).

## 5. Travas de Reincidência (Regras D e E)
- **Primeira Inconsistência**: O usuário é obrigado a assistir ao vídeo de **Instrução 2** antes de repetir o teste.
- **Segunda Inconsistência (Consecutiva)**: Se o usuário gerar duas inconsistências seguidas, o sistema aplica um **bloqueio de 24 horas** para nova tentativa.

## 6. Questionário de Desempate (DE)

Quando o status **TIE** é atingido no questionário básico, o usuário é direcionado para o módulo de desempate.

### 6.1 Funcionamento do Motor DE
- **Estrutura**: 5 perguntas fixas com opções dinâmicas.
- **Opções Dinâmicas**: O sistema filtra e exibe apenas as opções dos Tipos que estão em disputa no empate.
- **Variedade de Frases**: Cada Tipo possui 2 opções de frase por pergunta. O motor sorteia aleatoriamente entre a versão '01' ou '02' de cada tipo em cada execução para evitar previsibilidade.
- **Ordem**: Tanto as 5 perguntas quanto as opções dentro delas são exibidas em ordem aleatória.

### 6.2 Vitória no Desempate (Regra 7)
- O vencedor é definido quando um Tipo obtém uma quantidade de respostas **estritamente superior** a todos os demais tipos participantes do desempate.
- Caso o empate persista após as 5 perguntas (ex: 2 votos para T3 e 2 para T4), o processo se repete com novas combinações de frases até que um vencedor seja isolado.

## 7. Subtipos (Instintos)

Após a definição do Tipo Base (T1-T9), o sistema inicia automaticamente o módulo de Subtipos para determinar o **Instinto Predominante**.

### 7.1 Estrutura do Módulo de Subtipos
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
