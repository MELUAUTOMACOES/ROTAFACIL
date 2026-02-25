import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

/**
 * Cabeçalho padronizado de seção para páginas do Rota Fácil.
 * Exibe título + descrição opcional à esquerda e botões de ação à direita.
 * Não duplica o título já exibido pelo TopBar.
 */
export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="p-2 bg-burnt-yellow rounded-lg shrink-0">
            <span className="[&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-white">{icon}</span>
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 truncate">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
