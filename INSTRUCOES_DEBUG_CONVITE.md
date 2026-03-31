# 🔍 INSTRUÇÕES PARA DEBUG DO FLUXO DE ACEITE DE CONVITE

## ⚠️ PROBLEMA IDENTIFICADO

**Estado atual do banco:**
- `invitations`: convite com status `pending` (não foi atualizado)
- `memberships`: nenhuma membership criada para empresa 1

**Conclusão:** O endpoint de aceite **não está sendo executado** ou **está falhando silenciosamente**.

---

## 🎯 OBJETIVO DO TESTE

Descobrir **EXATAMENTE** onde o fluxo falha:
1. O frontend está chamando o endpoint correto?
2. O backend está recebendo a requisição?
3. Se recebe, em que validação falha?
4. Se não recebe, por que o request não chegou?

---

## 📋 PREPARAÇÃO DO TESTE

### 1. Deploy do código com logs

Faça deploy do código atual que contém:
- ✅ Logs no frontend (`AcceptInvite.tsx`)
- ✅ Logs no backend (`company.routes.ts`)

### 2. Criar novo convite limpo

```sql
-- Deletar convite antigo
DELETE FROM invitations WHERE email = 'meluautomacoes@gmail.com' AND company_id = 1;

-- Verificar que não existe membership
SELECT * FROM memberships WHERE user_id = 26 AND company_id = 1;
-- Deve retornar vazio

-- Admin da Empresa 1 cria novo convite via interface
-- Anotar: email do convite, token (verificar no banco)
```

### 3. Abrir Console do Navegador

**CRITICAL:** Abra o DevTools **ANTES** de clicar no link:
1. Abra uma aba anônima (Ctrl+Shift+N)
2. Pressione **F12** para abrir DevTools
3. Vá na aba **Console**
4. **Deixe aberto durante todo o teste**

---

## 🧪 PROCEDIMENTO DE TESTE

### PASSO 1: Acessar o Link do Convite

1. Copie o link do convite do e-mail
2. Cole na aba anônima
3. **ANOTE A URL COMPLETA** que aparece no navegador

**Verificar no Console:**
```
🎫 [ACCEPT INVITE] Componente montado
🎫 [ACCEPT INVITE] Token da URL: <TOKEN>
```

### PASSO 2: Validação Inicial

O componente vai validar o convite automaticamente.

**Verificar no Console do Navegador:**
```
🔍 [VALIDATE INVITE] Validando convite...
🔍 [VALIDATE INVITE] URL: <URL_COMPLETA>
🔍 [VALIDATE INVITE] Status: 200
🔍 [VALIDATE INVITE] Response: {invitation: {...}}
✅ [VALIDATE INVITE] Convite válido!
```

**Verificar no Console do Servidor (backend):**
- Esta chamada GET `/api/invitations/:token` **NÃO tem logs extras** ainda
- Apenas verifique se retorna 200 OK

**❌ SE FALHAR AQUI:**
- Convite não existe no banco
- Token incorreto
- URL malformada

### PASSO 3: Fazer Login

Se o usuário já existe (meluautomacoes@gmail.com):
1. Faça login normalmente
2. Volte para a aba com o link do convite
3. Recarregue a página (F5)

**Verificar no Console do Navegador:**
- O componente deve detectar que você está logado
- Deve mostrar botão "Aceitar Convite"

### PASSO 4: Clicar em "Aceitar Convite"

**ESTE É O MOMENTO CRÍTICO!**

Clique no botão "Aceitar Convite" e **OBSERVE ATENTAMENTE** os logs.

---

## 📊 LOGS ESPERADOS NO CONSOLE DO NAVEGADOR

