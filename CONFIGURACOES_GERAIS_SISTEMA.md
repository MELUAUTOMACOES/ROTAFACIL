# 📚 Configurações Gerais do Sistema Rota Fácil

Este arquivo é um **índice rápido** das principais configurações do projeto. Para detalhes completos, consulte os arquivos específicos indicados em cada seção.

---

## 🗄️ Banco de Dados & Variáveis de Ambiente Básicas

Resumo do que é essencial para o sistema subir corretamente em qualquer ambiente.

- Variáveis obrigatórias:
  - `DATABASE_URL` – conexão PostgreSQL
  - `JWT_SECRET` – chave secreta para assinar tokens JWT (mínimo 32 caracteres, aleatória)
- Onde configurar:
  - Arquivo `.env` na raiz do projeto
  - `drizzle.config.ts` usa `DATABASE_URL` para migrations
  - `server/db.ts` valida `DATABASE_URL`
  - `server/routes.ts` valida `JWT_SECRET`
- Comandos importantes:
  - `pnpm db:push` – aplicar migrations
  - `pnpm dev` – subir API + web

🔎 **Detalhamento completo:** ver `CONFIGURACAO_BANCO.md`.

---

## 📧 Configuração de Email (Resend)

O sistema está preparado para envio de emails (verificação de usuário, convites, etc.).

- Variáveis de ambiente principais:
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `EMAIL_FROM_INVITE` (convites multiempresa)
  - `APP_URL` – base para montar links de verificação/convite
- Implementação principal:
  - Serviço de email em `server/email.ts`
  - Integração com criação de usuários e reenvio de verificação
- Pontos de atenção:
  - API key **sempre** no `.env`, nunca no código
  - Em produção, usar domínio próprio e configurar SPF/DKIM/DMARC

🔎 **Detalhamento completo e templates:** ver `CONFIGURACAO_EMAIL.md`.

---

## 🧩 Multiempresa (Multi-tenant)

O Rota Fácil suporta múltiplas empresas com dados isolados.

- Tabelas principais:
  - `companies` – empresas
  - `memberships` – vínculo usuário ↔ empresa (com papel: ADMIN, ADMINISTRATIVO, OPERADOR)
  - `invitations` – convites para usuários entrarem em uma empresa
- Isolamento de dados:
  - Todas as tabelas de negócio têm `companyId`
  - Todas as queries filtram por empresa / usuário atual
- JWT inclui:
  - `userId`, `email`, `companyId`, `companyRole`
- Variáveis de ambiente relevantes:
  - `EMAIL_FROM_INVITE`
  - `APP_URL`

🔎 **Arquitetura completa, endpoints e fluxos de convite:** ver `MULTIEMPRESA_README.md`.

---

## 🔐 Gestão de Usuários, LGPD e Segurança

Sistema completo de gestão de usuários com fluxo de verificação de email, primeira senha e controle de acesso.

- Funcionalidades principais:
  - Cadastro de usuários por admin
  - Verificação de email obrigatória
  - Definição de primeira senha pelo próprio usuário
  - Perfis `admin` / `user` + papéis por empresa
  - Status ativo/inativo, último acesso, controle de quem criou quem
- Tabela `users` contém campos de LGPD:
  - `email_verified`, `email_verification_token`, `email_verification_expiry`
  - `require_password_change`, `is_active`, `last_login_at`, `created_by`
- Rotas importantes:
  - `/api/users` (CRUD usuários – admin)
  - `/api/auth/verify-email`, `/api/auth/set-first-password`
  - `/api/auth/change-password`, `/api/auth/login`
- Variáveis de ambiente de segurança:
  - `JWT_SECRET`
  - `APP_URL`
  - `DEV_MODE` (deve ser `false` em produção)

🔎 **Detalhamento completo e fluxos passo a passo:** ver `GESTAO_USUARIOS_README.md`.

---

## 📆 Disponibilidade, Validação Técnico/Equipe e Agendamentos

Regras de disponibilidade diária e validação de conflitos entre técnicos e equipes.

- Tabela `daily_availability` (cache de disponibilidade por dia):
  - `total_minutes`, `used_minutes`, `available_minutes`, `appointment_count`, `status`
- Funções principais (backend):
  - `updateDailyAvailability` – recalcula disponibilidade por dia/responsável
  - `validateTechnicianTeamConflict` – impede conflitos técnico ↔ equipe
  - `updateAvailabilityForAppointment` – atualiza tudo ao criar/editar/apagar agendamentos
- Endpoints relevantes:
  - `/api/appointments` (CRUD, importação, etc.)
  - `/api/daily-availability` – consulta de disponibilidade agregada
- Frontend:
  - `AvailabilityCalendar` calcula a disponibilidade em tempo real para uso na UI.

🔎 **Detalhamento técnico, SQL e exemplos:** ver `DISPONIBILIDADE_E_VALIDACAO.md`.

---

## 🔎 Funcionalidade "Encontre uma Data" (Visão Resumida)

Funcionalidade para sugerir melhores datas de agendamento considerando disponibilidade e distância.

- Backend:
  - Endpoint `POST /api/scheduling/find-available-dates`
  - Usa:
    - `daily_availability`
    - geocodificação (Nominatim)
    - regras de negócio (dias/horários, serviços compatíveis)
    - limites de distância
- Frontend:
  - Página `/find-date` busca datas disponíveis
  - Redireciona para `/appointments` com campos pré-preenchidos

🔎 **Detalhes completos de implementação:** ver `IMPLEMENTACAO_ACHE_UMA_DATA.md`.

---

## 👤 Configuração Rápida de Admin Inicial

Para liberar o menu "Gestão de Usuários" e configurar o primeiro administrador:

- Ajustar diretamente no banco (via Drizzle Studio ou SQL):
  - `role = 'admin'`
  - `email_verified = true`
  - `require_password_change = false`
- Depois:
  - Fazer logout e login novamente
  - Verificar se o menu "Gestão de Usuários" aparece

🔎 **Passo a passo com comandos e prints esperados:** ver `INSTRUCOES_ADMIN.md`.

---

## 🔑 Outros Fluxos Importantes

- **Recuperação de senha / reset de acesso**
  - Fluxos e cuidados adicionais podem estar documentados em `RESUMO_RECUPERACAO_SENHA.md`.
- **Notas de migrações pendentes ou ajustes manuais de banco**
  - Em caso de dúvidas pontuais de migração, consultar `IMPORTANTE_MIGRATION_PENDENTE.md` (se ainda existir no ambiente de desenvolvimento).

---

## ✅ Checklist Rápido Antes de Subir Ambiente Novo

- [ ] `.env` configurado com `DATABASE_URL` e `JWT_SECRET` válidos
- [ ] Config de email (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`) preenchida
- [ ] Migrations aplicadas (`pnpm db:push`)
- [ ] `DEV_MODE=false` em produção
- [ ] Primeiro usuário admin configurado conforme `INSTRUCOES_ADMIN.md`
- [ ] Logs verificados na primeira subida (erros de conexão, email, etc.)
