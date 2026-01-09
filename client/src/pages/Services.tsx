import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { normalizeItems } from "@/lib/normalize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ServiceForm from "@/components/forms/ServiceForm";
import { Plus, Wrench, Clock, DollarSign, Edit, Trash2, FileText, Award, Search as SelectIcon, ClipboardList } from "lucide-react";
import { useSafeNavigation } from "@/hooks/useSafeNavigation";
import type { Service } from "@shared/schema";

export default function Services() {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hook de navegação segura
  const { isSafeToOperate } = useSafeNavigation({
    componentName: 'SERVICES',
    modals: [
      {
        isOpen: isFormOpen,
        setIsOpen: setIsFormOpen,
        resetState: () => { setSelectedService(null); setSearchTerm(""); }
      }
    ]
  });

  const { data: servicesData, isLoading } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch("/api/services?page=1&pageSize=50", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Erro ao carregar serviços");
      return response.json();
    },
    staleTime: 5 * 60_000, // 5 minutos - serviços raramente mudam
    refetchOnWindowFocus: false,
  });
  const services = normalizeItems<Service>(servicesData);

  // Filtragem de serviços
  const filteredServices = services.filter((service: Service) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      service.name.toLowerCase().includes(searchLower) ||
      service.description?.toLowerCase().includes(searchLower)
    );
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/services/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Sucesso",
        description: "Serviço excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir serviço",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (service: Service) => {
    setSelectedService(service);
    setIsFormOpen(true);
  };

  const handleDelete = async (service: Service) => {
    if (confirm(`Tem certeza que deseja excluir o serviço "${service.name}"?`)) {
      deleteServiceMutation.mutate(service.id);
    }
  };

  const handleFormClose = () => {
    // Usa hook seguro para verificar se é seguro operar
    if (!isSafeToOperate()) {
      console.log('⚠️ [SERVICES] Componente desmontado, operação cancelada');
      return;
    }

    setIsFormOpen(false);
    setSelectedService(null);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${mins}min`;
  };

  const formatPrice = (price: string | null) => {
    if (!price) return "Não definido";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(parseFloat(price));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Serviços</h1>
          <p className="text-gray-600 dark:text-zinc-400">Gerencie os tipos de serviços oferecidos</p>
        </div>

        <Button
          className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
          onClick={() => {
            setSelectedService(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      {/* Search Filter */}
      <Card className="p-4 bg-white">
        <div className="relative">
          <SelectIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-yellow focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {/* Services List */}
      {filteredServices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-2">
              {searchTerm ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
            </h3>
            <p className="text-gray-600 text-center mb-6">
              {searchTerm
                ? "Tente buscar com outros termos."
                : "Cadastre os serviços que sua empresa oferece para utilizá-los nos agendamentos."}
            </p>
            {!searchTerm && (
              <Button
                className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                onClick={() => {
                  setSelectedService(null);
                  setIsFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Serviço
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service: Service) => (
            <Card key={service.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(service)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(service)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4 h-10 line-clamp-2">
                  {service.description || "Sem descrição"}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center">
                      <Clock className="h-4 w-4 mr-1" /> Duração
                    </span>
                    <span className="font-medium">{service.duration} min</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" /> Preço
                    </span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(Number(service.price) || 0)}
                    </span>
                  </div>

                  {service.points && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Pontos/Remuneração</span>
                      <span className="font-medium">{service.points}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Centralized Dialog for All Service Forms */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <ServiceForm
            service={selectedService}
            onClose={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
