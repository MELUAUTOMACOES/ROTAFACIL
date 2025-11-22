# 🔐 Sistema de Gestão de Usuários com LGPD - Rota Fácil

## 📋 Visão Geral

Sistema completo de gerenciamento de usuários implementado com conformidade LGPD, incluindo:

- ✅ Cadastro de usuários por administradores
- ✅ Validação de email obrigatória
- ✅ Primeira senha obrigatória (usuário define sua própria senha)
- ✅ Controle de perfis (admin/user)
- ✅ Rastreabilidade de criação de usuários
- ✅ Email único por usuário
- ✅ Status ativo/inativo
- ✅ Histórico de último acesso

## 🚀 Instruções de Instalação

### 1. Aplicar Migrations no Banco de Dados

Execute as migrations para adicionar os novos campos à tabela `users`:

```bash
pnpm run db:push
```

Ou execute manualmente os SQL das migrations:

```sql
-- Arquivo: migrations/0008_add_user_management_fields.sql (Gestão LGPD)
-- Arquivo: migrations/0009_add_user_contact_address.sql (Telefone e Endereço)
```

### 2. Atualizar Primeiro Usuário como Admin

Após aplicar a migration, o primeiro usuário (ID 1) será automaticamente marcado como admin com email verificado. Para verificar:

```sql
SELECT id, email, role, email_verified FROM users WHERE id = 1;
```

## 📱 Funcionalidades Implementadas

### **Backend (API)**

#### Rotas de Gestão de Usuários (Admin apenas)

- `GET /api/users` - Listar todos os usuários
- `POST /api/users` - Criar novo usuário
- `PUT /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Deletar usuário
- `POST /api/users/:id/resend-verification` - Reenviar email de verificação

#### Rotas Públicas (Sem autenticação)

- `POST /api/auth/verify-email` - Verificar email via token
- `POST /api/auth/set-first-password` - Definir primeira senha

#### Rotas Autenticadas

- `POST /api/auth/change-password` - Alterar senha
- `POST /api/auth/login` - Login com verificações LGPD

### **Frontend (Telas)**

#### Páginas Criadas

1. **`/users`** - Gestão de Usuários (Admin)
   - Lista de usuários com badges de status
   - Criar/Editar/Deletar usuários
   - Reenviar email de verificação
   - Visualizar status de verificação e senha

2. **`/verify-email`** - Verificação de Email (Pública)
   - Recebe token via URL
   - Verifica email automaticamente
   - Redireciona para criação de senha

3. **`/set-password`** - Primeira Senha (Pública)
   - Após verificação de email
   - Validação de requisitos de senha
   - Feedback visual de força da senha

4. **`/change-password`** - Trocar Senha (Autenticada)
   - Modo obrigatório (LGPD)
   - Modo opcional (usuário quer trocar)
   - Validação de senha atual

#### Componentes

- **`UserForm`** - Formulário de cadastro/edição de usuário
- Atualização do **`Sidebar`** - Link "Gestão de Usuários" apenas para admins

### **Banco de Dados**

Novos campos na tabela `users`:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `role` | text | Perfil do usuário (admin/user) |
| `phone` | text | Telefone de contato |
| `cep` | text | CEP do endereço |
| `logradouro` | text | Rua, avenida do endereço |
| `numero` | text | Número do endereço |
| `complemento` | text | Complemento (apto, bloco) |
| `bairro` | text | Bairro |
| `cidade` | text | Cidade |
| `estado` | text | Estado (UF) |
| `email_verified` | boolean | Email foi verificado? |
| `email_verification_token` | text | Token de verificação |
| `email_verification_expiry` | timestamp | Expiração do token (24h) |
| `require_password_change` | boolean | Requer troca de senha? (LGPD) |
| `is_active` | boolean | Usuário está ativo? |
| `last_login_at` | timestamp | Data do último login |
| `created_by` | integer | ID do admin que criou |

## 🔒 Fluxo LGPD Completo

### 1. **Admin Cria Usuário**

1. Admin acessa `/users` (menu lateral - apenas para admins)
2. Clica em "Novo Usuário"
3. Preenche: nome, email, username, perfil, telefone e endereço
   - **Nota**: O plano é definido automaticamente como "Básico"
   - **Busca CEP**: Ao digitar o CEP, o endereço é preenchido automaticamente
4. Sistema gera senha temporária automaticamente
5. Email de verificação é enviado

### 2. **Usuário Recebe Email**

```
Olá [Nome],

Sua conta foi criada no Rota Fácil!

Para ativar sua conta e criar sua senha, clique no link abaixo:
[Link de Verificação]

Este link expira em 24 horas.
```

### 3. **Usuário Verifica Email**

1. Clica no link
2. Sistema verifica token
3. Redireciona para `/set-password`

### 4. **Usuário Cria Senha**

1. Define senha própria (requisitos de segurança)
2. Confirma senha
3. Sistema valida e salva
4. Marca `require_password_change = false`
5. Redireciona para login

### 5. **Primeiro Login**

1. Usuário faz login
2. Sistema verifica:
   - ✅ Email verificado?
   - ✅ Usuário ativo?
   - ✅ Senha foi trocada?
3. Se `require_password_change = true`, força troca de senha
4. Atualiza `last_login_at`

## ⚙️ Configurações

### Variáveis de Ambiente (Recomendadas)

```env
# JWT Secret (produção - obrigatório)
JWT_SECRET=sua_chave_secreta_muito_segura_com_minimo_32_caracteres

# URL da aplicação (para links de email)
APP_URL=https://rotafacil.app

