// client/src/components/forms/TempTeamForm.tsx

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { Team, Technician, Service } from "@shared/schema";
import { insertTeamSchema } from "@shared/schema";

// Schema para tipagem:
const extendedTeamSchema = insertTeamSchema.extend({
  technicianIds: insertTeamSchema.shape.name.array(),
  serviceIds: insertTeamSchema.shape.name.array(),
});

// Aqui usamos string[] pois RHF trabalha com strings em checkboxes
type TempForm = {
  name: string;
  technicianIds: string[];
  serviceIds: string[];
};

export default function TempTeamForm({
  team,
  technicians,
  services,
  existingTechIds,
  onClose,
}: {
  team?: Team;
  technicians: Technician[];
  services: Service[];
  existingTechIds: number[]; // IDs já vinculados de técnicos
  onClose: () => void;
}) {
  // Prepara defaultValues vindo das props, convertendo IDs para string
  const { register, handleSubmit, reset } = useForm<TempForm>({
    resolver: zodResolver(extendedTeamSchema),
    defaultValues: {
      name: team?.name || "",
      technicianIds: existingTechIds.map((id) => id.toString()),
      serviceIds: team?.serviceIds
        ? team.serviceIds.map((id) => id.toString())
        : [],
    },
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset automático sempre que a equipe mudar
  useEffect(() => {
    reset({
      name: team?.name || "",
      technicianIds: existingTechIds.map((id) => id.toString()),
      serviceIds: team?.serviceIds
        ? team.serviceIds.map((id) => id.toString())
        : [],
    });
  }, [team, existingTechIds, reset]);

  const onSubmit = async (data: TempForm) => {
    try {
      // Converte strings de volta para números
      const techIdsNum = data.technicianIds.map((s) => Number(s));
      const servIdsNum = data.serviceIds.map((s) => Number(s));

      // Payload para services (mantém string[])
      const payload = {
        name: data.name,
        serviceIds: servIdsNum.map(String),
      };

      // Chama API create ou update
      const res = team?.id
        ? await apiRequest("PATCH", `/api/teams/${team.id}`, payload)
        : await apiRequest("POST", "/api/teams", payload);

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Erro ao salvar");

      const teamId = team?.id || result.id;

      // Remove vínculos antigos
      const currentMembers = await fetch(
        `/api/team-members/${teamId}`,
        { headers: getAuthHeaders() }
      ).then((r) => (r.ok ? r.json() : []));

      await Promise.all(
        currentMembers.map((m: any) =>
          apiRequest("DELETE", `/api/team-members/${m.id}`)
        )
      );

      // Adiciona novos vínculos de técnicos
      await Promise.all(
        techIdsNum.map((tid) =>
          apiRequest("POST", "/api/team-members", {
            teamId,
            technicianId: tid,
          })
        )
      );

      toast({
        title: "Sucesso!",
        description: team ? "Equipe atualizada." : "Equipe criada.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      onClose();
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 p-4 max-h-[80vh] overflow-y-auto"
    >
      {/* Nome da Equipe */}
      <div>
        <label className="block mb-1 font-medium">Nome da Equipe *</label>
        <input
          {...register("name")}
          className="border p-2 w-full rounded"
        />
      </div>

      {/* Técnicos */}
      <div>
        <label className="block mb-1 font-medium">Técnicos</label>
        <div className="border rounded p-2 max-h-32 overflow-y-auto">
          {technicians.map((tech) => (
            <label
              key={tech.id}
              className="flex items-center space-x-2 mb-1"
            >
              <input
                type="checkbox"
                value={tech.id.toString()}
                {...register("technicianIds")}
              />
              <span>{tech.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Serviços */}
      <div>
        <label className="block mb-1 font-medium">Serviços</label>
        <div className="border rounded p-2 max-h-32 overflow-y-auto">
          {services.map((srv) => (
            <label
              key={srv.id}
              className="flex items-center space-x-2 mb-1"
            >
              <input
                type="checkbox"
                value={srv.id.toString()}
                {...register("serviceIds")}
              />
              <span>{srv.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-burnt-yellow text-white">
          {team ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}
