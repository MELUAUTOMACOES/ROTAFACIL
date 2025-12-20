import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Camera, Trash2, ClipboardCheck } from "lucide-react";
import type { InsertVehicleChecklist } from "@shared/schema";

interface VehicleChecklistFormProps {
    open: boolean;
    onClose: () => void;
}

const ITEM_STATUS_OPTIONS = [
    { value: "ok", label: "OK" },
    { value: "attention", label: "Atenção" },
    { value: "critical", label: "Crítico" },
    { value: "not_checked", label: "Não Verificado" },
];

// Schema de validação para o formulário
const checklistFormSchema = z.object({
    vehicleId: z.number().min(1, "Selecione um veículo"),
    checkDate: z.string().min(1, "Data é obrigatória"),
    checkTime: z.string().optional(),
    technicianId: z.number().optional().nullable(),
    teamMemberId: z.number().optional().nullable(),
    vehicleKm: z.number().min(0, "KM não pode ser negativo"),
    checklistType: z.enum(["pre_trip", "post_trip"]),
    generalObservations: z.string().optional(),
    vehicleApproved: z.boolean(),
    disapprovalReason: z.string().optional(),
    // Items serão gerenciados separadamente
}).refine(
    (data) => data.technicianId || data.teamMemberId,
    { message: "Selecione um técnico ou membro de equipe", path: ["technicianId"] }
).refine(
    (data) => data.vehicleApproved || (data.disapprovalReason && data.disapprovalReason.trim().length > 0),
    { message: "Informe o motivo se o veículo não for aprovado", path: ["disapprovalReason"] }
);

type ChecklistFormData = z.infer<typeof checklistFormSchema>;

