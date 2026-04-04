---
trigger: always_on
---

✅ PROJECT RULES — ROTA FÁCIL

1. CONTEXTO E OBJETIVO
Rota Fácil é um SaaS de roteirização e operação de campo para agendamentos, clientes, técnicos, equipes, veículos, serviços e histórico de rotas.
Stack oficial:
- Front: React + Wouter + Vite + TailwindCSS + shadcn/ui + React Query + React Hook Form + Zod
- Back: Node.js + Express + JWT + Zod
- Banco: PostgreSQL + Drizzle ORM
- Mapas/rotas: Leaflet/React-Leaflet + OSRM + Python OR-Tools
Versão atual: ROTAFACIL-12 (sem tela de roteirização interativa; foco em histórico de rotas).
❌ Não trocar frameworks, router, ORM, build tool ou libs centrais sem pedido explícito.

2. REGRA MESTRA DE EXECUÇÃO
✅ Responder em português do Brasil.
✅ Alterar somente o que foi solicitado.
✅ Preferir mudanças cirúrgicas; não refatorar grandes áreas sem necessidade.
✅ Antes de mexer, entender o fluxo completo e revisar arquivos relacionados.
✅ Reutilizar componentes, hooks, helpers e padrões existentes antes de criar algo novo.
✅ Explicar de forma simples, objetiva e útil.
✅ Sempre listar arquivos tocados, riscos e como validar.

3. ESTRUTURA DO PROJETO
Front (client/src):
- pages/: páginas
- components/: componentes reutilizáveis
- components/ui/: base shadcn/ui
- components/forms/: formulários por entidade
- components/maps/: mapas e rotas
- hooks/: hooks customizados
- lib/: auth, queryClient, utils, CEP, downloads
Back (server):
- index.ts: entrada
- routes.ts: API central, registerRoutes(app)
- storage.ts: IStorage + DatabaseStorage
- db.ts: Drizzle
- vite.ts: integração Vite
- solve_tsp.py: solver TSP
- osrm_url.txt: URL do OSRM
Shared:
- shared/schema.ts: schema, relações, inserts, types
- shared/plan-limits.ts: limites por plano
Aliases:
- / -> client/src
- shared/ -> shared
- assets/ -> attached_assets
✅ Respeitar a estrutura atual.
✅ Novos componentes/UI/forms/hooks/utilitários devem seguir essa organização.

4. ARQUIVOS SENSÍVEIS
⚠️ Exigem extremo cuidado:
- server/routes.ts
- server/storage.ts
- shared/schema.ts
- client/src/lib/auth.tsx
- vite.config.ts
- server/solve_tsp.py
- server/osrm_url.txt
❌ Não alterar sem analisar impacto primeiro.
❌ Nunca commitar .env.

5. BACK-END
✅ Rotas em server/routes.ts com prefixo /api e padrão REST quando fizer sentido.
✅ Rotas privadas usam authenticateToken.
✅ Payload, query e params devem ser validados com Zod.
✅ Manter contratos de API consistentes com front + types.
✅ Novas operações de dados: adicionar em IStorage e implementar em DatabaseStorage.
✅ Preferir storage.ts em vez de queries soltas em routes.ts.
✅ Manter logs e respostas de erro em JSON ({ message } ou { error }).
❌ Não mexer em auth, segurança ou middlewares sem pedido explícito.
❌ Não adicionar dependências de servidor sem necessidade clara.

6. FRONT-END
✅ Navegação com Wouter; não adicionar outro router.
✅ Estilo com Tailwind + shadcn/ui; ícones com Lucide.
✅ Dados/cache com React Query.
✅ Formulários com React Hook Form + Zod.
✅ Reaproveitar schemas/types compartilhados.
✅ Auth com useAuth() e getAuthHeaders() de client/src/lib/auth.tsx.
✅ Toasts com useToast().
✅ Mapas com a base existente em components/maps.
❌ Não introduzir nova lib de estilização, estado global ou notificação sem aprovação.

7. BANCO, AUTH E MULTIEMPRESA
❌ Nunca alterar shared/schema.ts sem orientar aplicação de pnpm run db:push.
❌ Não renomear tabela/coluna em uso sem análise.
✅ Seguir padrões do Drizzle, createInsertSchema() e types exportados.
✅ Tabelas/colunas em snake_case; types em PascalCase; enums/status em lower_snake_case.
✅ Foreign keys com .references(() => tabela.id).
✅ Isolamento multiempresa deve seguir company_id como regra principal.
✅ companyId deve vir do JWT/middleware oficial.
❌ Não usar userId como isolamento principal quando o padrão correto for company_id.
❌ Não criar bypass de autenticação fora do padrão; DEV_MODE nunca pode vazar para produção.
✅ Ao tocar schema/storage/routes, revisar impacto em permissões, filtros e vazamento entre empresas.

8. REGRAS FUNCIONAIS DO ROTA FÁCIL
✅ Sempre considerar herança de técnicos quando uma entidade usar equipe.
✅ Ao selecionar equipe em fluxos aplicáveis, técnicos da equipe devem ficar vinculados/herdados conforme o padrão existente.
✅ Usar sempre componentes mais novos quando já houver substituto oficial (ex.: TempTeamForm).
✅ Respeitar o modelo atualizado de CSV em importação/exportação.
✅ Filtros, cards e seletores devem funcionar para técnico e equipe quando o fluxo exigir ambos.
✅ Manter formulários limpos ao criar novo registro.
✅ Logs em submits, erros e fluxos críticos.
✅ Não deixar estado “vazando” entre criação, edição e troca de tela.

