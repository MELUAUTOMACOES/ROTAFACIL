import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { AccessSchedule } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface TimeWindow {
  start: string;
  end: string;
}

interface WeekSchedule {
  monday: TimeWindow[];
  tuesday: TimeWindow[];
  wednesday: TimeWindow[];
  thursday: TimeWindow[];
  friday: TimeWindow[];
  saturday: TimeWindow[];
  sunday: TimeWindow[];
}

const dayNames: Record<keyof WeekSchedule, string> = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo'
};

interface AccessScheduleFormProps {
  schedule?: AccessSchedule | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AccessScheduleForm({ schedule, onSuccess, onCancel }: AccessScheduleFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [schedules, setSchedules] = useState<WeekSchedule>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  });

  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setSchedules(schedule.schedules as WeekSchedule);
    }
  }, [schedule]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = schedule 
        ? `/api/access-schedules/${schedule.id}`
        : "/api/access-schedules";
      
      const response = await fetch(url, {
        method: schedule ? "PUT" : "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao salvar tabela de horário");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: schedule 
          ? "Tabela de horário atualizada com sucesso!"
          : "Tabela de horário criada com sucesso!",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Erro de validação",
        description: "Nome da tabela é obrigatório",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate({
      name,
      schedules
    });
  };

  const addTimeWindow = (day: keyof WeekSchedule) => {
    setSchedules(prev => ({
      ...prev,
      [day]: [...prev[day], { start: "08:00", end: "18:00" }]
    }));
  };

  const removeTimeWindow = (day: keyof WeekSchedule, index: number) => {
    setSchedules(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index)
    }));
  };

  const updateTimeWindow = (day: keyof WeekSchedule, index: number, field: 'start' | 'end', value: string) => {
    setSchedules(prev => ({
      ...prev,
      [day]: prev[day].map((window, i) => 
        i === index ? { ...window, [field]: value } : window
      )
    }));
  };

  const copyToAllDays = (sourceDay: keyof WeekSchedule) => {
    const sourceWindows = schedules[sourceDay];
    setSchedules({
      monday: [...sourceWindows],
      tuesday: [...sourceWindows],
      wednesday: [...sourceWindows],
      thursday: [...sourceWindows],
      friday: [...sourceWindows],
      saturday: [...sourceWindows],
      sunday: [...sourceWindows]
    });
    toast({
      title: "Horários copiados",
      description: `Horários de ${dayNames[sourceDay]} copiados para todos os dias`,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da Tabela *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Comercial, 24/7, Plantão..."
          required
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Horários por Dia da Semana</h3>
        <p className="text-sm text-muted-foreground">
          Configure os horários permitidos para acesso em cada dia da semana.
          Se nenhum horário for definido para um dia, o acesso não será permitido nesse dia.
        </p>

        {(Object.keys(dayNames) as Array<keyof WeekSchedule>).map((day) => (
          <Card key={day}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{dayNames[day]}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addTimeWindow(day)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Horário
                  </Button>
                  {schedules[day].length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToAllDays(day)}
                    >
                      Copiar para Todos
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {schedules[day].length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum horário configurado (acesso bloqueado)</p>
              ) : (
                schedules[day].map((window, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        type="time"
                        value={window.start}
                        onChange={(e) => updateTimeWindow(day, index, 'start', e.target.value)}
                        required
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={window.end}
                        onChange={(e) => updateTimeWindow(day, index, 'end', e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTimeWindow(day, index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : schedule ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}
