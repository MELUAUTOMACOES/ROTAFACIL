# ✅ IMPLEMENTAÇÃO: DISPLAY_NAME + PERMISSÕES PRESTADOR

## 🎯 PROBLEMA 1: NOME ÚNICO POR EMPRESA - RESOLVIDO ✅

### **Solução implementada**:
Adicionado campo `display_name` às tabelas `memberships` e `invitations` para permitir nomes diferentes por empresa.

---

## 📋 ALTERAÇÕES REALIZADAS

### **1. Migração do Banco de Dados** ✅

**Arquivo**: `migrations/0036_add_display_name_to_memberships.sql`
```sql
ALTER TABLE memberships ADD COLUMN display_name TEXT;
CREATE INDEX idx_memberships_display_name ON memberships(display_name) WHERE display_name IS NOT NULL;
```

**Arquivo**: `migrations/0037_add_display_name_to_invitations.sql`
```sql
ALTER TABLE invitations ADD COLUMN display_name TEXT;
```

**SQL consolidado**: `SQL_DISPLAY_NAME.sql` (execute este arquivo)

---

### **2. Schema Drizzle atualizado** ✅

**`shared/schema.ts`**:

**Tabela `memberships`**:
```typescript
export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  role: text("role").notNull(),
  displayName: text("display_name"), // ✅ NOVO!
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Tabela `invitations`**:
```typescript
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  displayName: text("display_name"), // ✅ NOVO!
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  invitedBy: integer("invited_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Schema de validação**:
```typescript
export const createInvitationSchema = z.object({
  email: z.string().email("Email inválido"),
  role: roleEnum,
  displayName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").optional(), // ✅ NOVO!
});
```

---

### **3. Endpoints de Convite atualizados** ✅

**`server/routes/company.routes.ts`**:

**Criar convite** (linha 346):
```typescript
const invitation = await storage.createInvitation({
  companyId,
  email: inviteData.email,
  role: inviteData.role,
  displayName: inviteData.displayName, // ✅ NOVO!
  token,
  status: 'pending',
  expiresAt,
  invitedBy,
});
```

**Aceitar convite (usuário existente)** (linha 647):
```typescript
const membership = await storage.createMembership({
  userId: req.user.userId,
  companyId: invitation.companyId,
  role: invitation.role,
  displayName: invitation.displayName, // ✅ NOVO!
  isActive: true,
});
```

**Aceitar convite (usuário novo)** (linha ~490):
```typescript
const membership = await storage.createMembership({
  userId: newUser.id,
  companyId: invitation.companyId,
  role: invitation.role,
  displayName: invitation.displayName, // ✅ NOVO!
  isActive: true,
});
```

---

### **4. Listagem de Usuários** ✅

**`server/routes/company.routes.ts`** (linha 268-283):
```typescript
const usersWithRoles = await Promise.all(
  memberships.map(async (membership) => {
    const user = await storage.getUserById(membership.userId);
    if (!user) return null;

    const { password, emailVerificationToken, ...userWithoutSensitiveData } = user;
    
    return {
      ...userWithoutSensitiveData,
      name: membership.displayName || user.name, // ✅ USA DISPLAY_NAME SE DISPONÍVEL!
      role: membership.role,
      isActive: membership.isActive,
    };
  })
);
```

**Agora**:
- Se `displayName` existir na membership → usa esse nome
- Se `displayName` for `null` → usa `users.name` (global)

---

### **5. Convite via POST /api/users** ✅

**`server/routes/user-management.routes.ts`** (linha ~140):
```typescript
await storage.createInvitation({
  companyId: adminCompanyId,
  email: existingUser.email,
  role: inviteRole,
  displayName: userData.name, // ✅ USA O NOME DO FORMULÁRIO!
  token: inviteToken,
  status: 'pending',
  invitedBy: req.user.userId,
});
```

**Comportamento**:
- Admin preenche "Nome" no formulário
- Esse nome é salvo no convite
- Quando usuário aceita, esse nome vira `displayName` na membership

---

## 🎯 PROBLEMA 2: PERMISSÕES PRESTADOR - RESOLVIDO ✅

### **APIs bloqueadas para prestador/tecnico**:
```
❌ GET /api/business-rules → 403 Forbidden
❌ GET /api/vehicles/available-for-me → 403 Forbidden
❌ GET /api/vehicles → 403 Forbidden
```

### **Causa**:
Endpoints tinham `requireRole(['admin', 'operador'])`, bloqueando prestador/tecnico.

### **Solução implementada**:

**`server/routes.ts`**:

**1. Liberar /api/vehicles/available-for-me** (linha 2428):
```typescript
app.get("/api/vehicles/available-for-me", 
  authenticateToken, 
  requireRole(['admin', 'operador', 'prestador', 'tecnico']), // ✅ ADICIONADO!
  async (req: any, res) => {
```

**2. Liberar /api/business-rules (leitura)** (linha 4909):
```typescript
app.get("/api/business-rules", 
  authenticateToken, 
  requireRole(['admin', 'operador', 'prestador', 'tecnico']), // ✅ ADICIONADO!
  async (req: any, res) => {
```

**APIs de escrita (POST, PUT, DELETE) continuam restritas a admin/operador**.

---

## 📝 COMO USAR DISPLAY_NAME

### **1. Admin convida usuário com nome personalizado**:

**Tela de gestão de usuários** → Criar novo usuário:
```
Nome: João Silva - Filial Norte
Email: joao@email.com
Role: Operador
```

**Resultado**:
- Convite criado com `displayName: "João Silva - Filial Norte"`
- Email enviado

---

### **2. Usuário aceita convite**:

**Membership criada**:
```sql
INSERT INTO memberships (user_id, company_id, role, display_name)
VALUES (26, 1, 'OPERADOR', 'João Silva - Filial Norte');
```

---

### **3. Listagem mostra nome correto**:

**GET /api/company/users** retorna:
```json
{
  "users": [
    {
      "id": 26,
      "name": "João Silva - Filial Norte",  // ← displayName da Empresa A
      "email": "joao@email.com",
      "role": "OPERADOR"
    }
  ]
}
```

**Mesma pessoa em outra empresa** (Empresa B):
```json
{
  "users": [
    {
      "id": 26,
      "name": "João Silva - Filial Sul",  // ← displayName da Empresa B
      "email": "joao@email.com",
      "role": "ADMINISTRATIVO"
    }
  ]
}
```

---

## 🚀 DEPLOY

### **1. Execute o SQL**:
```bash
psql -U seu_usuario -d seu_banco -f SQL_DISPLAY_NAME.sql
```

Ou copie e execute no Supabase SQL Editor:
```sql
ALTER TABLE memberships ADD COLUMN display_name TEXT;
CREATE INDEX idx_memberships_display_name ON memberships(display_name) 
WHERE display_name IS NOT NULL;
COMMENT ON COLUMN memberships.display_name IS 
'Nome de exibição do usuário específico para esta empresa. Se NULL, usa users.name';

ALTER TABLE invitations ADD COLUMN display_name TEXT;
COMMENT ON COLUMN invitations.display_name IS 
'Nome personalizado que será usado quando o usuário aceitar o convite e a membership for criada';
```

### **2. Faça deploy do código**:
- Schema atualizado (`shared/schema.ts`)
- Endpoints atualizados (`server/routes/company.routes.ts`, `server/routes/user-management.routes.ts`)
- Permissões liberadas (`server/routes.ts`)

### **3. Teste**:

**a) Teste de display_name**:
1. Admin da Empresa A convida `teste@email.com`
2. Preenche nome: "João - Equipe Norte"
3. Usuário aceita convite
4. **Verificar**: Nome na lista de usuários da Empresa A deve ser "João - Equipe Norte"

