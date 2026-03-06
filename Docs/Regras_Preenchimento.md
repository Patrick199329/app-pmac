# Regras de Preenchimento e Navegação

O fluxo de preenchimento segue diretrizes estritas para garantir a validade científica do teste PMAC.

## 1. Prazo de Conclusão (Regra B)
- O usuário tem um prazo de **10 dias corridos** para concluir o questionário a partir do momento em que inicia o primeiro acesso (mesmo que apenas veja o vídeo).
- Após 10 dias, o botão de início é bloqueado com um aviso para contatar o suporte.

## 2. Continuidade (Regra C)
- O questionário salva o progresso a cada clique (**Auto-save**).
- Se o usuário sair da plataforma, ele pode retornar e clicar em "Continuar", sendo levado exatamente para a pergunta onde parou.
- Caso o questionário sofra uma atualização estrutural (mudança de perguntas), o sistema detecta a incompatibilidade e força o "Reset" para que o usuário não tenha erros de dados.

## 3. Visualização Obrigatória
- O sistema rastreia se o vídeo de instrução foi assistido até o final através da tabela `video_views`. 
- O botão "Próximo" ou "Ir para o Teste" só é habilitado após a conclusão do vídeo correspondente.

## 4. Ordem das Perguntas
- As 10 perguntas são carregadas em ordem definida pelo `order_index`.
- A exibição interna utiliza IDs únicos para evitar que o usuário manipule as respostas via URL.
