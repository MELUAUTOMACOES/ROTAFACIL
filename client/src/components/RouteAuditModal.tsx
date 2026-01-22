import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Clock, User, Plus, Minus, ArrowRightLeft, Wand2, FileDown } from 'lucide-react';
import { buildApiUrl } from "@/lib/api-config";

interface RouteAuditModalProps {
  routeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AuditEntry {
  id: number;
  routeId: string;
  userId: number;
  userName: string;
  action: string;
  description: string;
  metadata: any;
  createdAt: string;
}

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getActionIcon = (action: string) => {
  switch (action) {
    case 'add_stop':
      return <Plus className="h-5 w-5" />;
    case 'remove_stop':
      return <Minus className="h-5 w-5" />;
    case 'reorder':
      return <ArrowRightLeft className="h-5 w-5" />;
    case 'optimize':
      return <Wand2 className="h-5 w-5" />;
    case 'export_pdf':
      return <FileDown className="h-5 w-5" />;
    default:
      return <User className="h-5 w-5" />;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case 'add_stop':
      return 'bg-green-600';
    case 'remove_stop':
      return 'bg-red-600';
    case 'reorder':
      return 'bg-blue-600';
    case 'optimize':
      return 'bg-purple-600';
    case 'export_pdf':
      return 'bg-gray-600';
    default:
      return 'bg-burnt-yellow';
  }
};

export default function RouteAuditModal({ routeId, open, onOpenChange }: RouteAuditModalProps) {
  const { data: audits = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['/api/routes', routeId, 'audits'],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/routes/${routeId}/audits`));
      if (!response.ok) throw new Error('Erro ao buscar auditoria');
      return response.json();
    },
    enabled: !!routeId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Alterações</DialogTitle>
          <DialogDescription>
            Auditoria das alterações realizadas nesta rota (últimas 40 alterações)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhuma alteração registrada ainda.
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {audits.map((audit) => (
                <div
                  key={audit.id}
                  className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className={`flex-shrink-0 w-10 h-10 ${getActionColor(audit.action)} text-white rounded-full flex items-center justify-center`}>
                    {getActionIcon(audit.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-medium text-sm text-gray-900">
                        {audit.userName || `Usuário #${audit.userId}`}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(audit.createdAt)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">
                      {audit.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
