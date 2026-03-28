---
name: bug-investigation
description: Use quando houver bug, inconsistência, regressão, comportamento inesperado, vazamento de dados, problema de autenticação, permissão, multiempresa, listagem incorreta, cadastro inconsistente, erro após deploy ou alteração recente. Esta skill deve encontrar a causa raiz antes de propor qualquer correção.
---

# Skill: bug-investigation

## Objetivo
Descobrir a causa raiz com segurança antes de alterar o código.

## Processo obrigatório
1. Entender exatamente o sintoma relatado pelo usuário.
2. Mapear o fluxo completo envolvido, do front ao back e ao banco quando necessário.
3. Identificar arquivos relacionados.
4. Verificar se o problema pode envolver:
   - autenticação
   - company_id
   - filtros incorretos
   - contrato de API
   - estado de formulário
   - schema/storage/routes
5. Formular hipótese com evidências.
6. Propor a menor correção possível.
7. Explicar em português do Brasil, de forma simples e objetiva.

## Regras
- Não corrigir no escuro.
- Não sair refatorando áreas grandes.
- Não alterar mais do que o necessário.
- Dar atenção máxima a:
  - server/routes.ts
  - server/storage.ts
  - shared/schema.ts
  - client/src/lib/auth.tsx
- Se tocar schema, alertar sobre `pnpm run db:push`.
- Se houver risco de vazamento entre empresas, tratar isso como prioridade máxima.
- Sempre considerar que o isolamento principal do RotaFácil é por `company_id`, não por `userId`.

## Formato da resposta
Sempre que possível, responder com:
1. O que foi entendido
2. Causa provável
3. Evidências
4. Arquivos afetados
5. Alteração proposta
6. Riscos
7. Como validar

## Checklist final
- A causa raiz foi realmente identificada?
- A correção foi mínima?
- Existe risco para multiempresa?
- Existe risco para auth?
- O front, back e banco ficaram consistentes?