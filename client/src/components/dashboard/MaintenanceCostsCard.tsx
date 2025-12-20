import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DollarSign, CalendarDays, CalendarRange, ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface MaintenanceCostsData {
    monthTotal: number;
    yearTotal: number;
    monthName: string;
    year: number;
    vehicles: { id: number; plate: string; model: string }[];
    selectedVehicleId: number | null;
}

export function MaintenanceCostsCard() {
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");

    const { data, isLoading } = useQuery<MaintenanceCostsData>({
        queryKey: ["/api/dashboard/maintenance-costs", selectedVehicleId],
        queryFn: async () => {
            const url = selectedVehicleId !== "all"
                ? `/api/dashboard/maintenance-costs?vehicleId=${selectedVehicleId}`
                : "/api/dashboard/maintenance-costs";
            const res = await apiRequest("GET", url);
            return res.json();
        },
    });

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Gastos com Manutenção
                    </CardTitle>
                    <Select
                        value={selectedVehicleId}
                        onValueChange={setSelectedVehicleId}
                    >
                        <SelectTrigger className="w-[180px] h-8">
                            <SelectValue placeholder="Todos os veículos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os veículos</SelectItem>
                            {data?.vehicles?.map((v) => (
                                <SelectItem key={v.id} value={v.id.toString()}>
                                    {v.plate} - {v.model}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-gray-500">Carregando...</p>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {/* Card do Mês */}
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 text-blue-700 mb-2">
                                <CalendarDays className="w-4 h-4" />
                                <span className="text-sm font-medium capitalize">
                                    {data?.monthName || "Mês atual"}
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-blue-900">
                                {formatCurrency(data?.monthTotal || 0)}
                            </p>
                        </div>

                        {/* Card do Ano */}
                        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 text-green-700 mb-2">
                                <CalendarRange className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                    {data?.year || new Date().getFullYear()}
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-green-900">
                                {formatCurrency(data?.yearTotal || 0)}
                            </p>
                        </div>
                    </div>
                )}

                <Link href="/vehicles#manutencao">
                    <Button variant="outline" size="sm" className="w-full mt-4">
                        Ver Todas as Manutenções
                        <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}
