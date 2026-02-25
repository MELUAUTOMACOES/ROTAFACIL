import { useState } from "react";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CompanyOption {
  companyId: number;
  companyRole: string;
  companyName: string;
  companyCnpj: string;
}

interface CompanySelectorProps {
  open: boolean;
  companies: CompanyOption[];
  userName: string;
  onSelect: (companyId: number) => Promise<void>;
  onCancel: () => void;
}

export default function CompanySelector({
  open,
  companies,
  userName,
  onSelect,
  onCancel,
}: CompanySelectorProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async (companyId: number) => {
    setSelectedId(companyId);
    setIsLoading(true);
    try {
      await onSelect(companyId);
    } catch {
      setIsLoading(false);
      setSelectedId(null);
    }
  };

  const formatCnpj = (cnpj: string) => {
    if (!cnpj || cnpj.length < 14) return cnpj;
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador",
    ADMINISTRATIVO: "Administrativo",
    OPERADOR: "Operador",
    admin: "Administrador",
    user: "Usuário",
    operador: "Operador",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-500" />
            Selecionar Empresa
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Olá, <span className="font-medium text-slate-300">{userName}</span>! Você possui acesso a mais de uma empresa. Selecione em qual deseja entrar:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-1">
          {companies.map((company) => (
            <button
              key={company.companyId}
              disabled={isLoading}
              onClick={() => handleSelect(company.companyId)}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left",
                selectedId === company.companyId && isLoading
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-zinc-700 bg-zinc-800/50 hover:border-amber-500/50 hover:bg-zinc-800",
                isLoading && selectedId !== company.companyId && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{company.companyName}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {company.companyCnpj && (
                      <span>{formatCnpj(company.companyCnpj)}</span>
                    )}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-700 text-slate-300 text-[10px] font-medium uppercase">
                      {roleLabels[company.companyRole] || company.companyRole}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                {selectedId === company.companyId && isLoading ? (
                  <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-white"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
