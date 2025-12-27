import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Fuel, TrendingUp, DollarSign, Gauge, Calendar, Filter, Download, Plus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Vehicle } from "@shared/schema";

interface FuelConsumptionTabProps {
    vehicles: Vehicle[];
}

export default function FuelConsumptionTab({ vehicles }: FuelConsumptionTabProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Filtros
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    // Modal e Formulário
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formVehicleId, setFormVehicleId] = useState<string>("");
    const [formFuelType, setFormFuelType] = useState<string>("gasolina");
    const [formLiters, setFormLiters] = useState("");
    const [formPricePerLiter, setFormPricePerLiter] = useState("");
    const [formTotalCost, setFormTotalCost] = useState("");
    const [formOdometer, setFormOdometer] = useState("");
    const [formDate, setFormDate] = useState("");
    const [formNotes, setFormNotes] = useState("");

    // Mutation para criar registro
    const createRecordMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/fuel-records", data);
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Sucesso",
                description: "Registro de abastecimento criado com sucesso.",
            });
            setIsModalOpen(false);
            // Limpar formulário
            setFormVehicleId("");
            setFormFuelType("gasolina");
            setFormLiters("");
            setFormPricePerLiter("");
            setFormTotalCost("");
            setFormOdometer("");
            setFormDate("");
            setFormNotes("");
            // Invalidar queries
            queryClient.invalidateQueries({ queryKey: ['/api/fuel-records'] });
            queryClient.invalidateQueries({ queryKey: ['/api/fuel-records/stats'] });
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    // Buscar registros de abastecimento
    const { data: records, isLoading } = useQuery({
        queryKey: ['/api/fuel-records', selectedVehicleId, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedVehicleId && selectedVehicleId !== "all") params.append('vehicleId', selectedVehicleId);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const res = await apiRequest("GET", `/api/fuel-records?${params.toString()}`);
            return res.json();
        }
    });

    // Buscar estatísticas por veículo (se um veículo estiver selecionado)
    const { data: stats } = useQuery({
        queryKey: ['/api/fuel-records/stats', selectedVehicleId],
        queryFn: async () => {
            if (!selectedVehicleId || selectedVehicleId === "all") return null;
            const res = await apiRequest("GET", `/api/fuel-records/vehicle/${selectedVehicleId}/stats`);
            return res.json();
        },
        enabled: selectedVehicleId !== "all"
    });

    // Calcular estatísticas gerais locais se "Todos" estiver selecionado
    const metrics = React.useMemo(() => {
        if (selectedVehicleId !== "all" && stats) return stats;

        if (!records) return { totalLiters: 0, totalCost: 0, avgPricePerLiter: 0, recordCount: 0 };

        const totalLiters = records.reduce((acc: number, r: any) => acc + Number(r.liters), 0);
        const totalCost = records.reduce((acc: number, r: any) => acc + Number(r.totalCost), 0);
        const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

        return {
            totalLiters: totalLiters.toFixed(2),
            totalCost: totalCost.toFixed(2),
            avgPricePerLiter: avgPrice.toFixed(3),
            recordCount: records.length
        };
    }, [records, selectedVehicleId, stats]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-lg border shadow-sm">
                <div className="space-y-2 w-full md:w-64">
                    <Label>Veículo</Label>
                    <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Todos os veículos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os veículos</SelectItem>
                            {vehicles?.map((v) => (
                                <SelectItem key={v.id} value={v.id.toString()}>
                                    {v.plate} - {v.model}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2 w-full md:w-40">
                    <Label>Data Início</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>

                <div className="space-y-2 w-full md:w-40">
                    <Label>Data Fim</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setSelectedVehicleId("all"); setStartDate(""); setEndDate(""); }}>
                        <Filter className="w-4 h-4 mr-2" />
                        Limpar
                    </Button>
                    <Button
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => {
                            // Ajuste para fuso horário local (Brasil -3h)
                            const now = new Date();
                            const offsetMs = now.getTimezoneOffset() * 60000;
                            const localIso = new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
                            setFormDate(localIso);
                            setIsModalOpen(true);
                        }}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Registrar
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {Number(metrics?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Litros</CardTitle>
                        <Fuel className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Number(metrics?.totalLiters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Preço Médio/L</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {Number(metrics?.avgPricePerLiter || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Registros</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.recordCount || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Abastecimentos</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8 text-gray-500">Carregando dados...</div>
                    ) : records?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-500 border-2 border-dashed rounded-lg">
                            <Fuel className="w-12 h-12 mb-2 opacity-20" />
                            <p>Nenhum registro de abastecimento encontrado.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Veículo</TableHead>
                                    <TableHead>Combustível</TableHead>
                                    <TableHead>Litros</TableHead>
                                    <TableHead>Preço/L</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Odômetro</TableHead>
                                    <TableHead>Obs</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records?.map((record: any) => {
                                    const vehicle = vehicles.find(v => v.id === record.vehicleId);
                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell>{format(new Date(record.fuelDate), "dd/MM/yyyy HH:mm")}</TableCell>
                                            <TableCell className="font-medium">
                                                {vehicle ? `${vehicle.plate} - ${vehicle.model}` : `ID: ${record.vehicleId}`}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {record.fuelType.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{Number(record.liters).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} L</TableCell>
                                            <TableCell>R$ {Number(record.pricePerLiter).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</TableCell>
                                            <TableCell className="font-bold">R$ {Number(record.totalCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                            <TableCell>{record.odometerKm ? `${record.odometerKm} km` : '-'}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={record.notes}>
                                                {record.notes || '-'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Abastecimento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Veículo</Label>
                            <Select value={formVehicleId} onValueChange={setFormVehicleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o veículo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicles?.map((v) => (
                                        <SelectItem key={v.id} value={v.id.toString()}>
                                            {v.plate} - {v.model} {v.brand}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Data e Hora</Label>
                            <Input
                                type="datetime-local"
                                value={formDate}
                                onChange={(e) => setFormDate(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={formFuelType} onValueChange={setFormFuelType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gasolina">Gasolina</SelectItem>
                                        <SelectItem value="etanol">Etanol</SelectItem>
                                        <SelectItem value="diesel_s10">Diesel S10</SelectItem>
                                        <SelectItem value="diesel_s500">Diesel S500</SelectItem>
                                        <SelectItem value="gnv">GNV</SelectItem>
                                        <SelectItem value="eletrico">Elétrico</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Odômetro (km)</Label>
                                <Input type="number" value={formOdometer} onChange={(e) => setFormOdometer(e.target.value)} placeholder="Ex: 15400" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-2">
                                <Label>Litros</Label>
                                <Input
                                    type="number"
                                    value={formLiters}
                                    onChange={(e) => {
                                        const l = e.target.value;
                                        setFormLiters(l);
                                        if (l && formPricePerLiter) {
                                            setFormTotalCost((parseFloat(l) * parseFloat(formPricePerLiter)).toFixed(2));
                                        }
                                    }}
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Preço/L</Label>
                                <Input
                                    type="number"
                                    value={formPricePerLiter}
                                    onChange={(e) => {
                                        const p = e.target.value;
                                        setFormPricePerLiter(p);
                                        if (formLiters && p) {
                                            setFormTotalCost((parseFloat(formLiters) * parseFloat(p)).toFixed(2));
                                        }
                                    }}
                                    placeholder="0.00"
                                    step="0.001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Total R$</Label>
                                <Input
                                    type="number"
                                    value={formTotalCost}
                                    onChange={(e) => setFormTotalCost(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                                value={formNotes}
                                onChange={(e) => setFormNotes(e.target.value)}
                                placeholder="Posto Shell..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={() => {
                                createRecordMutation.mutate({
                                    vehicleId: parseInt(formVehicleId),
                                    fuelType: formFuelType,
                                    liters: formLiters,
                                    pricePerLiter: formPricePerLiter,
                                    totalCost: formTotalCost,
                                    odometerKm: formOdometer ? parseInt(formOdometer) : null,
                                    notes: formNotes,
                                    fuelDate: formDate ? new Date(formDate) : new Date(),
                                });
                            }}
                            disabled={!formVehicleId || !formLiters || !formTotalCost || createRecordMutation.isPending}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            {createRecordMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