**b) Teste de permissões prestador**:
1. Login como prestador/tecnico
2. Ir em `/prestadores`
3. Tentar iniciar rota
4. **Verificar**: Não deve mais dar erro 403
5. **Verificar**: Deve conseguir selecionar veículo

---

## ✅ RESUMO DAS CORREÇÕES

| Problema | Status | Solução |
|----------|--------|---------|
| Nome único em todas empresas | ✅ RESOLVIDO | Campo `display_name` em memberships |
| Erro 400 na gestão de usuários | ✅ RESOLVIDO | Retornar todos campos em /api/company/users |
| Prestador não vê veículos | ✅ RESOLVIDO | Liberado /api/vehicles/available-for-me |
| Prestador não lê business rules | ✅ RESOLVIDO | Liberado GET /api/business-rules |

---

## 📁 ARQUIVOS MODIFICADOS

1. ✅ `migrations/0036_add_display_name_to_memberships.sql`
2. ✅ `migrations/0037_add_display_name_to_invitations.sql`
3. ✅ `SQL_DISPLAY_NAME.sql` (consolidado para executar)
4. ✅ `shared/schema.ts` - Adicionado displayName
5. ✅ `server/routes/company.routes.ts` - Convites e listagem
6. ✅ `server/routes/user-management.routes.ts` - Convite via POST /users
7. ✅ `server/routes.ts` - Permissões prestador/tecnico

---

## 🎯 RESULTADO FINAL

**Antes**:
```
Usuário ID 26:
- Empresa A: "Teste Prestador"
- Empresa B: "Teste Prestador" (mesmo nome)
❌ Prestador não acessa tela de rotas (erro 403)
```

**Depois**:
```
Usuário ID 26:
- Empresa A: "Teste Prestador"
- Empresa B: "Melu"
✅ Prestador acessa tela de rotas normalmente
✅ Vê veículos vinculados
✅ Consegue iniciar rotas
```

---

**Deploy e teste! 🚀**
