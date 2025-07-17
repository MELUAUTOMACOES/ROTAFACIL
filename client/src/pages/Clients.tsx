import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ClientForm from "@/components/forms/ClientForm";
import { Plus, Users, Mail, Phone, MapPin, Edit, Trash2, Upload, Download } from "lucide-react";
import type { Client, InsertClient } from "@shared/schema";

export default function Clients() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/clients/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Sucesso",
        description: "Cliente excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir cliente",
        variant: "destructive",
      });
    },
  });

  const importClientsMutation = useMutation({
    mutationFn: async (clients: any[]) => {
      const response = await apiRequest("POST", "/api/clients/import", { clients });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      if (data.errors > 0) {
        const errorMessage = data.detailedErrors
          ? data.detailedErrors.slice(0, 2).join('\n') +
            (data.detailedErrors.length > 2
              ? `\n... e mais ${data.detailedErrors.length - 2} erros`
              : '')
          : `${data.errors} erros encontrados`;

        toast({
          title: `Importação parcial: ${data.success} sucessos, ${data.errors} erros`,
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: `${data.success} clientes importados com sucesso!`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao importar clientes",
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
            const clientsToImport = [];
            const errors = [];

            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
              if (values.length < headers.length) continue;

              const nome = values[0];
              const cpf = values[1];
              const email = values[2];
              const telefone1 = values[3];
              const cep = values[4];
              const bairro = values[5];
              const cidade = values[6];
              const logradouro = values[7];
              const numero = values[8];

              // Validar campos obrigatórios
              const validationErrors = [];
              if (!nome) validationErrors.push("Nome (coluna 1) está vazio");
              if (!cpf) validationErrors.push("CPF (coluna 2) está vazio");
              if (!telefone1) validationErrors.push("Telefone 1 (coluna 4) está vazio");
              if (!cep) validationErrors.push("CEP (coluna 5) está vazio");
              if (!bairro) validationErrors.push("Bairro (coluna 6) está vazio");
              if (!cidade) validationErrors.push("Cidade (coluna 7) está vazio");
              if (!logradouro) validationErrors.push("Logradouro (coluna 8) está vazio");
              if (!numero) validationErrors.push("Número (coluna 9) está vazio");
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

              clientsToImport.push({
                name: nome,
                cpf: cpf,
                email: email || "",
                phone1: telefone1,
                cep: cep,
                bairro: bairro || "",
                cidade: cidade || "",
                logradouro: logradouro,
                numero: numero,
                phone2: values[9] || "",
                complemento: values[10] || "",
                observacoes: values[11] || "",
              });
            } // <-- FECHA O FOR AQUI

            if (errors.length > 0) {
              const errorReport = [
                "RELATÓRIO DE ERROS - IMPORTAÇÃO DE CLIENTES",
                "=" + "=".repeat(50),
                "",
                `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
                `Arquivo: ${file.name}`,
                "",
                "RESUMO:",
                "-".repeat(20),
                `Total de linhas processadas: ${lines.length - 1}`,
                `Clientes válidos: ${clientsToImport.length}`,
                `Erros encontrados: ${errors.length}`,
                `Taxa de sucesso: ${((clientsToImport.length / (lines.length - 1)) * 100).toFixed(1)}%`,
                "",
                "CAMPOS OBRIGATÓRIOS:",
                "-".repeat(30),
                "• Nome (coluna 1)",
                "• CPF (coluna 2)",
                "• Telefone 1 (coluna 4)", 
                "• CEP (coluna 5)",
                "• Bairro (coluna 6)",
                "• Cidade (coluna 7)",
                "• Logradouro (coluna 8)",
                "• Número (coluna 9)",
                "",
                "ERROS ENCONTRADOS:",
                "-".repeat(30),
                ...errors,
                "",
                "OBSERVAÇÃO: Use o botão 'Baixar CSV Modelo' para obter um arquivo com a estrutura correta."
              ].join('\n');

              const logBlob = new Blob([errorReport], { type: "text/plain;charset=utf-8;" });
              const logLink = document.createElement("a");
              const logUrl = URL.createObjectURL(logBlob);
              logLink.setAttribute("href", logUrl);
              logLink.setAttribute("download", `relatorio_erros_clientes_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '')}.txt`);
              logLink.style.visibility = "hidden";
              document.body.appendChild(logLink);

              setTimeout(() => {
                if (confirm("Deseja baixar um relatório detalhado dos erros encontrados?")) {
                  logLink.click();
                }
                document.body.removeChild(logLink);
              }, 1000);
            }

            if (clientsToImport.length > 0) {
              importClientsMutation.mutate(clientsToImport);
            } else {
              toast({
                title: "Erro",
                description: "Nenhum cliente válido encontrado no arquivo",
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
    const headers = [
      "Nome",
      "CPF",
      "Email",
      "Telefone 1",
      "CEP",
      "Bairro",
      "Cidade",
      "Logradouro",
      "Número",
      "Telefone 2",
      "Complemento",
      "Observações"
    ];

    const exampleRow = [
      "João Silva",
      "123.456.789-01",
      "joao@email.com",
      "(11) 99999-9999",
      "01234-567",
      "Portão",
      "Curitiba",
      "Rua das Flores",
      "123",
      "(11) 88888-8888",
      "Apto 45",
      "Cliente preferencial"
    ];

    const csvContent = [headers, exampleRow]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_clientes.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Modelo baixado",
      description: "Use este arquivo como base para importar seus clientes",
    });
  };

  const exportToCSV = () => {
    if (clients.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há clientes para exportar",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = [
      "Nome",
      "CPF",
      "Email",
      "Telefone 1",
      "CEP",
      "Bairro",
      "Cidade",
      "Logradouro",
      "Número",
      "Telefone 2",
      "Complemento",
      "Observações"
    ];

    const csvData = clients.map((client: Client) => [
      client.name,
      client.cpf,
      client.email || "",
      client.phone1,
      client.cep,
      client.bairro || "",
      client.cidade || "",
      client.logradouro,
      client.numero,
      client.phone2 || "",
      client.complemento || "",
      client.observacoes || ""
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map((row: any[]) => row.map((field: any) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `clientes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${clients.length} clientes exportados com sucesso`,
    });
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleDelete = async (client: Client) => {
    if (confirm(`Tem certeza que deseja excluir o cliente "${client.name}"?`)) {
      deleteClientMutation.mutate(client.id);
    }
  };

  const handleFormClose = () => {
    console.log("Dialog de cliente fechado - resetando cliente selecionado!");
    setIsFormOpen(false);
    setSelectedClient(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      console.log("Resetando formulário ao fechar Dialog por fora");
      setSelectedClient(null);
    }
    setIsFormOpen(open);
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
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600">Gerencie sua base de clientes</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadCSVTemplate}
            disabled={importClientsMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar CSV Modelo
          </Button>
          
          <Button
            variant="outline"
            onClick={handleImportCSV}
            disabled={importClientsMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={clients.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          
          <Dialog open={isFormOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <ClientForm
                client={selectedClient}
                onClose={handleFormClose}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Clients List */}
      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente cadastrado</h3>
            <p className="text-gray-600 text-center mb-6">
              Comece adicionando seus primeiros clientes para organizar seus atendimentos.
            </p>
            <Dialog open={isFormOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Cliente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <ClientForm
                  client={selectedClient}
                  onClose={handleFormClose}
                />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client: Client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(client)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(client)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {client.email && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>{client.email}</span>
                    </div>
                  )}
                  
                  {client.phone1 && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{client.phone1}</span>
                    </div>
                  )}
                  
                  {client.phone2 && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{client.phone2}</span>
                    </div>
                  )}
                  
                  <div className="flex items-start space-x-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="leading-relaxed">
                      {client.logradouro}, {client.numero}
                      {client.complemento && `, ${client.complemento}`}
                      <br />
                      CEP: {client.cep}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Cadastrado em {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
