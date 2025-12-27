import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    CalendarDays,
    CalendarCheck,
    CalendarX,
    Calendar,
    Loader2
} from "lucide-react";

interface OperationStatsCardProps {
    startDate?: string;
    endDate?: string;
    technicianId?: number;
    teamId?: number;
}

interface Appointment {
    id: number;
    status: string;
    executionStatus: string | null;
    scheduledDate: string;
}

export function OperationStatsCard({ startDate, endDate, technicianId, teamId }: OperationStatsCardProps) {
    // Fetch all appointments
    const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
        queryKey: ["/api/appointments", startDate, endDate],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/appointments");
            return res.json();
        },
    });

    // Filter by period
    const periodAppointments = appointments.filter((apt) => {
        if (!startDate || !endDate) return true;
        const aptDate = new Date(apt.scheduledDate).toISOString().split("T")[0];
        return aptDate >= startDate && aptDate <= endDate;
    });

    // Filter by technician/team if provided
    const filteredAppointments = periodAppointments.filter((apt: any) => {
        if (technicianId && apt.technicianId !== technicianId) return false;
        if (teamId && apt.teamId !== teamId) return false;
        return true;
    });

    // Calculate today's date (Brazil timezone)
    const now = new Date();
    const brazilOffset = -3 * 60;
    const localOffset = now.getTimezoneOffset();
    const brazilTime = new Date(now.getTime() + (localOffset - brazilOffset) * 60 * 1000);
    const todayStr = brazilTime.toISOString().split("T")[0];

    // Today's appointments
    const todayAppointments = filteredAppointments.filter((apt) => {
        const aptDate = new Date(apt.scheduledDate).toISOString().split("T")[0];
        return aptDate === todayStr;
    });

    // Completed in period (executionStatus = concluido)
    const completedCount = filteredAppointments.filter(
        (apt) => apt.executionStatus === "concluido"
    ).length;

    // Cancelled in period (status = cancelled)
    const cancelledCount = filteredAppointments.filter(
        (apt) => apt.status === "cancelled"
    ).length;

    // Total in period
    const totalCount = filteredAppointments.length;

    const stats = [
        {
            label: "Agendamentos Hoje",
            value: todayAppointments.length,
            icon: CalendarDays,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            borderColor: "border-blue-100",
        },
        {
            label: "Concluídos no Período",
            value: completedCount,
            icon: CalendarCheck,
            color: "text-green-600",
            bgColor: "bg-green-50",
            borderColor: "border-green-100",
        },
        {
            label: "Cancelados no Período",
            value: cancelledCount,
            icon: CalendarX,
            color: "text-red-600",
            bgColor: "bg-red-50",
            borderColor: "border-red-100",
        },
        {
            label: "Total no Período",
            value: totalCount,
            icon: Calendar,
            color: "text-gray-600",
            bgColor: "bg-gray-50",
            borderColor: "border-gray-100",
        },
    ];

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarDays className="w-5 h-5 text-blue-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">
                                    Estatísticas de Agendamentos
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>
                                    Resumo dos agendamentos no período selecionado.
                                    Inclui totais de hoje, concluídos, cancelados e total geral.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {stats.map((stat) => {
                                const Icon = stat.icon;
                                return (
                                    <div
                                        key={stat.label}
                                        className={`p-4 rounded-lg border ${stat.bgColor} ${stat.borderColor}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon className={`w-4 h-4 ${stat.color}`} />
                                            <span className={`text-xs font-medium ${stat.color}`}>
                                                {stat.label}
                                            </span>
                                        </div>
                                        <p className={`text-2xl font-bold ${stat.color}`}>
                                            {stat.value}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
