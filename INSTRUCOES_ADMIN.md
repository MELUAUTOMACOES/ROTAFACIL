# 🔧 Como Configurar seu Usuário como Administrador

## Problema
- Menu "Gestão de Usuários" não aparece
- Erro ao tentar criar usuário: "preciso ser administrador"

## Causa
Seu usuário está com `role = 'user'` no banco. Precisa ser `'admin'`.

## Solução

### Opção 1: Via Drizzle Studio (Recomendado)

```bash
# Abrir interface visual do banco
pnpm drizzle-kit studio
```

1. Acesse: http://localhost:4983
2. Vá na tabela `users`
3. Encontre seu usuário (lucaspmastaler@gmail.com)
4. Edite os campos:
   - `role`: mude de "user" para "admin"
   - `email_verified`: marque como `true`
5. Salve

### Opção 2: Via SQL Manual

**Use qualquer ferramenta de SQL que você tenha instalada:**

**pgAdmin / DBeaver / Outro client:**
```sql
-- Configurar como admin
UPDATE users 
SET role = 'admin', 
    email_verified = true,
    require_password_change = false
WHERE email = 'lucaspmastaler@gmail.com';

-- Verificar
SELECT id, name, email, role, email_verified 
FROM users 
WHERE email = 'lucaspmastaler@gmail.com';
```

### Opção 3: Via Replit Database

Se estiver no Replit:
1. Vá em "Tools" → "Database"
2. Execute o SQL acima

## ✅ Depois de Atualizar o Banco

**IMPORTANTE:**

1. **Faça LOGOUT** do sistema
2. **Faça LOGIN** novamente
3. O menu "Gestão de Usuários" 🛡️ deve aparecer no menu lateral

## 🔍 Como Verificar se Funcionou

Após fazer login novamente:

1. ✅ Menu lateral deve mostrar "Gestão de Usuários" (último item)
2. ✅ Ícone de escudo (🛡️) ao lado
3. ✅ Ao clicar, abre tela de gestão
4. ✅ Botão "Novo Usuário" funciona sem erro

## 🐛 Se Ainda Não Funcionar

### Verificar no Console do Navegador (F12):

```javascript
// Verificar dados do usuário atual
const authData = localStorage.getItem('auth');
console.log(JSON.parse(authData));

// Deve mostrar: role: "admin"
```

### Forçar Limpeza:

```javascript
// Console do navegador (F12)
localStorage.clear();
// Depois recarregue a página e faça login
```

## 📊 Estrutura Esperada

Seu usuário no banco deve estar assim:

```
| id | email                    | role  | email_verified | require_password_change |
|----|--------------------------|-------|----------------|-------------------------|
| 1  | lucaspmastaler@gmail.com | admin | true           | false                   |
```

## 🎯 Próximos Passos

Após se tornar admin:

1. ✅ Acesse "Gestão de Usuários"
2. ✅ Crie novos usuários
3. ✅ Defina quem é admin e quem é user
4. ✅ Gerencie status ativo/inativo

---

**Qualquer dúvida, me avise!** 🚀
