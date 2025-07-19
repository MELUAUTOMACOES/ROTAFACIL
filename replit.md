# Aplicativo de Gerenciamento de Agendamentos

## Visão Geral
Aplicativo robusto de gerenciamento de agendamentos construído com React e react-big-calendar, projetado para fornecer agendamento de eventos perfeito e visualização.

Stack:
- Frontend React com TypeScript
- react-big-calendar para agendamento
- Interface de calendário responsiva e interativa
- Manipulação e renderização de eventos personalizados
- Tailwind CSS para estilização

## Arquitetura do Projeto
- **Frontend**: React com TypeScript usando Wouter para roteamento
- **Backend**: Express.js com autenticação JWT
- **Banco de dados**: PostgreSQL com Drizzle ORM
- **Componentes UI**: shadcn/ui com Tailwind CSS
- **Formulários**: react-hook-form com validação Zod
- **Estado**: TanStack Query para gerenciamento de estado do servidor

## Mudanças Recentes

### 19 de julho de 2025 - Campo "Endereço de Início Diário" Adicionado

**Funcionalidade implementada**: Campo opcional "Endereço de Início Diário" para técnicos e equipes

**Arquivos modificados**:
1. **shared/schema.ts**:
   - Adicionado campos no schema `technicians`: `enderecoInicioCep`, `enderecoInicioLogradouro`, `enderecoInicioNumero`, `enderecoInicioComplemento`
   - Adicionado campos no schema `teams`: `enderecoInicioCep`, `enderecoInicioLogradouro`, `enderecoInicioNumero`, `enderecoInicioComplemento`
   - Criado `extendedInsertTechnicianSchema` com validações para os novos campos
   - Criado `extendedInsertTeamSchema` com validações para os novos campos

2. **client/src/components/forms/TechnicianForm.tsx**:
   - Adicionado campos de endereço de início diário no formulário
   - Atualizado valores padrão para incluir os novos campos
   - Seção visual com explicação sobre o uso na roteirização

3. **client/src/components/forms/TeamForm.tsx**:
   - Adicionado campos de endereço de início diário no formulário
   - Atualizado schema de formulário para usar `extendedInsertTeamSchema`
   - Atualizado valores padrão e funções de criação/edição

**Regras de negócio implementadas**:
- **Campo opcional**: Todos os campos de endereço de início diário são opcionais
- **Uso na roteirização**: Se preenchido, será usado como ponto de partida na roteirização
- **Fallback**: Se não preenchido, será usado o endereço padrão da empresa
- **Validação**: CEP e número têm validações específicas (formato e apenas dígitos)

**Comentários no código**: Adicionados comentários explicando que se o campo não for preenchido, a roteirização deve começar a partir do endereço padrão da empresa.

## Preferências do Usuário
- Comunicação em português
- Foco apenas no que foi solicitado, sem alterações adicionais
- Implementação direta sem complicações desnecessárias