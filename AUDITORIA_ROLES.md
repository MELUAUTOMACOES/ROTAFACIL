# Auditoria: users.role vs memberships.role

## Problema Real Identificado

O sistema está **misturando duas fontes de role**:
- `users.role` → Role GLOBAL (única para todas empresas)
- `memberships.role` → Role POR EMPRESA (usuário pode ter roles diferentes em empresas diferentes)

**Isso cria inconsistência** porque:
1. Usuário altera role no formulário `/users` → salva em `users.role` E `memberships.role`
2. JWT é gerado no login com AMBOS: `role` (users.role) e `companyRole` (memberships.role)
3. Middlewares e rotas usam `req.user.role` (global) ao invés de `req.user.companyRole` (da empresa)

---

## Estado atual do JWT

### Quando o JWT é criado (login):

```typescript
// server/routes.ts:1509-1515
const token = jwt.sign({
  userId: user.id,
  email: user.email,
  role: user.role,              // ❌ users.role (GLOBAL)
  companyId: companyId,
  companyRole: companyRole,      // ✅ memberships.role (POR EMPRESA)
}, JWT_SECRET, { expiresIn: '24h' });
```

### Quando o JWT é decodificado (authenticateToken):

```typescript
// server/routes.ts:193-201
req.user = {
  id: decoded.userId,
  userId: decoded.userId,
  email: decoded.email,
  role: decoded.role || 'user',           // ❌ users.role (GLOBAL)
  companyId: decoded.companyId,
  companyRole: decoded.companyRole,       // ✅ memberships.role (POR EMPRESA)
  isSuperAdmin: user.isSuperAdmin || false,
};
```

---

## Onde o sistema usa `req.user.role` (GLOBAL) ❌

### 1. Middlewares (já normalizados, mas usando fonte errada)

- `server/middleware/role.middleware.ts` → `requireRole()` usa `req.user.role`
- `server/routes/user-management.routes.ts` → `requireAdmin()` usa `req.user.role`
- `server/routes/audit.routes.ts` → `requireAdmin()` usa `req.user.role`
- `server/routes/access-schedules.routes.ts` → `requireAdmin()` usa `req.user.role`

### 2. Lógica de rotas

- `server/routes.ts:394` → Verificação de admin para ver rota de outro usuário
- `server/routes.ts:417` → Verificação de admin para ver rota de outro usuário

---

## Onde o sistema USA `req.user.companyRole` (POR EMPRESA) ✅

- `server/routes/company.routes.ts` → `requireCompanyAdmin()` usa `req.user.companyRole`

---

## Problema com técnicos (JÁ CORRIGIDO) ✅

**ANTES:**
```typescript
// Buscava apenas por user_id (criador do registro)
eq(technicians.userId, userId)
```

**DEPOIS:**
```typescript
// Prioriza linked_user_id (conta de login real)
or(
  eq(technicians.linkedUserId, userId),
  eq(technicians.userId, userId)  // fallback
)
```

---

## Decisões a tomar

### Opção 1: Deprecar `users.role` (RECOMENDADO)

**Por quê:**
- Sistema é **multi-tenant** (várias empresas)
- Usuário pode ter **roles diferentes em empresas diferentes**
- `users.role` cria **inconsistência e confusão**

**O que fazer:**
1. Remover `users.role` do JWT
2. Todas as verificações de permissão devem usar `req.user.companyRole`
3. Manter `users.role` no banco apenas para compatibilidade/migração
4. Frontend sempre usa role da membership atual

**Impacto:**
- ✅ Consistência total: role sempre vem da empresa atual
- ✅ Sem confusão entre role global vs por empresa
- ⚠️ Precisa ajustar todos os middlewares e verificações

### Opção 2: Usar `users.role` como fallback

**Por quê:**
- Alguns usuários podem não ter membership (improvável, mas possível)
- Compatibilidade com código antigo

**O que fazer:**
1. Verificações de permissão usam `req.user.companyRole || req.user.role`
2. Prioriza sempre companyRole

**Impacto:**
- ⚠️ Mantém confusão: qual é a fonte oficial?
- ⚠️ Inconsistência: role pode vir de lugares diferentes

---

## Recomendação FINAL

### ✅ DEPRECAR `users.role` em contextos multi-tenant

**Ação:**
1. Modificar todos os middlewares para usar `req.user.companyRole`
2. Se `companyRole` não existir → retornar 403 (usuário sem empresa)
3. Manter `users.role` no banco apenas como backup/migração
4. Frontend sempre exibe e edita role da membership atual

**Exceção:**
- SuperAdmin (`isSuperAdmin: true`) pode continuar usando `users.role` se não tiver empresa

---

## Próximos passos

1. ✅ Corrigir busca de técnicos (FEITO)
2. ⏳ Substituir `req.user.role` por `req.user.companyRole` em TODOS os middlewares
3. ⏳ Testar fluxo completo: login → selecionar empresa → acessar recursos
4. ⏳ Documentar que `users.role` não deve mais ser usado em lógica de negócio multi-tenant
