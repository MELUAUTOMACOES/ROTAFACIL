---
trigger: always_on
---

✅ PROJECT RULES – ROTA FÁCIL
1. Contexto do Projeto

O Rota Fácil é um sistema completo de roteirização e logística para equipes em campo, desenvolvido para gerenciar agendamentos de serviços, técnicos/equipes, veículos e clientes.
A aplicação é fullstack TypeScript, usando:

Front-end: React + Wouter + Vite + TailwindCSS + shadcn/ui

Back-end: Express (Node.js) + JWT + Zod

Banco: PostgreSQL + Drizzle ORM

Roteirização: OSRM (servidor externo) + Python OR-Tools (TSP)

Versão atual: ROTAFACIL-12 (sem tela de roteirização interativa, apenas histórico de rotas).

2. Stack Oficial do Projeto

Front-end

Framework: React 18.3.1

Router: Wouter 3.3.5 (leve, client-side)

Build tool: Vite 5.4.14

Estilização:

TailwindCSS 3.4.17

shadcn/ui (estilo “new-york”) em client/src/components/ui/

CSS Variables (HSL) + sistema de tema com dark mode por class

State/data:

@tanstack/react-query 5.60.5

Formulários/validação:

React Hook Form + Zod + @hookform/resolvers

Mapas:

Leaflet + React-Leaflet

Calendário:

react-big-calendar + react-day-picker

Drag & Drop:

dnd-kit (principal) + react-dnd em pontos específicos

Ícones:

Lucide React

Back-end

Framework/Servidor:

Express 4.21.2 + HTTP server nativo

Rotas:

Centralizadas em server/routes.ts, função registerRoutes(app)

Prefixo obrigatório: /api/...

Autenticação:

JWT (jsonwebtoken) com middleware authenticateToken

Senhas com bcryptjs

Validações:

Zod schemas compartilhados em shared/schema

Banco de Dados e ORM

ORM: Drizzle ORM 0.39.1 + drizzle-kit 0.30.6

Banco: PostgreSQL (pg)

Schema:

Centralizado em shared/schema.ts (todas as tabelas e types)

Migrations:

Pasta migrations/

Aplicadas via pnpm run db:push

Integrações Externas

OSRM: servidor de roteamento, URL em server/osrm_url.txt

Nominatim (OpenStreetMap): geocodificação de endereços

Python OR-Tools: solver TSP em server/solve_tsp.py

REGRA CRÍTICA DE STACK

❌ Não alterar frameworks principais, ORM, build tools ou bibliotecas centrais (React, Wouter, Vite, Drizzle, React Query, Tailwind, shadcn/ui, etc.) sem pedido explícito do usuário.

3. Padrões de Organização de Código

Front-end (client/src/)

pages/ – Páginas principais (Dashboard, Appointments, Clients, Technicians, Vehicles, Services, BusinessRules, RoutesHistory, etc.)

components/ – Componentes reutilizáveis (Layout, Sidebar, TopBar, etc.)

components/ui/ – Componentes base do shadcn/ui

components/forms/ – Formulários específicos por entidade

components/maps/ – Componentes relacionados a mapas e visualização de rotas

hooks/ – Custom hooks (use-toast, useCalendarCleanup, useSafeNavigation, etc.)

lib/ – Utilitários (auth, queryClient, cep, download, utils)

Back-end (server/)

index.ts – Entrada do servidor

routes.ts – Todas as rotas da API (arquivo grande e central)

storage.ts – Camada de abstração de dados (IStorage + DatabaseStorage)

db.ts – Configuração do Drizzle ORM

vite.ts – Integração Vite + arquivos estáticos

solve_tsp.py – Script Python para TSP (OR-Tools)

osrm_url.txt – URL do servidor OSRM

Compartilhado (shared/)

schema.ts – Schema único do banco (tabelas, relations, inserts, types)

plan-limits.ts – Configuração de limites por plano (basic, professional, enterprise, custom)

Aliases do Vite

/ → client/src

shared/ → shared

assets/ → attached_assets

REGRAS

✅ Respeitar a estrutura atual.
✅ Novos artefatos seguem:

Novos componentes de UI → client/src/components/ui/

Novos formulários → client/src/components/forms/

Novas páginas → client/src/pages/

Novos hooks → client/src/hooks/

Novos utilitários compartilhados → shared/ (quando também usados no back)

✅ Reutilizar componentes, hooks e helpers existentes antes de criar algo do zero.

