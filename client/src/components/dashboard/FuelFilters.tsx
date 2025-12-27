import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Vehicle } from "@shared/schema";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FuelFiltersProps {
    selectedVehicles: number[];
    setSelectedVehicles: (ids: number[]) => void;
    selectedFuelTypes: string[];
    setSelectedFuelTypes: (types: string[]) => void;
}

const FUEL_TYPES = [
    { value: "gasolina", label: "Gasolina", color: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
    { value: "etanol", label: "Etanol", color: "bg-green-100 text-green-800 hover:bg-green-200" },
    { value: "diesel_s500", label: "S500", color: "bg-amber-100 text-amber-800 hover:bg-amber-200" },
    { value: "diesel_s10", label: "S10", color: "bg-orange-100 text-orange-800 hover:bg-orange-200" },
    { value: "eletrico", label: "Elétrico", color: "bg-purple-100 text-purple-800 hover:bg-purple-200" },
];

export function FuelFilters({
    selectedVehicles,
    setSelectedVehicles,
    selectedFuelTypes,
    setSelectedFuelTypes,
}: FuelFiltersProps) {
    const { data: vehicles = [] } = useQuery<Vehicle[]>({
        queryKey: ["/api/vehicles"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/vehicles");
            return res.json();
        },
    });

    const toggleVehicle = (id: number) => {
        setSelectedVehicles(
            selectedVehicles.includes(id)
                ? selectedVehicles.filter((v) => v !== id)
                : [...selectedVehicles, id]
        );
    };

    const toggleFuelType = (type: string) => {
        setSelectedFuelTypes(
            selectedFuelTypes.includes(type)
                ? selectedFuelTypes.filter((t) => t !== type)
                : [...selectedFuelTypes, type]
        );
    };

    const clearAll = () => {
        setSelectedVehicles([]);
        setSelectedFuelTypes([]);
    };

    const selectAll = () => {
        setSelectedVehicles(vehicles.map((v) => v.id));
        setSelectedFuelTypes(FUEL_TYPES.map((f) => f.value));
    };

    const activeFilters = selectedVehicles.length + selectedFuelTypes.length;
    const totalFilters = vehicles.length + FUEL_TYPES.length;

    return (
        <div className="bg-gray-50 border border-gray-200 dark:bg-zinc-800 dark:border-zinc-700 rounded-lg p-3">
            <div className="flex items-center gap-3 flex-wrap">
                {/* Filter Icon & Counter */}
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                        Filtros <span className="text-burnt-yellow">({activeFilters}/{totalFilters})</span>
                    </span>
                </div>

                {/* Divider */}
                <div className="h-4 w-px bg-gray-300 dark:bg-zinc-600" />

                {/* Fuel Type Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {FUEL_TYPES.map((fuel) => {
                        const isSelected = selectedFuelTypes.includes(fuel.value);
                        return (
                            <Badge
                                key={fuel.value}
                                variant="outline"
                                className={`cursor-pointer transition-all text-xs px-2 py-0.5 ${isSelected
                                    ? fuel.color
                                    : "bg-white text-gray-500 hover:bg-gray-100 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600 opacity-50"
                                    }`}
                                onClick={() => toggleFuelType(fuel.value)}
                            >
                                {fuel.label}
                            </Badge>
                        );
                    })}
                </div>

                {/* Divider */}
                {vehicles.length > 0 && <div className="h-4 w-px bg-gray-300 dark:bg-zinc-600" />}

                {/* Vehicle Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {vehicles.map((vehicle) => {
                        const isSelected = selectedVehicles.includes(vehicle.id);
                        return (
                            <Badge
                                key={vehicle.id}
                                variant="outline"
                                className={`cursor-pointer transition-all text-xs px-2 py-0.5 ${isSelected
                                    ? "bg-burnt-yellow text-white border-burnt-yellow hover:bg-burnt-yellow-dark"
                                    : "bg-white text-gray-500 hover:bg-gray-100 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600 opacity-50"
                                    }`}
                                onClick={() => toggleVehicle(vehicle.id)}
                            >
                                {vehicle.plate}
                            </Badge>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAll}
                        className="h-7 text-xs text-burnt-yellow hover:text-burnt-yellow-dark hover:bg-burnt-yellow hover:bg-opacity-10"
                    >
                        Todos
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        className="h-7 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                        <X className="h-3 w-3 mr-1" />
                        Limpar
                    </Button>
                </div>
            </div>
        </div>
    );
}
