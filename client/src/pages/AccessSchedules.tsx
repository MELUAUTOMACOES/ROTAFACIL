import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Clock } from "lucide-react";
import { useSafeNavigation } from "@/hooks/useSafeNavigation";
import type { AccessSchedule } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AccessScheduleForm from "@/components/forms/AccessScheduleForm";

export default function AccessSchedules() {
  const [selectedSchedule, setSelectedSchedule] = useState<AccessSchedule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<AccessSchedule | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hook de navegação segura
  const { isSafeToOperate } = useSafeNavigation({
    componentName: 'ACCESS_SCHEDULES',
    modals: [
      {
        isOpen: isFormOpen,
        setIsOpen: setIsFormOpen,
        resetState: () => setSelectedSchedule(null)
      }
    ]
  });

  // Query para buscar tabelas de horário
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["/api/access-schedules"],
    queryFn: async () => {
      const response = await fetch("/api/access-schedules", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Erro ao carregar tabelas de horário');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Mutation para deletar tabela de horário
  const deleteMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const response = await fetch(`/api/access-schedules/${scheduleId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao deletar tabela de horário');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-schedules"] });
      toast({
        title: "Tabela deletada",
        description: "A tabela de horário foi removida com sucesso.",
      });
      setScheduleToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (schedule: AccessSchedule) => {
    setSelectedSchedule(schedule);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setSelectedSchedule(null);
    setIsFormOpen(true);
  };

  const handleDelete = (schedule: AccessSchedule) => {
    setScheduleToDelete(schedule);
  };

  const confirmDelete = () => {
    if (scheduleToDelete) {
      deleteMutation.mutate(scheduleToDelete.id);
    }
  };

  const formatTimeWindow = (schedules: any) => {
    const dayNames: Record<string, string> = {
      monday: 'Segunda',
      tuesday: 'Terça',
      wednesday: 'Quarta',
      thursday: 'Quinta',
      friday: 'Sexta',
      saturday: 'Sábado',
      sunday: 'Domingo'
    };

    const summary = [];
    for (const [day, windows] of Object.entries(schedules)) {
      if (Array.isArray(windows) && windows.length > 0) {
        const times = windows.map((w: any) => `${w.start}-${w.end}`).join(', ');
        summary.push(`${dayNames[day]}: ${times}`);
      }
    }

    return summary.length > 0 ? summary.join(' | ') : 'Nenhum horário configurado';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Tabelas de Horário de Acesso
          </CardTitle>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Tabela
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedSchedule ? 'Editar Tabela de Horário' : 'Nova Tabela de Horário'}
                </DialogTitle>
              </DialogHeader>
              <AccessScheduleForm
                schedule={selectedSchedule}
                onSuccess={() => {
                  setIsFormOpen(false);
                  setSelectedSchedule(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/access-schedules"] });
                }}
                onCancel={() => {
                  setIsFormOpen(false);
                  setSelectedSchedule(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando tabelas...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma tabela de horário cadastrada ainda.
              <p className="text-sm mt-2">
                Crie tabelas de horário para controlar quando os usuários podem acessar a plataforma.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule: AccessSchedule) => (
                <Card key={schedule.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{schedule.name}</h3>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          {formatTimeWindow(schedule.schedules)}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Criado em: {new Date(schedule.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(schedule)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(schedule)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!scheduleToDelete} onOpenChange={() => setScheduleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tabela de horário <strong>{scheduleToDelete?.name}</strong>?
              Os usuários que utilizam esta tabela não terão mais restrição de horário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