4. Regras para Alterações no Back-end

REGRAS CRÍTICAS

❌ Não modificar server/routes.ts sem extremo cuidado.

É o coração da API; qualquer erro quebra múltiplas features.

Sempre testar os endpoints modificados.

❌ Não alterar middlewares de autenticação e segurança sem pedido explícito.

authenticateToken protege rotas privadas.

Mudanças mal feitas podem deslogar usuários ou abrir brechas.

❌ Não adicionar novas dependências de servidor sem necessidade clara.

✅ Ao adicionar novas rotas:

Registrar em server/routes.ts dentro de registerRoutes(app).

Usar padrão RESTful: GET /api/recurso, POST /api/recurso, etc.

Usar prefixo /api.

Aplicar authenticateToken em rotas privadas.

Validar payload com schemas Zod de shared/schema.

✅ Não alterar contratos de API (request/response) sem atualizar:

O front (React Query / hooks)

Types correspondentes em TypeScript

✅ Camada de dados (storage.ts):

Novas operações → adicionar em IStorage + implementar em DatabaseStorage.

Evitar queries diretas em routes.ts; usar a abstração de storage.

✅ Logging & error handling:

Manter padrão de logs (marcadores, emojis, etc.).

Retornar erros em JSON: { message: string } ou { error: string }.

5. Regras para Alterações no Front-end

REGRAS CRÍTICAS

✅ Estilização:

Usar TailwindCSS para estilos.

Usar componentes de client/src/components/ui/ (shadcn/ui).

Ícones via Lucide React.

Não introduzir libs de estilização novas (styled-components, emotion, etc.).

✅ Navegação:

Usar Wouter (useLocation, <Route>, <Switch>, etc.).

Não adicionar react-router ou outro router sem aprovação.

✅ Estado e dados:

Usar @tanstack/react-query para cache/sync da API.

Usar Context API apenas para estado global (ex.: autenticação).

Evitar Redux ou libs similares.

✅ Formulários:

Usar React Hook Form + Zod.

Reaproveitar schemas de shared/schema (ex.: insertClientSchema, extendedInsertAppointmentSchema).

Seguir padrão de components/forms/.

✅ Autenticação:

Usar useAuth() e helpers de client/src/lib/auth.tsx.

Usar getAuthHeaders() para adicionar token às requisições.

Não reimplementar lógica de login/logout.

✅ Toasts/feedback:

Usar useToast() de hooks/use-toast.ts.

Não incluir novas libs de notificação.

✅ Mapas e rotas:

Usar componentes em components/maps/ como base.

Não trocar Leaflet/React-Leaflet sem decisão explícita.

6. Regras para Banco de Dados e Migrations

REGRAS CRÍTICAS

❌ NUNCA modificar shared/schema.ts sem gerar/aplicar migrations.
❌ Não renomear tabelas ou colunas em uso sem análise cuidadosa.

✅ Ao adicionar novas tabelas/campos:

Definir no shared/schema.ts usando padrões do Drizzle.

Criar insert schema com createInsertSchema(), quando aplicável.

Exportar types: type Nome = typeof tabela.$inferSelect.

Rodar pnpm run db:push (o AI apenas orienta, não executa).

✅ Convenções:

Tabelas: plural, snake_case (ex.: team_members, route_stops).

Colunas: snake_case (ex.: user_id, scheduled_date, is_active).

Types TS: PascalCase (ex.: Appointment, InsertClient).

Status/enums: lower_snake_case (ex.: in_progress).

✅ Foreign keys: usar .references(() => tabela.id).

✅ Multi-tenant: incluir userId quando necessário, seguindo padrão existente.

7. Boas Práticas de Implementação

✅ Código tipado:

Evitar any; usar tipos de shared/schema sempre que possível.

Para estruturas complexas, criar type/interface.

✅ Funções pequenas:

Uma função = uma responsabilidade.

Funções muito grandes → extrair helpers.

✅ Reutilização:

Types: User, Client, Appointment, Technician, Team, Vehicle, etc.

Schemas Zod: insertClientSchema, extendedInsertAppointmentSchema, etc.

Helpers: apiRequest(), getAuthHeaders(), geocodeWithNominatim(), etc.

✅ Naming:

Componentes React: PascalCase (ex.: AppointmentForm).

Variáveis/funções: camelCase.

Constantes: UPPER_SNAKE_CASE.

