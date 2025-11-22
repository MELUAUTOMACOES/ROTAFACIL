# Sistema Multiempresa - Rota Fácil

## 📋 Visão Geral

O Rota Fácil agora suporta **multiempresa** (multi-tenant), permitindo que:
- Múltiplas empresas usem o sistema de forma isolada
- Cada empresa tenha seus próprios dados (clientes, técnicos, equipes, agendamentos, etc.)
- Usuários possam pertencer a múltiplas empresas com diferentes papéis
- Admins convidem usuários para suas empresas via e-mail

## 🏗️ Arquitetura

### Modelo de Dados

#### 1. **Companies** (Empresas/Tenants)
Representa cada empresa que usa o sistema.

Campos principais:
- `id`: Identificador único
- `name`: Nome fantasia da empresa
- `cnpj`: CNPJ (único no sistema)
- `telefone`: Telefone comercial (WhatsApp)
- `email`: E-mail da empresa
- `cep`, `logradouro`, `numero`, `cidade`, `estado`: Endereço da sede
- `segmento`: Assistência técnica, Telecom/Fibra, etc.
- `servicos`: Array de serviços oferecidos
- `comoConheceu`: Como conheceu o RotaFácil (marketing)
- `problemaPrincipal`: Principal problema a resolver
- `plan`: Plano contratado (free, basic, professional, enterprise)
- `statusAssinatura`: Status da assinatura (active, suspended, cancelled)

#### 2. **Memberships** (Vínculos Usuário-Empresa)
Liga usuários às empresas com seus respectivos papéis.

Campos principais:
- `id`: Identificador único
- `userId`: Referência ao usuário
- `companyId`: Referência à empresa
- `role`: Papel do usuário na empresa (ADMIN, ADMINISTRATIVO, OPERADOR)
- `isActive`: Se o vínculo está ativo

**Papéis (Roles):**
- **ADMIN**: Administrador da empresa
  - Pode convidar/gerenciar usuários
  - Acesso total aos dados da empresa
  - Gerencia configurações e planos
  
- **ADMINISTRATIVO**: Usuário administrativo
  - Cadastra/edita: clientes, técnicos, equipes, veículos, serviços
  - Gerencia agendamentos e rotas
  - Não pode convidar usuários

- **OPERADOR**: Usuário operacional (campo)
  - Visualiza agendamentos/rotas de sua equipe/técnico
  - Atualiza status de atendimentos
  - Acesso limitado apenas ao necessário para operação

#### 3. **Invitations** (Convites)
Gerencia convites para usuários entrarem em empresas.

Campos principais:
- `id`: Identificador único
- `companyId`: Empresa que está convidando
- `email`: E-mail do convidado
- `role`: Papel sugerido (ADMIN, ADMINISTRATIVO, OPERADOR)
- `token`: Token único do convite (usado no link)
- `status`: Status do convite (pending, accepted, expired)
- `expiresAt`: Data de expiração (7 dias)
- `invitedBy`: Quem enviou o convite

### Isolamento de Dados

Todas as tabelas de negócio agora incluem `companyId`:
- `clients` (clientes)
- `services` (serviços)
- `technicians` (técnicos)
- `vehicles` (veículos)
- `appointments` (agendamentos)
- `teams` (equipes)
- `businessRules` (regras de negócio)

**Importante:** As queries sempre filtram por `companyId` para garantir isolamento completo.

## 🔐 Autenticação e Autorização

### Token JWT

O token JWT agora inclui:
```typescript
{
  userId: number,
  email: string,
  role: string,           // Role antigo (compatibilidade)
  companyId?: number,     // ID da empresa ativa
  companyRole?: string,   // Papel na empresa (ADMIN, ADMINISTRATIVO, OPERADOR)
}
```

### Middleware de Autorização

**`requireCompanyAdmin`**: Verifica se usuário é ADMIN da empresa antes de permitir ações administrativas.

## 📡 API Endpoints

### Cadastro de Empresa

**POST `/api/auth/signup-company`** (público)

Cria uma nova empresa e o usuário administrador.

Request body:
```json
{
  "company": {
    "name": "Empresa XYZ",
    "cnpj": "12.345.678/0001-90",
    "telefone": "(11) 98765-4321",
    "email": "contato@empresa.com",
    "cep": "12345-678",
    "logradouro": "Rua ABC",
    "numero": "123",
    "cidade": "São Paulo",
    "estado": "SP",
    "segmento": "Assistência técnica",
    "servicos": ["Instalação", "Manutenção"],
    "comoConheceu": "Google",
    "problemaPrincipal": "Organização de agenda"
  },
  "admin": {
    "name": "João Silva",
    "email": "joao@empresa.com",
    "phone": "(11) 98765-4321"
  }
}
```

**Fluxo:**
1. Valida CNPJ único
2. Valida e-mail único do admin
3. Cria empresa
4. Cria usuário admin (com senha temporária)
5. Cria membership ADMIN
6. Envia e-mail de verificação
7. Admin só pode logar após verificar e-mail

### Gestão de Usuários

**GET `/api/company/users`** (requer ADMIN)

Lista usuários e convites pendentes da empresa.

Response:
```json
{
  "users": [
    {
      "id": 1,
      "name": "João Silva",
      "email": "joao@empresa.com",
      "role": "ADMIN",
      "isActive": true,
      "emailVerified": true
    }
  ],
  "pendingInvites": [
    {
      "id": 1,
      "email": "maria@empresa.com",
      "role": "ADMINISTRATIVO",
      "status": "pending",
      "expiresAt": "2025-01-27T12:00:00Z"
    }
  ]
}
```

