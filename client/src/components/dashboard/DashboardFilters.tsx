import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Users, User, Filter } from "lucide-react";

interface Technician {
    id: number;
    name: string;
}

interface Team {
    id: number;
    name: string;
}

export interface DashboardFiltersState {
    period: "today" | "week" | "month" | "quarter" | "year" | "custom";
    startDate?: string;
    endDate?: string;
    responsibleType?: "all" | "technician" | "team";
    responsibleId?: number;
}

interface DashboardFiltersProps {
    filters: DashboardFiltersState;
    onFiltersChange: (filters: DashboardFiltersState) => void;
    showResponsibleFilter?: boolean;
}

export function DashboardFilters({
    filters,
    onFiltersChange,
    showResponsibleFilter = true,
}: DashboardFiltersProps) {
    const [selectedResponsible, setSelectedResponsible] = useState<string>("all");

    // Fetch technicians
    const { data: technicians = [] } = useQuery<Technician[]>({
        queryKey: ["/api/technicians"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/technicians");
            return res.json();
        },
    });

    // Fetch teams
    const { data: teams = [] } = useQuery<Team[]>({
        queryKey: ["/api/teams"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/teams");
            return res.json();
        },
    });

    // Calculate date range based on period (Brazil timezone GMT-3)
    const getDateRange = (period: DashboardFiltersState["period"]) => {
        // Get current date in Brazil timezone using Intl
        const now = new Date();
        const brazilDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // format: YYYY-MM-DD
        const [year, month, day] = brazilDateStr.split('-').map(Number);

        // Create date object representing Brazil's current date
        const brazilToday = new Date(year, month - 1, day);

        // Format date as YYYY-MM-DD
        const formatDate = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        let startDate: Date;
        let endDate: Date;

        switch (period) {
            case "today":
                // Use Brazil's current date (same day for start and end)
                startDate = brazilToday;
                endDate = brazilToday;
                break;
            case "week":
                startDate = new Date(brazilToday);
                startDate.setDate(brazilToday.getDate() - brazilToday.getDay()); // Início da semana (domingo)
                endDate = brazilToday;
                break;
            case "month":
                startDate = new Date(year, month - 1, 1);
                endDate = new Date(year, month, 0);
                break;
            case "quarter":
                const quarter = Math.floor((month - 1) / 3);
                startDate = new Date(year, quarter * 3, 1);
                endDate = new Date(year, (quarter + 1) * 3, 0);
                break;
            case "year":
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31);
                break;
            default:
                startDate = new Date(year, month - 1, 1);
                endDate = new Date(year, month, 0);
        }

        return {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
        };
    };

    // Handle period change
    const handlePeriodChange = (period: DashboardFiltersState["period"]) => {
        const dateRange = getDateRange(period);
        onFiltersChange({
            ...filters,
            period,
            ...dateRange,
        });
    };

    // Handle responsible change
    const handleResponsibleChange = (value: string) => {
        setSelectedResponsible(value);

        if (value === "all") {
            onFiltersChange({
                ...filters,
                responsibleType: "all",
                responsibleId: undefined,
            });
        } else {
            const [type, id] = value.split(":");
            onFiltersChange({
                ...filters,
                responsibleType: type as "technician" | "team",
                responsibleId: parseInt(id),
            });
        }
    };

    // Initialize with month period
    useEffect(() => {
        if (!filters.period) {
            handlePeriodChange("month");
        }
    }, []);

    const periodLabels: Record<DashboardFiltersState["period"], string> = {
        today: "Hoje",
        week: "Esta Semana",
        month: "Este Mês",
        quarter: "Este Trimestre",
        year: "Este Ano",
        custom: "Personalizado",
    };

    return (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="w-4 h-4" />
                <span className="font-medium">Filtros:</span>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <Select value={filters.period || "month"} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="h-8 w-[140px] text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="week">Esta Semana</SelectItem>
                        <SelectItem value="month">Este Mês</SelectItem>
                        <SelectItem value="quarter">Este Trimestre</SelectItem>
                        <SelectItem value="year">Este Ano</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Responsible Filter */}
            {showResponsibleFilter && (
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <Select value={selectedResponsible} onValueChange={handleResponsibleChange}>
                        <SelectTrigger className="h-8 w-[180px] text-sm">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {teams.length > 0 && (
                                <>
                                    <div className="px-2 py-1 text-xs text-gray-500 font-semibold">Equipes</div>
                                    {teams.map((team) => (
                                        <SelectItem key={`team:${team.id}`} value={`team:${team.id}`}>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {team.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </>
                            )}
                            {technicians.length > 0 && (
                                <>
                                    <div className="px-2 py-1 text-xs text-gray-500 font-semibold">Técnicos</div>
                                    {technicians.map((tech) => (
                                        <SelectItem key={`tech:${tech.id}`} value={`technician:${tech.id}`}>
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {tech.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Period indicator */}
            {filters.startDate && filters.endDate && (
                <div className="ml-auto text-xs text-gray-400">
                    {/* Parse as local date to avoid UTC offset issues */}
                    {(() => {
                        const [sy, sm, sd] = filters.startDate.split('-').map(Number);
                        const [ey, em, ed] = filters.endDate.split('-').map(Number);
                        const startLocal = new Date(sy, sm - 1, sd);
                        const endLocal = new Date(ey, em - 1, ed);
                        return `${startLocal.toLocaleDateString("pt-BR")} - ${endLocal.toLocaleDateString("pt-BR")}`;
                    })()}
                </div>
            )}
        </div>
    );
}

// Helper to calculate initial date range for month (Brazil timezone)
function getInitialMonthRange() {
    const now = new Date();
    // Get current date in Brazil timezone using Intl
    const brazilDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // format: YYYY-MM-DD
    const [year, month] = brazilDateStr.split('-').map(Number);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
    };
}

// Default filter state with dates pre-calculated
const initialRange = getInitialMonthRange();
export const defaultDashboardFilters: DashboardFiltersState = {
    period: "month",
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    responsibleType: "all",
};