export default function VehicleChecklistForm({ open, onClose }: VehicleChecklistFormProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [photos, setPhotos] = useState<string[]>([]);

    // Estados para cada categoria de items
    const [fluidItems, setFluidItems] = useState<Record<string, { status: string; observation?: string }>>({
        oil: { status: "ok" },
        water: { status: "ok" },
        windshield_washer: { status: "ok" },
    });

    const [tireItems, setTireItems] = useState<Record<string, { status: string; observation?: string }>>({
        front_tires: { status: "ok" },
        rear_tires: { status: "ok" },
        tire_pressure: { status: "ok" },
        spare_tire: { status: "ok" },
    });

    const [lightItems, setLightItems] = useState<Record<string, { status: string; observation?: string }>>({
        headlights_low: { status: "ok" },
        headlights_high: { status: "ok" },
        turn_signals: { status: "ok" },
        brake_lights: { status: "ok" },
        reverse_lights: { status: "ok" },
    });

    const [panelItems, setPanelItems] = useState<Record<string, { status: string; observation?: string }>>({
        warning_lights: { status: "ok" },
    });

    const [safetyItems, setSafetyItems] = useState<Record<string, { status: string; observation?: string }>>({
        brakes: { status: "ok" },
        steering_suspension: { status: "ok" },
        seat_belts: { status: "ok" },
        mirrors: { status: "ok" },
    });

    const [mandatoryItems, setMandatoryItems] = useState<Record<string, { status: string; observation?: string }>>({
        triangle: { status: "ok" },
        jack: { status: "ok" },
        wheel_wrench: { status: "ok" },
        fire_extinguisher: { status: "ok" },
    });

    const [fuelLevel, setFuelLevel] = useState<string>("2/4");

    const form = useForm<ChecklistFormData>({
        resolver: zodResolver(checklistFormSchema),
        defaultValues: {
            checkDate: new Date().toISOString().split("T")[0],
            checkTime: new Date().toTimeString().slice(0, 5),
            vehicleKm: 0,
            checklistType: "pre_trip",
            vehicleApproved: true,
        },
    });

    // Buscar veículos
    const { data: vehicles } = useQuery({
        queryKey: ["/api/vehicles"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/vehicles");
            return res.json();
        },
    });

    // Buscar técnicos
    const { data: technicians } = useQuery({
        queryKey: ["/api/technicians"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/technicians");
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiRequest("POST", "/api/vehicle-checklists", data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vehicle-checklists"] });
            toast({
                title: "Sucesso",
                description: "Checklist criado com sucesso",
            });
            onClose();
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message || "Erro ao criar checklist",
                variant: "destructive",
            });
        },
    });

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

    const onSubmit = (data: ChecklistFormData) => {
        // Compilar todos os items
        const items = [
            ...Object.entries(fluidItems).map(([name, item]) => ({
                category: "fluids",
                itemName: name,
                status: item.status,
                observation: item.observation,
            })),
            ...Object.entries(tireItems).map(([name, item]) => ({
                category: "tires",
                itemName: name,
                status: item.status,
                observation: item.observation,
            })),
            ...Object.entries(lightItems).map(([name, item]) => ({
                category: "lights",
                itemName: name,
                status: item.status,
                observation: item.observation,
            })),
            ...Object.entries(panelItems).map(([name, item]) => ({
                category: "panel",
                itemName: name,
                status: item.status,
                observation: item.observation,
            })),
            ...Object.entries(safetyItems).map(([name, item]) => ({
                category: "safety",
                itemName: name,
                status: item.status,
                observation: item.observation,
            })),
            ...Object.entries(mandatoryItems).map(([name, item]) => ({
                category: "mandatory_items",
                itemName: name,
                status: item.status,
                observation: item.observation,
            })),
            {
                category: "fuel",
                itemName: "fuel_level",
                status: "ok",
                observation: fuelLevel,
            },
        ];

        const payload = {
            ...data,
            photos,
            items,
        };

        createMutation.mutate(payload);
    };

    const updateItemStatus = (
        category: string,
        itemName: string,
        status: string,
        observation?: string
    ) => {
        const setters: Record<string, any> = {
            fluids: setFluidItems,
            tires: setTireItems,
            lights: setLightItems,
            panel: setPanelItems,
            safety: setSafetyItems,
            mandatory_items: setMandatoryItems,
        };

        const setter = setters[category];
        if (setter) {
            setter((prev: any) => ({
                ...prev,
                [itemName]: { status, observation },
            }));
        }
    };

    const renderItemField = (
        category: string,
        itemName: string,
        label: string,
        currentStatus: string,
        currentObservation?: string
    ) => (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Select
                value={currentStatus}
                onValueChange={(value) => updateItemStatus(category, itemName, value, currentObservation)}
            >
                <SelectTrigger className="h-9">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {ITEM_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {currentStatus !== "ok" && currentStatus !== "not_checked" && (
                <Input
                    placeholder="Observação (opcional)"
                    value={currentObservation || ""}
                    onChange={(e) => updateItemStatus(category, itemName, currentStatus, e.target.value)}
                    className="text-sm"
                />
            )}
        </div>
    );

    return (
        <div className="space-y-6 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="flex items-center">
                    <ClipboardCheck className="h-5 w-5 mr-2 text-burnt-yellow" />
                    Novo Checklist de Veículo
                </DialogTitle>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Informações Gerais */}
                <div className="space-y-4">
                    <h3 className="font-medium text-sm text-gray-700">Informações Gerais</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="checkDate">Data *</Label>
                            <Input
                                {...form.register("checkDate")}
                                type="date"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="checkTime">Hora</Label>
                            <Input
                                {...form.register("checkTime")}
                                type="time"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="vehicleId">Veículo *</Label>
                        <Select
                            value={form.watch("vehicleId")?.toString()}
                            onValueChange={(value) => form.setValue("vehicleId", parseInt(value))}
                        >
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecione o veículo" />
                            </SelectTrigger>
                            <SelectContent>
                                {vehicles?.map((vehicle: any) => (
                                    <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                        {vehicle.plate} - {vehicle.brand} {vehicle.model}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.vehicleId && (
                            <p className="text-sm text-red-600 mt-1">{form.formState.errors.vehicleId.message}</p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="technicianId">Responsável *</Label>
                        <Select
                            value={form.watch("technicianId")?.toString() || ""}
                            onValueChange={(value) => form.setValue("technicianId", value ? parseInt(value) : null)}
                        >
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecione o responsável" />
                            </SelectTrigger>
                            <SelectContent>
                                {technicians?.map((tech: any) => (
                                    <SelectItem key={tech.id} value={tech.id.toString()}>
                                        {tech.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.technicianId && (
                            <p className="text-sm text-red-600 mt-1">{form.formState.errors.technicianId.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="vehicleKm">KM Atual *</Label>
                            <Input
                                {...form.register("vehicleKm", { valueAsNumber: true })}
                                type="number"
                                min="0"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Tipo *</Label>
                            <RadioGroup
                                value={form.watch("checklistType")}
                                onValueChange={(value: any) => form.setValue("checklistType", value)}
                                className="flex gap-4 mt-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="pre_trip" id="pre_trip" />
                                    <Label htmlFor="pre_trip" className="font-normal">Pré-viagem</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="post_trip" id="post_trip" />
                                    <Label htmlFor="post_trip" className="font-normal">Pós-viagem</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                </div>

                {/* Accordion com blocos de verificação */}
                <Accordion type="multiple" className="w-full space-y-2">
                    {/* Fluidos e Níveis */}
                    <AccordionItem value="fluids" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-100 font-medium">
                            Fluidos e Níveis
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-4 pb-4 pt-2">
                            {renderItemField("fluids", "oil", "Óleo", fluidItems.oil.status, fluidItems.oil.observation)}
                            {renderItemField("fluids", "water", "Água / Arrefecimento", fluidItems.water.status, fluidItems.water.observation)}
                            {renderItemField("fluids", "windshield_washer", "Água do Limpador", fluidItems.windshield_washer.status, fluidItems.windshield_washer.observation)}
                        </AccordionContent>
                    </AccordionItem>

                    {/* Pneus */}
                    <AccordionItem value="tires" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-100 font-medium">
                            Pneus
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-4 pb-4 pt-2">
                            {renderItemField("tires", "front_tires", "Pneus Dianteiros", tireItems.front_tires.status, tireItems.front_tires.observation)}
                            {renderItemField("tires", "rear_tires", "Pneus Traseiros", tireItems.rear_tires.status, tireItems.rear_tires.observation)}
                            {renderItemField("tires", "tire_pressure", "Calibragem", tireItems.tire_pressure.status, tireItems.tire_pressure.observation)}
                            {renderItemField("tires", "spare_tire", "Estepe", tireItems.spare_tire.status, tireItems.spare_tire.observation)}
                        </AccordionContent>
                    </AccordionItem>

                    {/* Luzes Externas */}
                    <AccordionItem value="lights" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-100 font-medium">
                            Luzes Externas
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-4 pb-4 pt-2">
                            {renderItemField("lights", "headlights_low", "Farol Baixo", lightItems.headlights_low.status, lightItems.headlights_low.observation)}
                            {renderItemField("lights", "headlights_high", "Farol Alto", lightItems.headlights_high.status, lightItems.headlights_high.observation)}
                            {renderItemField("lights", "turn_signals", "Setas", lightItems.turn_signals.status, lightItems.turn_signals.observation)}
                            {renderItemField("lights", "brake_lights", "Luz de Freio", lightItems.brake_lights.status, lightItems.brake_lights.observation)}
                            {renderItemField("lights", "reverse_lights", "Luz de Ré", lightItems.reverse_lights.status, lightItems.reverse_lights.observation)}
                        </AccordionContent>
                    </AccordionItem>

                    {/* Painel */}
                    <AccordionItem value="panel" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-100 font-medium">
                            Painel
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-4 pb-4 pt-2">
                            {renderItemField("panel", "warning_lights", "Luzes de Alerta", panelItems.warning_lights.status, panelItems.warning_lights.observation)}
                        </AccordionContent>
                    </AccordionItem>

                    {/* Segurança */}
                    <AccordionItem value="safety" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-100 font-medium">
                            Segurança
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-4 pb-4 pt-2">
                            {renderItemField("safety", "brakes", "Freios", safetyItems.brakes.status, safetyItems.brakes.observation)}
                            {renderItemField("safety", "steering_suspension", "Direção / Suspensão", safetyItems.steering_suspension.status, safetyItems.steering_suspension.observation)}
                            {renderItemField("safety", "seat_belts", "Cintos de Segurança", safetyItems.seat_belts.status, safetyItems.seat_belts.observation)}
                            {renderItemField("safety", "mirrors", "Retrovisores", safetyItems.mirrors.status, safetyItems.mirrors.observation)}
                        </AccordionContent>
                    </AccordionItem>

                    {/* Itens Obrigatórios */}
                    <AccordionItem value="mandatory" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-100 font-medium">
                            Itens Obrigatórios
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-4 pb-4 pt-2">
                            {renderItemField("mandatory_items", "triangle", "Triângulo", mandatoryItems.triangle.status, mandatoryItems.triangle.observation)}
                            {renderItemField("mandatory_items", "jack", "Macaco", mandatoryItems.jack.status, mandatoryItems.jack.observation)}
                            {renderItemField("mandatory_items", "wheel_wrench", "Chave de Roda", mandatoryItems.wheel_wrench.status, mandatoryItems.wheel_wrench.observation)}
                            {renderItemField("mandatory_items", "fire_extinguisher", "Extintor", mandatoryItems.fire_extinguisher.status, mandatoryItems.fire_extinguisher.observation)}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                {/* Combustível - Sempre Visível */}
                <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                    <h3 className="font-medium text-sm text-gray-700">Combustível</h3>
                    <div>
                        <Label>Nível do Tanque</Label>
                        <RadioGroup
                            value={fuelLevel}
                            onValueChange={setFuelLevel}
                            className="grid grid-cols-4 gap-2 mt-2"
                        >
                            <div className="flex items-center justify-center space-x-2 border rounded-lg p-2 has-[:checked]:bg-[#DAA520] has-[:checked]:text-white has-[:checked]:border-[#DAA520]">
                                <RadioGroupItem value="1/4" id="fuel_1_4" />
                                <Label htmlFor="fuel_1_4" className="font-normal cursor-pointer">1/4</Label>
                            </div>
                            <div className="flex items-center justify-center space-x-2 border rounded-lg p-2 has-[:checked]:bg-[#DAA520] has-[:checked]:text-white has-[:checked]:border-[#DAA520]">
                                <RadioGroupItem value="2/4" id="fuel_2_4" />
                                <Label htmlFor="fuel_2_4" className="font-normal cursor-pointer">2/4</Label>
                            </div>
                            <div className="flex items-center justify-center space-x-2 border rounded-lg p-2 has-[:checked]:bg-[#DAA520] has-[:checked]:text-white has-[:checked]:border-[#DAA520]">
                                <RadioGroupItem value="3/4" id="fuel_3_4" />
                                <Label htmlFor="fuel_3_4" className="font-normal cursor-pointer">3/4</Label>
                            </div>
                            <div className="flex items-center justify-center space-x-2 border rounded-lg p-2 has-[:checked]:bg-[#DAA520] has-[:checked]:text-white has-[:checked]:border-[#DAA520]">
                                <RadioGroupItem value="4/4" id="fuel_4_4" />
                                <Label htmlFor="fuel_4_4" className="font-normal cursor-pointer">4/4</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>

                {/* Upload de Fotos */}
                <div className="space-y-4 pt-4 border-t">
                    <Label className="flex items-center">
                        <Camera className="h-4 w-4 mr-2" />
                        Fotos
                    </Label>
                    <div className="space-y-2">
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

                {/* Observações Finais e Aprovação */}
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium text-sm text-gray-700">Conclusão</h3>

                    <div>
                        <Label htmlFor="generalObservations">Observações Gerais</Label>
                        <Textarea
                            {...form.register("generalObservations")}
                            placeholder="Observações adicionais..."
                            className="mt-1"
                            rows={3}
                        />
                    </div>

                    <div>
                        <Label>Veículo apto para uso? *</Label>
                        <RadioGroup
                            value={form.watch("vehicleApproved").toString()}
                            onValueChange={(value) => form.setValue("vehicleApproved", value === "true")}
                            className="flex gap-4 mt-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="true" id="approved_yes" />
                                <Label htmlFor="approved_yes" className="font-normal">Sim</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="false" id="approved_no" />
                                <Label htmlFor="approved_no" className="font-normal">Não</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {!form.watch("vehicleApproved") && (
                        <div>
                            <Label htmlFor="disapprovalReason">Motivo *</Label>
                            <Textarea
                                {...form.register("disapprovalReason")}
                                placeholder="Informe o motivo pelo qual o veículo não está apto..."
                                className="mt-1"
                                rows={2}
                            />
                            {form.formState.errors.disapprovalReason && (
                                <p className="text-sm text-red-600 mt-1">{form.formState.errors.disapprovalReason.message}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Botões */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="bg-[#DAA520] hover:bg-[#B8860B] text-white"
                    >
                        {createMutation.isPending && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        )}
                        Salvar Checklist
                    </Button>
                </div>
            </form>
        </div>
    );
}
