# Sistema de Agendamentos RotaFácil

## Visão Geral
Sistema completo de gestão de agendamentos técnicos com funcionalidades avançadas de otimização de rotas.

## Funcionalidades Implementadas Recentemente

### Seleção de Agendamentos e Otimização de Rotas
- **Checkbox individual**: Cada agendamento possui um checkbox para seleção
- **Checkbox "Selecionar Todos"**: Permite selecionar/desmarcar todos os agendamentos visíveis
- **Botão "Otimizar Rotas"**: Aparece apenas quando há mais de 1 agendamento selecionado
- **Drawer lateral**: Painel lateral direito que mostra a rota otimizada
- **Simulação de dados**: Distância total e tempo estimado são simulados
- **Destaque visual**: Agendamentos selecionados ficam destacados com borda amarela

### Como Acessar
1. Faça login no sistema através do botão "Acessar Sistema"
2. Navegue para a página "Agendamentos" no menu lateral
3. Selecione agendamentos usando os checkboxes
4. Clique em "Otimizar Rotas" para ver o drawer com a rota otimizada

## Arquitetura do Projeto

### Frontend
- **React** com TypeScript
- **Tailwind CSS** para estilização
- **Shadcn/ui** para componentes
- **Wouter** para roteamento
- **TanStack Query** para gerenciamento de estado de servidor

### Backend
- **Express.js** com TypeScript
- **Drizzle ORM** para banco de dados
- **PostgreSQL** como banco de dados
- **Autenticação JWT** com sessões

### Páginas Principais
- `/` - Landing page (RotaFácil)
- `/login` - Página de login
- `/dashboard` - Dashboard principal
- `/appointments` - **Página de agendamentos (onde está a funcionalidade implementada)**
- `/routes` - Otimização de rotas
- `/clients` - Gestão de clientes
- `/technicians` - Gestão de técnicos
- `/services` - Gestão de serviços

## Mudanças Recentes
- **2025-01-18**: Implementado sistema de seleção de agendamentos com checkboxes
- **2025-01-18**: Adicionado botão "Otimizar Rotas" com funcionalidade condicional
- **2025-01-18**: Criado drawer lateral para exibir rota otimizada
- **2025-01-18**: Implementado destaque visual para agendamentos selecionados
- **2025-01-18**: Adicionado simulação de dados de distância e tempo

## Preferências do Usuário
- Idioma: Português Brasileiro
- Interface: Intuitiva e responsiva
- Funcionalidades: Foco em otimização de rotas e gestão de agendamentos
- Dados: Simulados para demonstração (conforme solicitado)

## Estado Atual
✅ Sistema de seleção de agendamentos implementado e funcional
✅ Drawer de otimização de rotas implementado
✅ Integração com dados existentes
✅ Interface responsiva e intuitiva