**POST `/api/company/users/invite`** (requer ADMIN)

Convida um usuário para a empresa.

Request body:
```json
{
  "email": "usuario@example.com",
  "role": "ADMINISTRATIVO"
}
```

**Fluxo:**
1. Valida se usuário já está na empresa
2. Verifica convites pendentes duplicados
3. Gera token único
4. Cria convite (válido por 7 dias)
5. Envia e-mail de convite de `convite@meluautomacao.com`

### Convites

**GET `/api/invitations/:token`** (público)

Valida um convite e retorna informações.

Response:
```json
{
  "invitation": {
    "email": "usuario@example.com",
    "role": "ADMINISTRATIVO",
    "company": {
      "id": 1,
      "name": "Empresa XYZ"
    }
  },
  "hasAccount": false
}
```

**POST `/api/invitations/:token/accept-new`** (público)

Aceita convite criando nova conta.

Request body:
```json
{
  "token": "abc123...",
  "name": "Maria Silva",
  "password": "Senha@123",
  "confirmPassword": "Senha@123"
}
```

**POST `/api/invitations/:token/accept-existing`** (requer autenticação)

Aceita convite com conta existente.

Request body:
```json
{
  "token": "abc123..."
}
```

## 📧 E-mails

### Verificação de E-mail (Cadastro de Empresa)

- **De:** configurado em `EMAIL_FROM` (.env)
- **Assunto:** "Bem-vindo ao Rota Fácil - Verifique seu Email"
- **Template:** `getVerificationEmailTemplate()`
- **Link:** `/verify-email?token={token}`
- **Validade:** 24 horas

### Convite para Empresa

- **De:** `convite@meluautomacao.com` (configurável em `EMAIL_FROM_INVITE`)
- **Assunto:** "Convite para {empresa} - Rota Fácil"
- **Template:** `sendInvitationEmail()`
- **Link:** `/convite/{token}`
- **Validade:** 7 dias

## 🎨 Interface do Usuário (Frontend)

### Telas Necessárias

1. **Cadastro de Empresa** (`/signup-company`)
   - Formulário com dados da empresa e do admin
   - Validação de CNPJ
   - Feedback de sucesso com instrução para verificar e-mail

2. **Gestão de Usuários** (`/company/users`)
   - Lista de usuários da empresa
   - Lista de convites pendentes
   - Botão "Convidar Usuário"
   - Modal para criar convite (email + papel)

3. **Aceitar Convite** (`/convite/:token`)
   - Validação do token
   - Se usuário não tem conta: formulário de cadastro
   - Se usuário já está logado: confirmação de entrada na empresa
   - Feedback de sucesso

## 🔧 Configuração

### Variáveis de Ambiente

Adicionar ao `.env`:

```bash
# E-mail de convites
EMAIL_FROM_INVITE=convite@meluautomacao.com

# URL da aplicação (para links nos e-mails)
APP_URL=http://localhost:5000
# ou em produção:
# APP_URL=https://app.rotafacil.com
```

### Migrations

Após implementar, executar:

```bash
pnpm run db:push
```

Isso criará as novas tabelas:
- `companies`
- `memberships`
- `invitations`

E adicionará `companyId` às tabelas existentes.

## ✅ Checklist de Implementação

### Backend
- [x] Schema do banco (companies, memberships, invitations)
- [x] Adicionar companyId em tabelas de negócio
- [x] Storage methods (criar/buscar empresas, memberships, convites)
- [x] Endpoint de cadastro de empresa
- [x] Endpoints de gestão de usuários
- [x] Endpoints de convites
- [x] Atualização do login para incluir companyId/role
- [x] Middleware de autorização por papel
- [x] E-mail de convite

### Frontend
- [ ] Tela de cadastro de empresa
- [ ] Tela de gestão de usuários
- [ ] Tela de aceitação de convites
- [ ] Atualizar contexto de autenticação
- [ ] Exibir empresa atual no header
- [ ] Filtrar dados por companyId

### Testes
- [ ] Testar cadastro de empresa
- [ ] Testar fluxo de verificação de e-mail
- [ ] Testar criação de convites
- [ ] Testar aceitação de convites (novo usuário)
- [ ] Testar aceitação de convites (usuário existente)
- [ ] Testar isolamento de dados entre empresas
- [ ] Testar permissões por papel

## 🚨 Segurança

- Todos os endpoints de administração requerem role ADMIN
- Dados sempre filtrados por companyId
- Convites expiram após 7 dias
- Tokens de convite são únicos e validados
- E-mail deve ser verificado antes do primeiro login
- Passwords seguem política forte (8+ chars, maiúscula, minúscula, número)

## 📝 Notas Importantes

1. **Compatibilidade com Sistema Antigo:**
   - Campo `users.role` mantido para compatibilidade
   - Sistema prefere `memberships.role` sobre `users.role`
   - Usuários antigos podem ser migrados criando memberships

2. **Múltiplas Empresas:**
   - Usuário pode pertencer a múltiplas empresas
   - Token JWT inclui empresa "ativa"
   - Futuramente: seleção de empresa no login/header

3. **Herança de Técnicos:**
   - Sistema mantém herança de técnicos das equipes
   - Agora isolado por empresa

4. **Planos e Limites:**
   - Cada empresa tem seu próprio plano
   - Limites aplicados por empresa (não por usuário)

## 🔮 Próximos Passos

1. Implementar telas frontend
2. Adicionar seleção de empresa no header (quando usuário tem múltiplas)
3. Implementar gestão de planos e pagamentos
4. Dashboard por empresa
5. Relatórios e analytics por empresa
6. Exportação de dados por empresa (LGPD)
