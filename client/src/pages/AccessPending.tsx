import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Mail, Building2, LogOut, Loader2 } from "lucide-react";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

interface PendingInvitation {
  id: number;
  token: string;
  email: string;
  role: string;
  company: {
    id: number;
    name: string;
    cnpj: string;
  } | null;
  displayName: string | null;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
}

interface AccessPendingProps {
  onCompanySelected?: () => void;
}

export default function AccessPending({ onCompanySelected }: AccessPendingProps = {}) {
  const [, setLocation] = useLocation();
  const { logout, user, switchCompany } = useAuth();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [activeCompanies, setActiveCompanies] = useState<Array<{ companyId: number; companyName: string; companyCnpj: string; role: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Buscar convites pendentes
        const invitesResponse = await fetch("/api/auth/my-invitations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (invitesResponse.ok) {
          const invitesData = await invitesResponse.json();
          setInvitations(invitesData.invitations || []);
        }

        // Carregar empresas ativas do usuário (do auth context)
        if (user?.memberships) {
          const companies = user.memberships
            .filter(m => m.isActive)
            .map(m => ({
              companyId: m.companyId,
              companyName: m.companyName || `Empresa #${m.companyId}`,
              companyCnpj: m.companyCnpj || '',
              role: m.role,
            }));
          setActiveCompanies(companies);
        }
      } catch (error: any) {
        console.error("Erro ao buscar dados:", error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar dados",
          description: error.message || "Tente novamente mais tarde",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast, user]);

  const handleAcceptInvite = (token: string) => {
    setLocation(`/convite/${token}`);
  };

  const handleSelectCompany = async (companyId: number) => {
    try {
      setIsSwitching(true);
      await switchCompany(companyId);
      
      toast({
        title: "Empresa selecionada",
        description: "Você foi redirecionado para a nova empresa.",
      });
      
      // Resetar flag de forceAccessPending
      if (onCompanySelected) {
        onCompanySelected();
      }
      
      // Redirecionar para início
      setLocation("/inicio");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao selecionar empresa",
        description: error.message || "Tente novamente",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-burnt-yellow" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logoImg} alt="RotaFácil" className="h-16 w-auto" />
        </div>

        {/* Card principal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Building2 className="h-6 w-6 text-burnt-yellow" />
              Acesso Pendente
            </CardTitle>
            <CardDescription>
              Você precisa aceitar um convite para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Empresas Ativas Disponíveis */}
            {activeCompanies.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-green-600" />
                  Empresas Disponíveis ({activeCompanies.length})
                </h3>
                
                {activeCompanies.map((company) => (
                  <Card key={company.companyId} className="border-l-4 border-l-green-500">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="h-4 w-4 text-gray-500" />
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                              {company.companyName}
                            </h4>
                          </div>
                          
                          {company.companyCnpj && (
                            <p className="text-xs text-gray-500 mb-2">
                              CNPJ: {company.companyCnpj}
                            </p>
                          )}
                          
                          <Badge variant="outline" className="text-green-700 border-green-700">
                            {company.role}
                          </Badge>
                        </div>
                        
                        <Button
                          onClick={() => handleSelectCompany(company.companyId)}
                          disabled={isSwitching}
                          className="ml-4"
                        >
                          {isSwitching ? 'Selecionando...' : 'Selecionar Empresa'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Lista de convites pendentes */}
            {invitations.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Convites Pendentes ({invitations.length})
                </h3>
                  
                  {invitations.map((invitation) => (
                    <Card key={invitation.id} className="border-l-4 border-l-burnt-yellow">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="h-4 w-4 text-gray-500" />
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                {invitation.company?.name || "Empresa"}
                              </h4>
                            </div>
                            
                            {invitation.company?.cnpj && (
                              <p className="text-xs text-gray-500 mb-2">
                                CNPJ: {invitation.company.cnpj}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">
                                {invitation.role}
                              </Badge>
                              {invitation.displayName && (
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {invitation.displayName}
                                </span>
                              )}
                            </div>
                            
                            <p className="text-xs text-gray-500">
                              Recebido em {new Date(invitation.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          
                          <Button
                            onClick={() => handleAcceptInvite(invitation.token)}
                            className="ml-4"
                          >
                            Aceitar Convite
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}

            {/* Mensagem quando não há nada */}
            {activeCompanies.length === 0 && invitations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Você não tem acesso a nenhuma empresa
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                  Entre em contato com o administrador da sua empresa para receber um convite de acesso.
                </p>
              </div>
            )}

            {/* Botão de logout */}
            <div className="pt-4 border-t">
              <Button variant="outline" onClick={handleLogout} className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