```javascript
🎯 [ACCEPT EXISTING] Iniciando aceite de convite
🎯 [ACCEPT EXISTING] Token: <TOKEN>
🎯 [ACCEPT EXISTING] User email: meluautomacoes@gmail.com
🎯 [ACCEPT EXISTING] Invite email: meluautomacoes@gmail.com

📤 [ACCEPT EXISTING] Request details:
   - Method: POST
   - URL: https://api.meluautomacao.com/api/invitations/<TOKEN>/accept-existing
   - Headers: {Authorization: "Bearer ...", Content-Type: "application/json"}
   - Body: {"token":"<TOKEN>"}

📥 [ACCEPT EXISTING] Response status: 200
📥 [ACCEPT EXISTING] Response headers: {...}
📥 [ACCEPT EXISTING] Response body: {message: "...", membership: {...}}

✅ [ACCEPT EXISTING] Convite aceito com sucesso!
   - Membership criada: {id: X, companyId: 1, ...}

🔄 [ACCEPT EXISTING] Redirecionando para dashboard em 1s...
🔄 [ACCEPT EXISTING] Redirecionando agora...
```

---

## 📊 LOGS ESPERADOS NO CONSOLE DO SERVIDOR

```bash
========================================
🎫 [ACCEPT EXISTING] REQUEST RECEBIDO
========================================
📍 IP: <IP_DO_CLIENT>
📍 User-Agent: <BROWSER>
📍 Token do params: <TOKEN>
📍 Body recebido: { token: '<TOKEN>' }
📍 User autenticado: {
  userId: 26,
  email: 'meluautomacoes@gmail.com',
  companyId: 2,
  companyRole: 'ADMINISTRATIVO'
}
✅ [ACCEPT EXISTING] Schema validado com sucesso

🎫 [ACCEPT EXISTING] Usuário existente aceitando convite
   - User ID: 26
   - Email: meluautomacoes@gmail.com

🔍 [ACCEPT EXISTING] Buscando convite no banco...
   - Token: abc123...

✅ [ACCEPT EXISTING] Convite encontrado no banco!
📋 [ACCEPT EXISTING] Dados do convite:
   - ID: X
   - Email convite: meluautomacoes@gmail.com
   - Empresa: 1
   - Role: OPERADOR
   - Status: pending
   - Expira em: 2025-XX-XX
   - Agora: 2025-XX-XX

🔍 [ACCEPT EXISTING] Validando email...
   - Email do convite: meluautomacoes@gmail.com
   - Email do usuário: meluautomacoes@gmail.com
   - Match: true

✅ [ACCEPT EXISTING] Email validado!

🔍 [ACCEPT EXISTING] Verificando membership existente...
   - User ID: 26
   - Company ID: 1

✅ [ACCEPT EXISTING] Nenhuma membership existente encontrada
📝 [ACCEPT EXISTING] INICIANDO CRIAÇÃO DA MEMBERSHIP...

🏗️ [ACCEPT EXISTING] Dados para criar membership:
   - userId: 26
   - companyId: 1
   - role: OPERADOR
   - isActive: true

✅ [ACCEPT EXISTING] MEMBERSHIP CRIADA COM SUCESSO!
   - Membership ID: X
   - User ID: 26
   - Company ID: 1
   - Role: OPERADOR
   - Ativo: true

🔄 [ACCEPT EXISTING] Atualizando status do convite...
   - Invitation ID: X
   - Status atual: pending
   - Novo status: accepted

✅ [ACCEPT EXISTING] CONVITE ATUALIZADO COM SUCESSO!
   - Invitation ID: X
   - Novo status: accepted

========================================
✅ [ACCEPT EXISTING] PROCESSO CONCLUÍDO COM SUCESSO!
========================================
   - Usuário: meluautomacoes@gmail.com
   - Empresa: 1
   - Membership ID: X
   - Invitation atualizada: X
========================================

📤 [ACCEPT EXISTING] Enviando resposta para o frontend...
📤 [ACCEPT EXISTING] Response body: {...}
```

---

## 🚨 CENÁRIOS DE FALHA

### CENÁRIO A: Nenhum log no servidor

**Sintoma:**
- Frontend mostra logs de envio
- Servidor **NÃO mostra** logs de recebimento

**Causa provável:**
1. **URL incorreta** - frontend está chamando endpoint errado
2. **Rota não registrada** - backend não tem o endpoint configurado
3. **CORS bloqueando** - request é bloqueado antes de chegar ao handler

