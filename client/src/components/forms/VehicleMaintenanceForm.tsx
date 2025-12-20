import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Plus, Trash2, Calendar, DollarSign, Shield, AlertTriangle, FileText, Camera } from "lucide-react";
import type { VehicleMaintenance, Vehicle } from "@shared/schema";

interface VehicleMaintenanceFormProps {
    vehicleId?: number | null;
    vehiclePlate?: string;
    vehicles?: Vehicle[];
    maintenance?: VehicleMaintenance | null;
    onClose: () => void;
}

const MAINTENANCE_CATEGORIES = [
    { value: "motor", label: "Motor" },
    { value: "suspensao", label: "Suspensão" },
    { value: "freios", label: "Freios" },
    { value: "eletrica", label: "Elétrica" },
    { value: "pneus", label: "Pneus" },
    { value: "documentacao", label: "Documentação" },
    { value: "funilaria_pintura", label: "Funilaria / Pintura" },
];

const MAINTENANCE_TYPES = [
    { value: "preventiva", label: "Preventiva" },
    { value: "corretiva", label: "Corretiva" },
    { value: "urgente", label: "Urgente" },
    { value: "revisao", label: "Revisão" },
];

interface FormData {
    status: string;
    entryDate: string;
    exitDate: string;
    scheduledDate: string;
    workshop: string;
    technicianResponsible: string;
    description: string;
    category: string;
    maintenanceType: string;
    vehicleKm: number;
    laborCost: string;
    materialsCost: string;
    vehicleUnavailable: boolean;
    unavailableDays: number;
    affectedAppointments: boolean;
    invoiceNumber: string;
    observations: string;
}

interface Warranty {
    id?: number;
    partName: string;
    warrantyExpiration: string;
}

