---
name: prompt-builder
description: Use quando o usuário pedir um prompt para Cascade, Windsurf, Antigravity ou outro agente de código. Esta skill deve gerar um prompt pronto para colar, em português do Brasil, específico, seguro, operacional e adaptado ao projeto atual, sempre com escopo bem definido e foco em alteração cirúrgica.
---

# Skill: prompt-builder

## Objetivo
Gerar prompts realmente úteis para agentes de código, prontos para colar, sem texto genérico, sem excesso de explicação e com foco em execução segura.

## Função desta skill
Esta skill deve transformar o pedido do usuário em um prompt operacional, claro e específico, para outro agente executar a tarefa com o menor risco possível.

## Processo obrigatório
1. Entender exatamente o que o usuário quer alterar.
2. Identificar o objetivo real da tarefa.
3. Definir escopo exato.
4. Incluir contexto suficiente do projeto.
5. Restringir alterações fora do escopo.
6. Exigir análise prévia antes de editar qualquer arquivo.
7. Exigir reaproveitamento da lógica já existente antes de criar algo novo.
8. Pedir validação final objetiva.

## Regras principais
- Sempre escrever em português do Brasil.
- O prompt deve ser direto, específico e operacional.
- O prompt deve ser pronto para colar.
- Evitar floreio, introdução desnecessária e texto bonito demais.
- Evitar prompt genérico como "faça o melhor possível".
- Sempre que possível, incluir:
  - tarefa
  - contexto
  - escopo
  - restrições
  - arquivos prováveis
  - ordem de execução
  - critérios de aceite
  - validação final

## Regras extras para prompts de código
- Quando o pedido for ajuste localizado, não usar termos amplos como:
  - refatorar
  - reestruturar
  - modernizar
  - otimizar arquitetura
- Preferir termos como:
  - ajuste localizado
  - alteração cirúrgica
  - mudar apenas o necessário
  - reutilizar lógica existente
- Sempre orientar o agente a localizar primeiro:
  - componente real
  - função real
  - endpoint real
  - mutation real
  - schema real
  antes de editar.
- Sempre pedir para reaproveitar a lógica existente antes de criar fluxo paralelo.
- Quando houver status, enum, campo, coluna ou valor de banco, orientar o agente a verificar o nome real no projeto antes de assumir qualquer valor.
- Quando houver comportamento já existente em outro ponto da tela, orientar explicitamente o agente a espelhar ou reutilizar esse comportamento.
- Quando envolver UI + regra de negócio, orientar o agente a:
  1. localizar a interface atual
  2. localizar a ação real executada
  3. alterar a interface
  4. alterar o comportamento com o menor impacto possível
  5. validar o fluxo completo

## Estrutura padrão do prompt gerado
Sempre que possível, gerar o prompt nesta ordem:

1. TAREFA
- o que precisa ser feito

2. CONTEXTO
- onde isso acontece
- como funciona hoje
- regra de negócio relevante

3. ALTERAÇÕES OBRIGATÓRIAS
- lista objetiva do que deve mudar

4. RESTRIÇÕES
- o que não pode ser alterado
- o que deve ser preservado
- cuidados com arquivos sensíveis
- cuidado com multiempresa, auth, schema e storage quando aplicável

5. ORDEM DE EXECUÇÃO
- localizar componente/arquivo real
- entender lógica atual
- alterar somente o necessário
- validar o fluxo final

6. ARQUIVOS PROVÁVEIS
- listar arquivos mais prováveis sem afirmar com certeza quando não souber

7. CRITÉRIOS DE ACEITE
- descrever exatamente como saber se deu certo

8. SAÍDA ESPERADA DO AGENTE
- arquivos modificados
- resumo do que foi alterado
- riscos
- como testar

## Regras específicas para o RotaFácil
Quando o prompt for para o RotaFácil, respeitar sempre:
- company_id como isolamento principal
- mudanças cirúrgicas
- herança de equipe quando aplicável
- cuidado máximo com:
  - shared/schema.ts
  - server/routes.ts
  - server/storage.ts
  - client/src/lib/auth.tsx
- não criar bypass de autenticação
- não tratar userId como isolamento principal se o fluxo correto for company_id
- não quebrar contratos existentes entre front, back e banco
- reutilizar componentes, hooks, helpers e padrões atuais do projeto
- manter formulários, filtros, cards e vínculos consistentes entre técnico e equipe quando o fluxo exigir

## Regras de qualidade do prompt
- O prompt deve ser claro mesmo para tarefa complexa.
- O prompt deve reduzir chance de interpretação errada.
- O prompt deve guiar o agente sem deixar espaço para ele sair mexendo em áreas não pedidas.
- O prompt deve forçar o agente a pensar antes de editar.
- O prompt deve ser específico o suficiente para execução e flexível apenas no que depender do código real encontrado.

## Saída esperada
Entregar apenas o prompt final, já pronto para colar, sem explicações longas antes, salvo se o usuário pedir análise junto.

- Quando útil, iniciar o prompt com uma persona curta, técnica e pragmática.
- A persona deve reforçar análise de impacto, manutenção segura e alteração cirúrgica.
- Evitar personas longas, genéricas ou exageradas.
- A persona nunca deve substituir contexto, escopo, restrições e critérios de aceite.