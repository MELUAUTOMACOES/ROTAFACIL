---
name: db-impact-review
description: Use quando a tarefa envolver shared/schema.ts, migrations, novas colunas, índices, constraints, relações, company_id, isolamento multiempresa, duplicidade, backfill de dados, chaves estrangeiras, mudanças em tabelas existentes ou necessidade de db:push. Esta skill deve mapear impacto técnico e risco de dados antes da alteração.
---

# Skill: db-impact-review

## Objetivo
Evitar quebra de banco, inconsistência de dados e vazamento entre empresas.

## Processo obrigatório
1. Identificar tabelas e colunas afetadas.
2. Identificar impacto em:
   - shared/schema.ts
   - server/storage.ts
   - server/routes.ts
   - front que consome esses dados
3. Verificar impacto em dados legados.
4. Verificar impacto em multiempresa.
5. Alertar quando a alteração exigir `pnpm run db:push`.
6. Sugerir validação após a mudança.

## Regras
- Não sugerir alteração destrutiva sem alertar claramente.
- Não tratar `userId` como isolamento principal quando o correto for `company_id`.
- Se houver unicidade, verificar se ela precisa ser global ou por empresa.
- Se houver backfill, explicar risco e ordem correta.
- Ter extremo cuidado com relações e foreign keys.

## Formato da resposta
1. Mudança proposta
2. Tabelas/colunas afetadas
3. Riscos
4. Impacto em multiempresa
5. Necessidade de db:push
6. Como validar no banco e na aplicação