**Verificar:**
```bash
# No console do navegador, aba Network:
- Request foi enviado?
- Status code recebido? (se 404 = rota não existe)
- Se CORS error = problema de configuração
- Se não aparece nada = request não saiu do navegador
```

**ANOTAR:**
- URL exata chamada pelo frontend
- Status code recebido
- Mensagem de erro exata (se houver)

---

### CENÁRIO B: Servidor recebe mas falha em alguma validação

**Sintoma:**
- Servidor mostra logs iniciais
- Para em algum ponto antes de criar membership

**Possíveis pontos de falha:**
1. ❌ Token não encontrado no banco
2. ❌ Convite com status diferente de 'pending'
3. ❌ Convite expirado
4. ❌ Email não corresponde
5. ❌ Membership já existe

**ANOTAR:**
- Última linha de log bem-sucedida
- Primeira linha de log de erro
- Valores exatos das variáveis

---

### CENÁRIO C: Erro de autenticação

**Sintoma:**
- Request é rejeitado com 401 ou 403

**Causa provável:**
- Token JWT inválido ou expirado
- Header Authorization não enviado

**Verificar no console do navegador:**
```javascript
📤 [ACCEPT EXISTING] Request details:
   - Headers: {Authorization: "Bearer <TOKEN>", ...}
```

**ANOTAR:**
- Se Authorization header existe
- Se token está presente

---

### CENÁRIO D: Request silencioso (sem erro visível)

**Sintoma:**
- Frontend mostra "sucesso"
- Nada acontece no banco
- Nenhum log no servidor

**Causa provável:**
- Frontend não está aguardando response
- Erro capturado mas não logado
- Redirecionamento interrompendo o processo

**Verificar:**
- Se toast de sucesso aparece
- Se redirecionamento acontece
- Se há erro no console (vermelho)

---

## ✅ CHECKLIST FINAL

Após executar o teste, copie e preencha:

```markdown
### RESULTADO DO TESTE

**Data/Hora:** _________________

**1. Link do convite acessado:**
URL: _________________

**2. Validação inicial (GET /api/invitations/:token):**
- [ ] Console navegador mostra logs de validação
- [ ] Status: ____
- [ ] Convite válido? Sim / Não

**3. Clique no botão "Aceitar Convite":**
- [ ] Console navegador mostra logs de aceite
- [ ] URL chamada: _________________
- [ ] Method: _________________
- [ ] Headers enviados: _________________
- [ ] Body enviado: _________________

**4. Response recebido:**
- [ ] Status code: ____
- [ ] Response body: _________________

**5. Console do servidor:**
- [ ] Servidor recebeu o request? Sim / Não
- [ ] Se sim, última linha de log bem-sucedida: _________________
- [ ] Se houve erro, mensagem: _________________

**6. Banco de dados após teste:**
```sql
SELECT * FROM invitations WHERE email = 'meluautomacoes@gmail.com' AND company_id = 1;
-- Status: _________________

SELECT * FROM memberships WHERE user_id = 26 AND company_id = 1;
-- Existe? Sim / Não
-- Se sim, role: _________________
```

**7. Evidências anexadas:**
- [ ] Screenshot do console do navegador
- [ ] Screenshot do console do servidor
- [ ] Dump do resultado das queries SQL
```

---

## 🔧 AÇÕES CORRETIVAS BASEADAS NO RESULTADO

### Se servidor NÃO recebeu request:
→ Verificar se rota está registrada no `server/routes.ts`
→ Verificar VITE_API_URL em produção
→ Verificar CORS

### Se servidor recebeu mas falhou:
→ Analisar ponto exato da falha nos logs
→ Verificar dados no banco (token, status, expiry)
→ Corrigir validação específica

### Se tudo funcionou mas banco não mudou:
→ Problema no storage.createMembership()
→ Problema no storage.updateInvitationStatus()
→ Transaction rollback silencioso

---

## 📞 SUPORTE

Se após executar este teste ainda houver dúvidas:

1. **Copie TODOS os logs** (navegador + servidor)
2. **Copie o resultado das queries SQL**
3. **Copie a URL exata** chamada pelo frontend
4. **Anexe screenshots** do console

Com essas informações, será possível identificar o problema com 100% de certeza.
