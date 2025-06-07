import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import AppointmentForm from "@/components/forms/AppointmentForm";
import { Plus, Calendar, MapPin, Clock, User, Edit, Trash2, Download, Upload } from "lucide-react";
import type { Appointment, Client, Service, Technician } from "@shared/schema";

export default function Appointments() {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: async () => {
      const response = await fetch("/api/appointments", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch("/api/services", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await fetch("/api/technicians", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Sucesso",
        description: "Agendamento excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir agendamento",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsFormOpen(true);
  };

  const handleDelete = async (appointment: Appointment) => {
    if (confirm("Tem certeza que deseja excluir este agendamento?")) {
      deleteAppointmentMutation.mutate(appointment.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedAppointment(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluído";
      case "in_progress":
        return "Em Andamento";
      case "scheduled":
        return "Agendado";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "normal":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "Urgente";
      case "high":
        return "Alta";
      case "normal":
        return "Normal";
      default:
        return priority;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getClient = (clientId: number | null) => clientId ? clients.find((c: Client) => c.id === clientId) : null;
  const getService = (serviceId: number) => services.find((s: Service) => s.id === serviceId);
  const getTechnician = (technicianId: number | null) => technicianId ? technicians.find((t: Technician) => t.id === technicianId) : null;

  const importCSVMutation = useMutation({
    mutationFn: async (appointments: any[]) => {
      const response = await apiRequest("POST", "/api/appointments/import", { appointments });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      
      // Log detalhado dos resultados do backend
      console.group("📊 RESULTADO DA IMPORTAÇÃO NO BACKEND");
      console.log(`✅ Sucessos: ${data.success}`);
      console.log(`❌ Erros: ${data.errors}`);
      
      if (data.detailedErrors && data.detailedErrors.length > 0) {
        console.log("\n📋 Erros detalhados do servidor:");
        data.detailedErrors.forEach((error: string, index: number) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }
      
      if (data.processedItems) {
        console.log(`\n📈 Itens processados: ${data.processedItems.length}`);
        const successItems = data.processedItems.filter((item: any) => item.status === 'success');
        const errorItems = data.processedItems.filter((item: any) => item.status === 'error');
        console.log(`   • Sucessos: ${successItems.length}`);
        console.log(`   • Erros: ${errorItems.length}`);
      }
      console.groupEnd();
      
      // Toast com resultado
      if (data.errors > 0) {
        const errorMessage = data.detailedErrors ? 
          data.detailedErrors.slice(0, 2).join('\n') + 
          (data.detailedErrors.length > 2 ? `\n... e mais ${data.detailedErrors.length - 2} erros` : '') : 
          `${data.errors} erros encontrados`;
          
        toast({
          title: `Importação parcial: ${data.success} sucessos, ${data.errors} erros`,
          description: errorMessage,
          variant: "destructive",
        });
        
        // Gerar relatório de erros do backend se houver
        if (data.detailedErrors && data.detailedErrors.length > 0) {
          const backendErrorReport = [
            "RELATÓRIO DE ERROS - PROCESSAMENTO NO SERVIDOR",
            "=" + "=".repeat(50),
            "",
            `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
            "",
            "RESUMO:",
            "-".repeat(20),
            `Total processado: ${data.success + data.errors}`,
            `Sucessos: ${data.success}`,
            `Erros: ${data.errors}`,
            `Taxa de sucesso: ${((data.success / (data.success + data.errors)) * 100).toFixed(1)}%`,
            "",
            "ERROS DO SERVIDOR:",
            "-".repeat(40),
            ...data.detailedErrors.map((error: string, index: number) => `${index + 1}. ${error}`),
          ].join('\n');

          const backendLogBlob = new Blob([backendErrorReport], { type: "text/plain;charset=utf-8;" });
          const backendLogLink = document.createElement("a");
          const backendLogUrl = URL.createObjectURL(backendLogBlob);
          backendLogLink.setAttribute("href", backendLogUrl);
          backendLogLink.setAttribute("download", `relatorio_servidor_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '')}.txt`);
          backendLogLink.style.visibility = "hidden";
          document.body.appendChild(backendLogLink);
          
          setTimeout(() => {
            if (confirm("Deseja baixar o relatório de erros do servidor?")) {
              backendLogLink.click();
            }
            document.body.removeChild(backendLogLink);
          }, 1500);
        }
      } else {
        toast({
          title: "Sucesso",
          description: `${data.success} agendamentos importados com sucesso!`,
        });
      }
    },
    onError: (error: any) => {
      console.error("❌ Erro na comunicação com o servidor:", error);
      toast({
        title: "Erro de comunicação",
        description: error.message || "Erro ao conectar com o servidor",
        variant: "destructive",
      });
    },
  });

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const csv = event.target?.result as string;
            const lines = csv.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
              toast({
                title: "Erro",
                description: "Arquivo CSV deve conter pelo menos uma linha de dados",
                variant: "destructive",
              });
              return;
            }

            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const appointmentsToImport = [];
            const errors = [];

            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
              
              if (values.length < headers.length) continue;

              const clientName = values[1];
              const serviceName = values[5];
              const technicianName = values[6];
              const dateTime = values[7];
              const cep = values[10];
              const logradouro = values[11];
              const numero = values[12];

              // Validar campos obrigatórios e formatos
              const validationErrors = [];
              const phone1 = values[3];
              
              // Validar campos obrigatórios
              if (!clientName) validationErrors.push("Cliente (coluna 2) está vazio");
              if (!phone1) validationErrors.push("Telefone 1 (coluna 4) está vazio");
              if (!serviceName) validationErrors.push("Serviço (coluna 6) está vazio");
              if (!dateTime) validationErrors.push("Data/Hora (coluna 8) está vazia");
              if (!cep) validationErrors.push("CEP (coluna 11) está vazio");
              if (!numero) validationErrors.push("Número (coluna 13) está vazio");
              
              // Validar formato do CEP
              if (cep && !/^\d{5}-?\d{3}$/.test(cep)) {
                validationErrors.push(`CEP "${cep}" inválido (formato esperado: XXXXX-XXX)`);
              }
              
              // Validar se o número é numérico
              if (numero && isNaN(Number(numero))) {
                validationErrors.push(`Número "${numero}" deve ser numérico`);
              }
              
              if (validationErrors.length > 0) {
                errors.push(`Linha ${i + 1}: ${validationErrors.join("; ")}`);
                continue;
              }

              // Encontrar cliente ou preparar dados para criação automática
              let client = clients.find((c: Client) => c.name.toLowerCase() === clientName.toLowerCase());
              let clientData = null;
              
              if (!client) {
                // Preparar dados do cliente para criação automática
                clientData = {
                  name: clientName,
                  email: values[2] || "",
                  phone1: phone1,
                  phone2: values[4] || "",
                  cep: cep,
                  logradouro: logradouro,
                  numero: numero,
                  complemento: values[13] || "",
                  notes: `Cliente criado automaticamente via importação CSV em ${new Date().toLocaleString('pt-BR')}`
                };
              }

              // Encontrar serviço
              const service = services.find((s: Service) => s.name.toLowerCase() === serviceName.toLowerCase());
              if (!service) {
                errors.push(`Linha ${i + 1}: Serviço "${serviceName}" não encontrado`);
                continue;
              }

              // Encontrar técnico (opcional)
              const technician = technicians.find((t: Technician) => t.name.toLowerCase() === technicianName.toLowerCase());

              // Validar e converter data com múltiplos formatos
              let scheduledDate;
              try {
                // Tentar diferentes formatos de data
                let dateObj;
                
                // Formato ISO (YYYY-MM-DD HH:MM:SS)
                if (/^\d{4}-\d{2}-\d{2}/.test(dateTime)) {
                  dateObj = new Date(dateTime);
                }
                // Formato brasileiro (DD/MM/YYYY HH:MM)
                else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateTime)) {
                  const [datePart, timePart = "00:00"] = dateTime.split(" ");
                  const [day, month, year] = datePart.split("/");
                  dateObj = new Date(`${year}-${month}-${day} ${timePart}`);
                }
                // Formato americano (MM/DD/YYYY HH:MM)
                else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateTime)) {
                  dateObj = new Date(dateTime);
                }
                else {
                  dateObj = new Date(dateTime);
                }
                
                if (isNaN(dateObj.getTime())) {
                  throw new Error("Data inválida");
                }
                
                // Verificar se a data não é muito antiga (antes de 2020) ou muito futura (depois de 2030)
                const year = dateObj.getFullYear();
                if (year < 2020 || year > 2030) {
                  errors.push(`Linha ${i + 1}: Data "${dateTime}" fora do intervalo válido (2020-2030)`);
                  continue;
                }
                
                scheduledDate = dateObj.toISOString();
              } catch {
                errors.push(`Linha ${i + 1}: Data/hora "${dateTime}" inválida. Formatos aceitos: YYYY-MM-DD HH:MM, DD/MM/YYYY HH:MM`);
                continue;
              }

              appointmentsToImport.push({
                clientId: client?.id || null,
                clientData: clientData, // Dados para criar cliente se necessário
                serviceId: service.id,
                technicianId: technician?.id || null,
                scheduledDate,
                status: values[8] || "scheduled",
                priority: values[9] || "normal",
                cep,
                logradouro,
                numero,
                complemento: values[13] || "",
                notes: values[14] || ""
              });
            }

            if (errors.length > 0) {
              // Criar um relatório detalhado de erros
              const errorReport = {
                totalLines: lines.length - 1,
                validAppointments: appointmentsToImport.length,
                errorCount: errors.length,
                errors: errors
              };

              // Mostrar primeiros 3 erros no toast
              const shortErrorMessage = errors.slice(0, 3).join('\n') + 
                (errors.length > 3 ? `\n... e mais ${errors.length - 3} erros` : '');
              
              toast({
                title: `${errors.length} erros encontrados na importação`,
                description: shortErrorMessage,
                variant: "destructive",
              });
              
              // Log detalhado no console
              console.group("📋 RELATÓRIO DETALHADO DE IMPORTAÇÃO CSV");
              console.log(`📊 Resumo:`);
              console.log(`   • Total de linhas processadas: ${errorReport.totalLines}`);
              console.log(`   • Agendamentos válidos: ${errorReport.validAppointments}`);
              console.log(`   • Erros encontrados: ${errorReport.errorCount}`);
              console.log(`   • Taxa de sucesso: ${((errorReport.validAppointments / errorReport.totalLines) * 100).toFixed(1)}%`);
              console.log("\n📝 LISTA COMPLETA DE ERROS:");
              errorReport.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
              });
              console.log("\n💡 DICAS PARA CORREÇÃO:");
              console.log("   • Verifique se os nomes de clientes, serviços e técnicos estão exatamente como cadastrados");
              console.log("   • Formato de data aceito: YYYY-MM-DD HH:MM:SS ou DD/MM/YYYY HH:MM");
              console.log("   • CEP deve estar no formato XXXXX-XXX");
              console.log("   • Campos obrigatórios não podem estar vazios");
              console.log("\n📋 ORDEM DOS CAMPOS NO CSV:");
              console.log("   1. ID | 2. Cliente | 3. Email Cliente | 4. Telefone 1 | 5. Telefone 2");
              console.log("   6. Serviço | 7. Técnico | 8. Data/Hora | 9. Status | 10. Prioridade");
              console.log("   11. CEP | 12. Logradouro | 13. Número | 14. Complemento | 15. Observações");
              console.groupEnd();

              // Criar arquivo de log para download
              const logContent = [
                "RELATÓRIO DE ERROS - IMPORTAÇÃO CSV",
                "=" + "=".repeat(40),
                "",
                `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
                `Arquivo processado: ${file.name}`,
                "",
                "RESUMO:",
                `-".repeat(20)`,
                `Total de linhas: ${errorReport.totalLines}`,
                `Agendamentos válidos: ${errorReport.validAppointments}`,
                `Erros encontrados: ${errorReport.errorCount}`,
                `Taxa de sucesso: ${((errorReport.validAppointments / errorReport.totalLines) * 100).toFixed(1)}%`,
                "",
                "ERROS DETALHADOS:",
                "-".repeat(40),
                ...errorReport.errors.map((error, index) => `${index + 1}. ${error}`),
                "",
                "DICAS PARA CORREÇÃO:",
                "-".repeat(40),
                "• Verifique se os nomes de clientes, serviços e técnicos estão exatamente como cadastrados no sistema",
                "• Formato de data aceito: YYYY-MM-DD HH:MM:SS ou DD/MM/YYYY HH:MM",
                "• CEP deve estar no formato XXXXX-XXX",
                "• Campos obrigatórios não podem estar vazios",
                "• Use apenas caracteres válidos (evite caracteres especiais nos nomes)",
                "",
                "ORDEM DOS CAMPOS NO CSV:",
                "-".repeat(40),
                "1. ID | 2. Cliente | 3. Email Cliente | 4. Telefone 1 | 5. Telefone 2",
                "6. Serviço | 7. Técnico | 8. Data/Hora | 9. Status | 10. Prioridade", 
                "11. CEP | 12. Logradouro | 13. Número | 14. Complemento | 15. Observações",
                "",
                "OBSERVAÇÃO: Use o botão 'Baixar CSV Modelo' para obter um arquivo com a estrutura correta."
              ].join('\n');

              const logBlob = new Blob([logContent], { type: "text/plain;charset=utf-8;" });
              const logLink = document.createElement("a");
              const logUrl = URL.createObjectURL(logBlob);
              logLink.setAttribute("href", logUrl);
              logLink.setAttribute("download", `relatorio_erros_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '')}.txt`);
              logLink.style.visibility = "hidden";
              document.body.appendChild(logLink);
              
              // Perguntar se o usuário quer baixar o relatório
              setTimeout(() => {
                if (confirm("Deseja baixar um relatório detalhado dos erros encontrados?")) {
                  logLink.click();
                }
                document.body.removeChild(logLink);
              }, 1000);
            }

            if (appointmentsToImport.length > 0) {
              importCSVMutation.mutate(appointmentsToImport);
            } else {
              toast({
                title: "Erro",
                description: "Nenhum agendamento válido encontrado no arquivo",
                variant: "destructive",
              });
            }

          } catch (error) {
            toast({
              title: "Erro",
              description: "Erro ao processar arquivo CSV",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const downloadCSVTemplate = () => {
    const templateHeaders = [
      "ID",
      "Cliente", 
      "Email Cliente",
      "Telefone 1",
      "Telefone 2", 
      "Serviço",
      "Técnico",
      "Data/Hora",
      "Status",
      "Prioridade",
      "CEP",
      "Logradouro", 
      "Número",
      "Complemento",
      "Observações"
    ];

    const exampleRow = [
      "1",
      "João Silva",
      "joao@email.com", 
      "(11) 99999-9999",
      "(11) 88888-8888",
      "Instalação",
      "Carlos Técnico",
      "2024-12-25 14:30",
      "scheduled",
      "normal", 
      "01234-567",
      "Rua das Flores",
      "123",
      "Apto 45",
      "Cliente preferencial"
    ];

    const csvContent = [templateHeaders, exampleRow]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_agendamentos.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Modelo baixado",
      description: "Use este arquivo como base para importar seus agendamentos",
    });
  };

  const exportToCSV = () => {
    if (appointments.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há agendamentos para exportar",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = [
      "ID",
      "Cliente",
      "Email Cliente",
      "Telefone 1",
      "Telefone 2",
      "Serviço",
      "Técnico",
      "Data/Hora",
      "Status",
      "Prioridade",
      "CEP",
      "Logradouro",
      "Número",
      "Complemento",
      "Observações"
    ];

    const csvData = appointments.map((appointment: Appointment) => {
      const client = getClient(appointment.clientId);
      const service = getService(appointment.serviceId);
      const technician = getTechnician(appointment.technicianId);
      const { date, time } = formatDateTime(appointment.scheduledDate.toString());

      return [
        appointment.id,
        client?.name || "Cliente não encontrado",
        client?.email || "",
        client?.phone1 || "",
        client?.phone2 || "",
        service?.name || "Serviço não encontrado",
        technician?.name || "Técnico não encontrado",
        `${date} ${time}`,
        getStatusText(appointment.status),
        getPriorityText(appointment.priority),
        appointment.cep,
        appointment.logradouro,
        appointment.numero,
        appointment.complemento || "",
        appointment.notes || ""
      ];
    });

    const csvContent = [csvHeaders, ...csvData]
      .map((row: any[]) => row.map((field: any) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `agendamentos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Sucesso",
      description: "Agendamentos exportados com sucesso",
    });
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
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-600">Gerencie todos os seus agendamentos</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              onClick={handleImportCSV}
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
            <Button
              variant="ghost"
              onClick={downloadCSVTemplate}
              className="text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-auto py-1"
            >
              Baixar CSV Modelo
            </Button>
          </div>
          
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="border-burnt-yellow text-burnt-yellow hover:bg-burnt-yellow hover:text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white">
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <AppointmentForm
                appointment={selectedAppointment}
                onClose={handleFormClose}
                clients={clients}
                services={services}
                technicians={technicians}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Appointments List */}
      {appointments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum agendamento encontrado</h3>
            <p className="text-gray-600 text-center mb-6">
              Comece criando seu primeiro agendamento para organizar seus atendimentos técnicos.
            </p>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <AppointmentForm
                  appointment={selectedAppointment}
                  onClose={handleFormClose}
                  clients={clients}
                  services={services}
                  technicians={technicians}
                />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {appointments.map((appointment: Appointment) => {
            const client = getClient(appointment.clientId);
            const service = getService(appointment.serviceId);
            const technician = getTechnician(appointment.technicianId);
            const { date, time } = formatDateTime(appointment.scheduledDate.toString());

            return (
              <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {client?.name || "Cliente não encontrado"}
                        </h3>
                        <Badge className={getStatusColor(appointment.status)}>
                          {getStatusText(appointment.status)}
                        </Badge>
                        <Badge className={getPriorityColor(appointment.priority)}>
                          {getPriorityText(appointment.priority)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>{date} às {time}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>{technician?.name || "Técnico não encontrado"}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4" />
                          <span>{appointment.logradouro}, {appointment.numero}{appointment.complemento && `, ${appointment.complemento}`}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>{service?.name || "Serviço não encontrado"}</span>
                        </div>
                      </div>
                      
                      {appointment.notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">{appointment.notes}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(appointment)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(appointment)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