# Modo de desenvolvimento (apenas dev)
DEV_MODE=false
```

### Email (TODO - Implementar)

Atualmente, os emails são apenas logados no console. Para produção, implementar serviço de email:

- **Opções**: SendGrid, AWS SES, Mailgun, Resend
- **Arquivo**: `server/routes/user-management.routes.ts`
- **Função**: `sendVerificationEmail()`

## 🧪 Como Testar

### 1. Criar Usuário Teste

```bash
# 1. Fazer login como admin
# 2. Acessar /users
# 3. Criar novo usuário:
#    - Nome: João Teste
#    - Email: joao@teste.com
#    - Username: joaoteste
#    - Perfil: user
#    - Plano: basic
```

### 2. Verificar Email (Mock)

Como o email está em mock, copie o link do console do servidor:

```
📧 [EMAIL] Email de verificação para: joao@teste.com
🔗 [EMAIL] Link: http://localhost:5000/verify-email?token=abc123...
```

Acesse o link no navegador.

### 3. Definir Senha

1. Sistema redireciona para `/set-password`
2. Digite senha forte (min 8 chars, maiúscula, minúscula, número)
3. Confirme a senha
4. Clique em "Definir Senha"

### 4. Fazer Login

1. Acesse `/login`
2. Email: `joao@teste.com`
3. Senha: (a que você definiu)
4. Sistema deve permitir acesso

### 5. Testar Troca Obrigatória

Para testar o fluxo de senha obrigatória:

```sql
-- Marcar usuário para trocar senha
UPDATE users SET require_password_change = true WHERE email = 'joao@teste.com';
```

Ao fazer login, o sistema bloqueará acesso e forçará troca de senha.

## 📊 Monitoramento

### Queries Úteis

```sql
-- Usuários pendentes de verificação
SELECT id, name, email, created_at 
FROM users 
WHERE email_verified = false;

-- Usuários que precisam trocar senha
SELECT id, name, email, created_at 
FROM users 
WHERE require_password_change = true;

-- Usuários inativos
SELECT id, name, email, is_active 
FROM users 
WHERE is_active = false;

-- Último acesso de cada usuário
SELECT name, email, last_login_at 
FROM users 
ORDER BY last_login_at DESC NULLS LAST;
```

## 🔐 Segurança

### Proteções Implementadas

✅ **Senhas**: Hashing com bcrypt (salt rounds: 10)  
✅ **Tokens**: Gerados com crypto.randomBytes (32 bytes hex)  
✅ **Expiração**: Tokens de email expiram em 24 horas  
✅ **Validação**: Zod schemas em todas as entradas  
✅ **Autenticação**: JWT com middleware  
✅ **Autorização**: Rotas admin protegidas com `requireAdmin`  
✅ **Rate Limiting**: (Recomendado adicionar em produção)  

### Requisitos de Senha

- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número

## 📝 Próximos Passos (Recomendações)

1. **Implementar serviço de email real** (SendGrid, AWS SES)
2. **Adicionar rate limiting** nas rotas de autenticação
3. **Logs de auditoria** detalhados para ações sensíveis
4. **2FA (Two-Factor Authentication)** para admins
5. **Política de expiração de senha** (trocar a cada X dias)
6. **Recuperação de senha** (esqueci minha senha)
7. **Histórico de senhas** (não permitir reutilização)
8. **Notificação de login** (email ao fazer login de novo dispositivo)

## 🐛 Troubleshooting

### Problema: Token de verificação inválido

**Causa**: Token expirado ou inválido  
**Solução**: Reenviar email de verificação pela tela de gestão

### Problema: Não consigo criar usuário

**Causa**: Email já existe ou campos obrigatórios faltando  
**Solução**: Verificar se email é único e todos os campos foram preenchidos

### Problema: Usuário não recebe email

**Causa**: Serviço de email não implementado (apenas logs)  
**Solução**: Copiar link do console do servidor para testar

### Problema: Migration falhou

**Causa**: Schema incompatível  
**Solução**: 
```bash
# Verificar conexão com banco
psql $DATABASE_URL -c "SELECT 1"

# Rodar migration manualmente
psql $DATABASE_URL -f migrations/0008_add_user_management_fields.sql
```

## 📚 Arquivos Modificados/Criados

### Backend
- ✅ `shared/schema.ts` - Schemas e tipos
- ✅ `server/storage.ts` - Métodos de banco
- ✅ `server/routes.ts` - Atualização de login
- ✅ `server/routes/user-management.routes.ts` - **NOVO** - Rotas de gestão
- ✅ `migrations/0008_add_user_management_fields.sql` - **NOVO** - Migration

### Frontend
- ✅ `client/src/pages/UserManagement.tsx` - **NOVO** - Tela admin
- ✅ `client/src/pages/VerifyEmail.tsx` - **NOVO** - Verificação email
- ✅ `client/src/pages/SetPassword.tsx` - **NOVO** - Primeira senha
- ✅ `client/src/pages/ChangePassword.tsx` - **NOVO** - Trocar senha
- ✅ `client/src/components/forms/UserForm.tsx` - **NOVO** - Formulário
- ✅ `client/src/lib/auth.tsx` - Atualização com requirePasswordChange
- ✅ `client/src/components/Sidebar.tsx` - Link de gestão
- ✅ `client/src/App.tsx` - Novas rotas

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar este README
2. Consultar logs do servidor
3. Verificar console do navegador
4. Revisar queries SQL acima

---

**✨ Sistema implementado com sucesso seguindo todas as regras do projeto e conformidade LGPD!**