Rotas de API: kebab-case (ex.: /api/business-rules).

✅ Erros:

Usar try/catch em funções async de I/O.

Mensagens claras (sem vazar stacktrace sensível no response).

✅ Validação de entrada:

Validar inputs de usuário com Zod (body, query params, path params).

8. Limites de Alteração / Escopo

❌ Não reestruturar grandes partes do projeto em uma única alteração.
✅ Preferir mudanças localizadas (“surgery, not demolition”).

❌ Não alterar configurações de infra sem instrução explícita:

server/osrm_url.txt (URL do OSRM)

Configuração de Vite/build

Configuração do Drizzle / banco

Scripts Python (especialmente solve_tsp.py)

❌ Arquivos sensíveis (exigem extremo cuidado):

server/routes.ts

shared/schema.ts

server/storage.ts

client/src/lib/auth.tsx

vite.config.ts

.env (NUNCA commitar)

✅ Variáveis de ambiente críticas:

DATABASE_URL – conexão PostgreSQL

JWT_SECRET – chave JWT (obrigatória em produção)

DEV_MODE – DEVE SER false em produção (bypass de auth)

PYTHON_BIN – caminho do Python (opcional, para OR-Tools)

9. Estilo das Respostas do AI no Projeto

✅ Ser objetivo, mas explicar o que está sendo feito:

Começar com um pequeno resumo.

Explicar decisões não triviais.

Avisar sobre impactos e riscos.

✅ Sempre listar arquivos tocados:

Arquivos modificados:

server/routes.ts – descrição breve

client/src/pages/AppointmentsPage.tsx – descrição breve

✅ Sugerir testes básicos após alterações:

Endpoints: indicar exemplo de requisição (curl/JSON).

UI: dizer em quais telas validar.

Banco: sugerir queries de verificação.

✅ Quando for inferência:

Usar frases como “Inferência:...”, “Assumindo que...”, “Provavelmente...”.

✅ Comunicação:

Usar emojis: ✅ (ok), ❌ (não fazer), 🔧 (ação), 📝 (nota), ⚠️ (atenção)

Usar listas/bullets para clareza.

Usar blocos de código com syntax highlighting.

✅ Ao propor código:

Seguir o estilo do projeto (olhar arquivos similares).

Incluir imports e tipos necessários.

Comentar o que não for óbvio.

10. Checklist de Segurança e Boas Práticas

Antes de um commit/deploy, verificar:

 DEV_MODE está false ou removido em produção?

 JWT_SECRET está definido, aleatório e com 32+ caracteres?

 .env está no .gitignore?

 Não há senhas/segredos hardcoded?

 Todas as rotas privadas passam por authenticateToken?

 Inputs de usuário estão validados com Zod?

 Schema do banco está sincronizado (pnpm run db:push)?

 pnpm run build roda sem erros?

11. Comandos Úteis
# Desenvolvimento
pnpm dev       # API + Web em paralelo
pnpm dev:api   # Apenas API (porta 5000)
pnpm dev:web   # Apenas Vite dev server

# Build e produção
pnpm build     # Build completo (client + server)
pnpm start     # Rodar em produção (NODE_ENV=production)

# Banco de dados
pnpm db:push   # Aplicar mudanças de schema (migrations)

# Type-check
pnpm check     # Checagem TypeScript sem build

12. Hierarquia de Prioridades em Caso de Conflito

🔐 Segurança

🧱 Integridade de dados

⚙️ Funcionalidades existentes (não quebrar o que já funciona)

🚀 Performance (evitar gargalos desnecessários)

🎯 Consistência de código (padrões/convenções)

👩‍💻 Developer Experience

🆕 Novas features (só depois de 1–6)

13. Observações Específicas de Roteirização

server/osrm_url.txt:

⚠️ É crítico para roteirização; não alterar automaticamente.

Não remover nem substituir por outra fonte sem instrução explícita.

Nominatim:

✔️ Respeitar o rate limit atual (sleep entre chamadas).

❌ Não remover o atraso/delay entre requests.

Python OR-Tools (solve_tsp.py):

Não alterar o contrato de entrada/saída do script sem ajustar o Node que o chama.

Se o ambiente não tiver Python/OR-Tools, apenas alertar o usuário (não “inventar” workarounds).

Redirects de rotas antigas:

/routes, /roteirizacao, /routes/builder, /routes/optimize → redirecionam para /appointments.

Não remover esses redirects sem revisar todos os links e fluxos.