# Manual do Administrador - Banco de Questões

Este guia explica como gerenciar o conteúdo dos questionários na plataforma PMAC V2.

## 1. Acessando o Gerenciador
No menu lateral, sob a seção **ADMINISTRAÇÃO**, clique em **Banco de Questões**.

## 2. Alternando entre Questionários
No topo da página, existem duas abas:
- **Questionário Básico (BA)**: Contém as 10 perguntas iniciais que definem o perfil ou geram empates/inconsistências.
- **Desempate (DE)**: Contém as 5 perguntas utilizadas exclusivamente quando há empate entre tipos.

## 3. Gerenciando Perguntas
### Adicionar Nova Pergunta
1. Clique em **Nova Pergunta**.
2. Insira o **Enunciado** da pergunta.
3. Preencha o texto para **todos os tipos** (9 no Básico, 18 no Desempate).
4. Clique em **Salvar Pergunta**.

### Editar Pergunta Existente
1. Localize a pergunta na lista e clique no ícone de **Lápis (Editar)**.
2. Altere o texto do enunciado ou das opções. No caso do desempate, o sistema exibe o código (ex: `T1DE...01` e `T1DE...02`) para identificar qual das duas frases do Tipo 1 você está editando.
3. Clique em **Salvar Pergunta**.

## 4. Importância dos Códigos
Os códigos das opções (T1, T2...) não devem ser alterados manualmente, pois o motor de desempate utiliza o sufixo final (`01` ou `02`) para realizar o sorteio aleatório das frases. Se você alterar a estrutura do código, o filtro dinâmico pode falhar.