9. QUALIDADE DE CÓDIGO
✅ Evitar any; usar types do shared/schema sempre que possível.
✅ Funções pequenas e com responsabilidade clara.
✅ Nomear componentes em PascalCase, variáveis/funções em camelCase, constantes em UPPER_SNAKE_CASE.
✅ Rotas em kebab-case.
✅ Usar try/catch em I/O assíncrono.
✅ Mensagens de erro claras, sem expor stack sensível.
✅ Comentar apenas o que não for óbvio.

10. INFRA E SEGURANÇA
❌ Não alterar infra, build, banco, OSRM, Vite ou Python sem instrução explícita.
Variáveis críticas:
- DATABASE_URL
- JWT_SECRET
- DEV_MODE (false em produção)
- PYTHON_BIN
Checklist antes de finalizar:
- auth protegendo rotas privadas?
- inputs validados com Zod?
- schema sincronizado?
- sem segredos hardcoded?
- build/check sem erro?
- risco de quebrar multiempresa?

17. ARQUITETURA DE DEPLOY

⚠️ Em caso de dúvidas sobre containers, Nginx, backend, proxy ou fluxo de requisição em produção, consultar o arquivo:
"Arquitetura de Deploy — RotaFácil (Produção).md"

❌ Não assumir comportamento de monolito (frontend + backend juntos)
✅ Considerar sempre arquitetura com containers separados (frontend, backend, proxy)

11. COMANDOS ÚTEIS
- pnpm dev
- pnpm dev:api
- pnpm dev:web
- pnpm build
- pnpm start
- pnpm db:push
- pnpm check

12. ESTILO DAS RESPOSTAS
✅ Começar com resumo curto.
✅ Explicar decisões não triviais.
✅ Mostrar antes/depois quando útil.
✅ Dizer exatamente onde mexer.
✅ Sugerir testes de UI, API e banco.
✅ Quando houver suposição, sinalizar: “Inferência:”, “Assumindo que...”, “Provavelmente...”.
✅ Pode usar: ✅ ❌ 🔧 ⚠️ 📝

13. PRIORIDADES
1. Segurança
2. Integridade dos dados
3. Isolamento multiempresa
4. Não quebrar o que já funciona
5. Consistência do código
6. Performance
7. Nova feature

14. ROTEIRIZAÇÃO
⚠️ osrm_url.txt é crítico; não alterar automaticamente.
⚠️ Não remover delays/rate limit de geocodificação sem análise.
⚠️ Não alterar contrato de entrada/saída do solve_tsp.py sem ajustar quem chama.
⚠️ Se faltar Python/OR-Tools, apenas alertar; não inventar workaround arriscado.
⚠️ Redirects antigos de rotas só podem ser removidos após revisar impacto nos fluxos existentes.

15. MODO AUTOMÁTICO POR TIPO DE TAREFA
- Bug, inconsistência, regressão, vazamento, auth ou multiempresa -> modo INVESTIGAÇÃO: achar causa raiz antes de corrigir.
- Nova feature ou ajuste localizado -> modo IMPLEMENTAÇÃO CIRÚRGICA: mexer só no necessário.
- Cadastro, edição, listagem, CSV, vínculo entre cliente/técnico/equipe/veículo/agendamento -> modo REVISÃO CRUD: revisar front + back + schema + storage quando necessário.
- Schema, migration, company_id, constraints, índices, duplicidade -> modo IMPACTO DE BANCO: mapear tabelas afetadas, risco de dados legados e validação.
- Pedido de prompt para outro agente -> modo PROMPT BUILDER: gerar prompt claro, específico, em PT-BR e com restrição de escopo.

16. USO AUTOMÁTICO DE SKILLS
Estas rules são sempre a base principal. As skills apenas complementam a execução conforme o tipo da tarefa.

- BUG / INCONSISTÊNCIA / REGRESSÃO / VAZAMENTO / AUTH / MULTIEMPRESA
Usar skill de investigação: encontrar causa raiz antes de corrigir, mapear fluxo completo, apontar evidências, propor correção mínima e segura.

- NOVA FEATURE / AJUSTE LOCAL / MELHORIA VISUAL
Usar skill de implementação cirúrgica: alterar só o necessário, reaproveitar padrões existentes, evitar refatoração ampla, listar arquivos afetados e forma de validar.

- CADASTRO / EDIÇÃO / LISTAGEM / FILTROS / CSV / VÍNCULOS ENTRE ENTIDADES
Usar skill de revisão CRUD: revisar front, back, schema e storage quando necessário; validar campos obrigatórios, mensagens de erro, herança de equipe, filtros, autocomplete, logs e impacto multiempresa.

- SCHEMA / MIGRATION / COMPANY_ID / CONSTRAINTS / ÍNDICES / DUPLICIDADE
Usar skill de impacto de banco: mapear tabelas afetadas, risco de dados legados, impacto em schema/storage/routes/front, necessidade de db:push e validações pós-ajuste.

- PEDIDO DE PROMPT PARA OUTRO AGENTE
Usar skill de prompt builder: gerar prompt claro, específico, em PT-BR, com contexto, objetivo, escopo, restrições, arquivos envolvidos, cuidados com arquivos sensíveis e exigência de alterar somente o necessário.

Se a tarefa envolver mais de uma natureza, combinar as skills de forma lógica, sempre priorizando:
1. Segurança
2. Integridade dos dados
3. Isolamento multiempresa
4. Rules do projeto
5. Skill especializada