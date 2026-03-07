import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getQueryFn } from "@/lib/queryClient";
import { type Lead } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Users, Loader2, Building, Phone, Mail, Car, Briefcase } from "lucide-react";

export default function LeadsOverview() {
    const { user } = useAuth();
    const isSuperAdmin = user?.isSuperAdmin || user?.email === 'lucaspmastaler@gmail.com';

    const { data: leads = [], isLoading, error } = useQuery<Lead[]>({
        queryKey: ["/api/leads"],
        queryFn: getQueryFn({ on401: "throw" }),
        enabled: isSuperAdmin,
    });

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
                <div className="text-center space-y-4">
                    <ShieldAlert className="h-16 w-16 text-red-500 mx-auto" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso Restrito</h1>
                    <p className="text-gray-500 dark:text-zinc-400">Esta página é exclusiva para SuperAdmin.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Users className="h-8 w-8 text-[#DAA520]" />
                        Leads Capturados
                    </h1>
                    <p className="text-gray-500 dark:text-zinc-400 mt-2">
                        Contatos recebidos pela landing page (Agendamento de Demonstração).
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-[#DAA520]" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
                        <ShieldAlert className="h-5 w-5" />
                        <p>Erro ao carregar leads. Tente novamente.</p>
                    </div>
                ) : (
                    <Card className="border-gray-200 dark:border-zinc-800 shadow-sm">
                        <CardHeader className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
                            <CardTitle className="text-lg">Total de Contatos: {leads.length}</CardTitle>
                            <CardDescription>
                                Lista completa de leads recebidos em ordem decrescente (mais recentes primeiro).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-gray-50/50 dark:bg-zinc-900/50">
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Contato</TableHead>
                                            <TableHead>Empresa & Ramo</TableHead>
                                            <TableHead className="text-center">Funcionários</TableHead>
                                            <TableHead className="text-center">Técnicos</TableHead>
                                            <TableHead className="text-center">Veículos</TableHead>
                                            <TableHead className="text-center">Entregas/Dia</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {leads.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                                                    Nenhum lead capturado ainda.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            leads.map((lead) => (
                                                <TableRow key={lead.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                    <TableCell className="whitespace-nowrap text-sm text-gray-500">
                                                        {new Date(lead.createdAt).toLocaleDateString('pt-BR', {
                                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium text-gray-900 dark:text-white">{lead.name}</div>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                                            <Mail className="h-3 w-3" /> {lead.email}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                                            <Phone className="h-3 w-3" /> {lead.phone}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
                                                            <Building className="h-3.5 w-3.5 text-gray-400" />
                                                            {lead.companyName}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                                            <Briefcase className="h-3.5 w-3.5 text-gray-400" />
                                                            {lead.otherIndustry ? lead.otherIndustry : lead.industry}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium">
                                                        <span className="inline-flex items-center justify-center bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-gray-600 dark:text-gray-300">
                                                            <Users className="h-3 w-3 mr-1" /> {lead.employeeCount}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium">
                                                        <span className="inline-flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-xs text-blue-700 dark:text-blue-400">
                                                            <Users className="h-3 w-3 mr-1" /> {lead.technicianCount}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium">
                                                        <span className="inline-flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded text-xs text-amber-700 dark:text-amber-400">
                                                            <Car className="h-3 w-3 mr-1" /> {lead.vehicleCount}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium">
                                                        <span className="inline-flex items-center justify-center bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded text-xs text-green-700 dark:text-green-400">
                                                            {lead.deliveriesPerDay}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