export default function VehicleMaintenanceForm({
    vehicleId,
    vehiclePlate,
    vehicles = [],
    maintenance,
    onClose,
}: VehicleMaintenanceFormProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [warranties, setWarranties] = useState<Warranty[]>([]);
    const [photos, setPhotos] = useState<string[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(vehicleId || (maintenance as any)?.vehicleId || null);

    const form = useForm<FormData>({
        defaultValues: maintenance
            ? {
                status: (maintenance as any).status || "concluida",
                entryDate: maintenance.entryDate ? new Date(maintenance.entryDate).toISOString().split("T")[0] : "",
                exitDate: maintenance.exitDate ? new Date(maintenance.exitDate).toISOString().split("T")[0] : "",
                scheduledDate: (maintenance as any).scheduledDate ? new Date((maintenance as any).scheduledDate).toISOString().split("T")[0] : "",
                workshop: maintenance.workshop || "",
                technicianResponsible: maintenance.technicianResponsible || "",
                description: maintenance.description || "",
                category: maintenance.category || "motor",
                maintenanceType: maintenance.maintenanceType || "corretiva",
                vehicleKm: maintenance.vehicleKm || 0,
                laborCost: maintenance.laborCost?.toString() || "0",
                materialsCost: maintenance.materialsCost?.toString() || "0",
                vehicleUnavailable: maintenance.vehicleUnavailable || false,
                unavailableDays: maintenance.unavailableDays || 0,
                affectedAppointments: maintenance.affectedAppointments || false,
                invoiceNumber: maintenance.invoiceNumber || "",
                observations: maintenance.observations || "",
            }
            : {
                status: "concluida",
                entryDate: new Date().toISOString().split("T")[0],
                exitDate: "",
                scheduledDate: "",
                workshop: "",
                technicianResponsible: "",
                description: "",
                category: "motor",
                maintenanceType: "corretiva",
                vehicleKm: 0,
                laborCost: "0",
                materialsCost: "0",
                vehicleUnavailable: false,
                unavailableDays: 0,
                affectedAppointments: false,
                invoiceNumber: "",
                observations: "",
            },
    });

    useEffect(() => {
        if (maintenance) {
            setPhotos((maintenance.photos as string[]) || []);
            // Warranties serão carregadas separadamente se necessário
        }
    }, [maintenance]);

    const laborCost = parseFloat(form.watch("laborCost") || "0");
    const materialsCost = parseFloat(form.watch("materialsCost") || "0");
    const totalCost = laborCost + materialsCost;

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiRequest(
                "POST",
                `/api/vehicles/${selectedVehicleId}/maintenances`,
                data
            );
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${selectedVehicleId}/maintenances`] });
            queryClient.invalidateQueries({ queryKey: ["/api/vehicle-maintenances"] });
            toast({
                title: "Sucesso",
                description: "Manutenção registrada com sucesso",
            });
            onClose();
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message || "Erro ao registrar manutenção",
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiRequest(
                "PUT",
                `/api/vehicle-maintenances/${maintenance!.id}`,
                data
            );
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/maintenances`] });
            toast({
                title: "Sucesso",
                description: "Manutenção atualizada com sucesso",
            });
            onClose();
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message || "Erro ao atualizar manutenção",
                variant: "destructive",
            });
        },
    });

    const onSubmit = (data: FormData) => {
        if (!selectedVehicleId) {
            toast({
                title: "Erro",
                description: "Selecione um veículo para continuar",
                variant: "destructive",
            });
            return;
        }

        const payload = {
            ...data,
            entryDate: new Date(data.entryDate).toISOString(),
            exitDate: data.exitDate ? new Date(data.exitDate).toISOString() : null,
            scheduledDate: data.scheduledDate ? new Date(data.scheduledDate).toISOString() : null,
            photos,
            warranties: warranties.filter((w) => w.partName && w.warrantyExpiration),
        };

        if (maintenance) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const addWarranty = () => {
        setWarranties([...warranties, { partName: "", warrantyExpiration: "" }]);
    };

    const removeWarranty = (index: number) => {
        setWarranties(warranties.filter((_, i) => i !== index));
    };

    const updateWarranty = (index: number, field: keyof Warranty, value: string) => {
        const updated = [...warranties];
        updated[index] = { ...updated[index], [field]: value };
        setWarranties(updated);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach((file) => {
            if (file.size > 2 * 1024 * 1024) {
                toast({
                    title: "Erro",
                    description: `Foto ${file.name} muito grande. Máximo 2MB.`,
                    variant: "destructive",
                });
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                setPhotos((prev) => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removePhoto = (index: number) => {
        setPhotos(photos.filter((_, i) => i !== index));
    };

    const isLoading = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            <DialogHeader>
                <DialogTitle className="flex items-center">
                    <Wrench className="h-5 w-5 mr-2 text-burnt-yellow" />
                    {maintenance ? "Editar Manutenção" : "Nova Manutenção"}{selectedVehicleId ? ` - ${vehicles.find(v => v.id === selectedVehicleId)?.plate || vehiclePlate || ''}` : ''}
                </DialogTitle>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* ID da Manutenção (quando editando) */}
                {maintenance && (
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">
                            <span className="font-medium">ID da Manutenção:</span> #{maintenance.id}
                        </p>
                    </div>
                )}

                {/* Seleção de Veículo (quando não está editando ou veículo não está definido) */}
                {vehicles.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="vehicle-select">Veículo *</Label>
                        <Select
                            value={selectedVehicleId?.toString() || ""}
                            onValueChange={(value) => setSelectedVehicleId(parseInt(value))}
                            disabled={!!maintenance}
                        >
                            <SelectTrigger id="vehicle-select">
                                <SelectValue placeholder="Selecione o veículo" />
                            </SelectTrigger>
                            <SelectContent>
                                {vehicles.map((v) => (
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                        {v.plate} - {v.brand} {v.model}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Status da Manutenção */}
                <div className="space-y-4">
                    <h3 className="font-medium text-sm text-gray-700 flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Status da Manutenção
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="status">Status *</Label>
                            <Select
                                value={form.watch("status")}
                                onValueChange={(value) => form.setValue("status", value)}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="concluida">Concluída</SelectItem>
                                    <SelectItem value="agendada">Agendada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {form.watch("status") === "agendada" && (
                            <div>
                                <Label htmlFor="scheduledDate">Data Agendada *</Label>
                                <Input
                                    {...form.register("scheduledDate", { required: form.watch("status") === "agendada" })}
                                    type="date"
                                    className="mt-1"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Dados da Manutenção */}
                <div className="space-y-4">
                    <h3 className="font-medium text-sm text-gray-700 flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        Dados da Manutenção
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="entryDate">Data de Entrada *</Label>
                            <Input
                                {...form.register("entryDate", { required: true })}
                                type="date"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="exitDate">Data de Saída</Label>
                            <Input
                                {...form.register("exitDate")}
                                type="date"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="workshop">Local (Oficina) *</Label>
                            <Input
                                {...form.register("workshop", { required: true })}
                                placeholder="Nome da oficina"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="technicianResponsible">Técnico Responsável</Label>
                            <Input
                                {...form.register("technicianResponsible")}
                                placeholder="Nome do técnico (opcional)"
                                className="mt-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Detalhes */}
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium text-sm text-gray-700 flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Detalhes
                    </h3>

                    <div>
                        <Label htmlFor="description">O que foi feito *</Label>
                        <Textarea
                            {...form.register("description", { required: true })}
                            placeholder="Descreva os serviços realizados..."
                            className="mt-1"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="category">Categoria *</Label>
                            <Select
                                value={form.watch("category")}
                                onValueChange={(value) => form.setValue("category", value)}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MAINTENANCE_CATEGORIES.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="maintenanceType">Tipo *</Label>
                            <Select
                                value={form.watch("maintenanceType")}
                                onValueChange={(value) => form.setValue("maintenanceType", value)}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MAINTENANCE_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="vehicleKm">KM do Veículo *</Label>
                            <Input
                                {...form.register("vehicleKm", { valueAsNumber: true, required: true })}
                                type="number"
                                min="0"
                                placeholder="0"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Fotos */}
                    <div>
                        <Label className="flex items-center">
                            <Camera className="h-4 w-4 mr-2" />
                            Fotos (antes/depois, NF)
                        </Label>
                        <div className="mt-2 space-y-2">
                            <Input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                            />
                            {photos.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {photos.map((photo, index) => (
                                        <div key={index} className="relative">
                                            <img
                                                src={photo}
                                                alt={`Foto ${index + 1}`}
                                                className="h-20 w-20 object-cover rounded border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(index)}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Custos */}
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium text-sm text-gray-700 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Custos
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="laborCost">Mão de Obra (R$)</Label>
                            <Input
                                {...form.register("laborCost")}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="materialsCost">Materiais (R$)</Label>
                            <Input
                                {...form.register("materialsCost")}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Total (R$)</Label>
                            <div className="mt-1 h-10 px-3 py-2 bg-gray-100 border rounded-md flex items-center font-medium">
                                R$ {totalCost.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Garantias */}
                <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm text-gray-700 flex items-center">
                            <Shield className="h-4 w-4 mr-2" />
                            Garantias (opcional)
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={addWarranty}>
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar
                        </Button>
                    </div>

                    {warranties.length > 0 && (
                        <div className="space-y-2">
                            {warranties.map((warranty, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input
                                        value={warranty.partName}
                                        onChange={(e) => updateWarranty(index, "partName", e.target.value)}
                                        placeholder="Nome da peça"
                                        className="flex-1"
                                    />
                                    <Input
                                        type="date"
                                        value={warranty.warrantyExpiration}
                                        onChange={(e) => updateWarranty(index, "warrantyExpiration", e.target.value)}
                                        className="w-40"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeWarranty(index)}
                                        className="text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Impacto Operacional */}
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium text-sm text-gray-700 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Impacto Operacional
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="vehicleUnavailable">Veículo ficou indisponível?</Label>
                            <Switch
                                checked={form.watch("vehicleUnavailable")}
                                onCheckedChange={(checked) => form.setValue("vehicleUnavailable", checked)}
                            />
                        </div>

                        {form.watch("vehicleUnavailable") && (
                            <div className="pl-4 border-l-2 border-yellow-400">
                                <Label htmlFor="unavailableDays">Quantos dias?</Label>
                                <Input
                                    {...form.register("unavailableDays", { valueAsNumber: true })}
                                    type="number"
                                    min="0"
                                    className="mt-1 w-24"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <Label htmlFor="affectedAppointments">Afetou agendamentos?</Label>
                            <Switch
                                checked={form.watch("affectedAppointments")}
                                onCheckedChange={(checked) => form.setValue("affectedAppointments", checked)}
                            />
                        </div>
                    </div>
                </div>

                {/* Nota Fiscal e Observações */}
                <div className="space-y-4 pt-4 border-t">
                    <div>
                        <Label htmlFor="invoiceNumber">Número da Nota Fiscal / OS</Label>
                        <Input
                            {...form.register("invoiceNumber")}
                            placeholder="Ex: NF-12345"
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="observations">Observações</Label>
                        <Textarea
                            {...form.register("observations")}
                            placeholder="Observações adicionais..."
                            className="mt-1"
                            rows={2}
                        />
                    </div>
                </div>

                {/* Botões */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        ) : null}
                        {maintenance ? "Atualizar" : "Registrar"} Manutenção
                    </Button>
                </div>
            </form>
        </div>
    );
}
