# ⏸️ PENDÊNCIA: CSV Import/Export com Múltiplos Endereços

**Status:** Pendente (não incluído na entrega atual)  
**Data de Registro:** 03/04/2026  
**Motivo:** Reduzir escopo e risco de regressão após implementação principal

---

## 📋 Contexto

As Fases 1-5 da implementação de múltiplos endereços por cliente foram concluídas com sucesso:

✅ **Fase 1** - Schema + Migration  
✅ **Fase 2** - Backend (dual-read, rotas CRUD)  
✅ **Fase 3** - Frontend Cliente (AddressCard, ClientForm, Clients.tsx)  
✅ **Fase 4** - AppointmentForm (snapshot com seletor)  
✅ **Fase 5** - FindDate (busca de datas com seletor)

**CSV Import/Export foi deixado como melhoria separada** para evitar aumentar o escopo e permitir testes adequados do fluxo principal antes de mexer na importação/exportação.

---

## 🎯 Objetivo Futuro

Atualizar a funcionalidade de importação e exportação CSV de clientes para suportar múltiplos endereços.

---

## 📂 Arquivos Afetados

**`client/src/pages/Clients.tsx`**
- Função `handleImportCSV` (linhas ~124-250)
- Função `exportToCSV` (linhas ~340-367)

---

## 🔧 Direção Técnica Inicial (Conservadora)

### Importação CSV

**Estratégia:** Manter formato atual, 1 endereço por linha

```csv
nome,cpf,email,telefone1,telefone2,cep,logradouro,numero,complemento,bairro,cidade,observacoes
Empresa ABC,12345678000190,contato@abc.com,(41) 99999-9999,,80000-000,Rua Principal,100,Sala 5,Centro,Curitiba,Cliente VIP
```

**Comportamento:**
- Cada linha do CSV cria **1 cliente** com **1 endereço**
- Endereço importado é marcado como **principal** (`isPrimary: true`)
- Label do endereço: `"Endereço Principal"` ou deixar vazio
- Backend cria registro em `client_addresses` automaticamente
- Campos legados da tabela `clients` são sincronizados (compatibilidade temporária)

**Validações:**
- CEP obrigatório
- Campos de endereço obrigatórios: `logradouro`, `numero`, `bairro`, `cidade`
- Estado (`uf`) será buscado via CEP ou deixado vazio se falhar

**Vantagens:**
- ✅ Zero mudança no formato do CSV atual
- ✅ Usuários não precisam aprender novo formato
- ✅ Compatibilidade total com CSV existente
- ✅ Sem risco de quebrar importações antigas

**Limitação:**
- ❌ Não permite importar múltiplos endereços por cliente no mesmo CSV

---

### Exportação CSV

**Estratégia:** Exportar apenas endereço principal

```csv
nome,cpf,email,telefone1,telefone2,cep,logradouro,numero,complemento,bairro,cidade,observacoes
Empresa XYZ,98765432000199,contato@xyz.com,(41) 88888-8888,,80010-000,Av Secundária,200,,Batel,Curitiba,
```

**Comportamento:**
- Buscar `primaryAddress` de cada cliente
- Se cliente tiver múltiplos endereços, exportar **apenas o principal**
- Se cliente for legado (sem `client_addresses`), usar campos legados (`client.cep`, `client.logradouro`, etc)
- Formato do CSV permanece idêntico ao atual

**Vantagens:**
- ✅ Compatibilidade com ferramentas externas que esperam 1 endereço por linha
- ✅ CSV exportado pode ser reimportado sem problemas
- ✅ Sem mudança de formato

**Limitação:**
- ❌ Endereços secundários não são exportados
- ℹ️ Usuário precisa saber que apenas o endereço principal sai no CSV

---

## 🚀 Alternativa Futura (Avançada)

Se houver demanda por exportar **todos os endereços**, considerar:

### Opção 1: Múltiplas Linhas por Cliente

```csv
nome,cpf,email,telefone1,telefone2,cep,logradouro,numero,complemento,bairro,cidade,endereco_label,endereco_principal,observacoes
Empresa ABC,12345678000190,contato@abc.com,(41) 99999-9999,,80000-000,Rua Principal,100,Sala 5,Centro,Curitiba,Matriz,SIM,Cliente VIP
Empresa ABC,12345678000190,,,,,80010-000,Av Secundária,200,,Batel,Curitiba,Filial Norte,NÃO,
```

**Vantagens:**
- ✅ Todos os endereços exportados
- ✅ Estrutura tabular padrão

**Desvantagens:**
- ❌ Duplicação de dados do cliente
- ❌ Importação fica mais complexa (agrupar por CPF)

### Opção 2: Colunas Adicionais por Endereço

```csv
nome,cpf,email,telefone1,telefone2,cep1,logradouro1,numero1,complemento1,bairro1,cidade1,label1,cep2,logradouro2,numero2,...
```

**Vantagens:**
- ✅ 1 linha = 1 cliente

**Desvantagens:**
- ❌ CSV muito largo (até 5 endereços × ~8 campos = +40 colunas)
- ❌ Difícil de editar manualmente
- ❌ Incompatível com CSV atual

### Opção 3: CSV Separado de Endereços

Dois arquivos:
- `clientes.csv` (dados do cliente)
- `enderecos.csv` (cpf, label, cep, logradouro, numero, ...)

**Vantagens:**
- ✅ Normalizado
- ✅ Fácil de importar programaticamente

**Desvantagens:**
- ❌ Dois arquivos para gerenciar
- ❌ Usuário precisa vincular manualmente

---

## 📝 Notas de Implementação Futura

Quando for implementar:

1. **Backend já está pronto** para receber múltiplos endereços via API
2. **Importação:** Adaptar parsing do CSV em `handleImportCSV` para criar payload com `addresses` array
3. **Exportação:** Usar `primaryAddress` do dual-read ou campos legados como fallback
4. **Validações:** Reaproveitar schemas existentes (`insertClientAddressSchema`)
5. **Testes:** Garantir que CSV antigo continua funcionando

---

## ✅ Quando Implementar

- **Prioridade:** Baixa (fluxo manual de cadastro já funciona)
- **Gatilho:** Demanda de usuários por importação em massa
- **Pré-requisito:** Fases 1-5 testadas e estáveis em produção

---

## 🔗 Referências

- Implementação atual: `client/src/pages/Clients.tsx` (linhas 124-367)
- Backend de clientes: `server/routes.ts` (rotas POST/PUT `/api/clients`)
- Schema de endereços: `shared/schema.ts` (`insertClientAddressSchema`)
