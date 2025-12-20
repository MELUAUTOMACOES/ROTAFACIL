import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Trash2, Calendar, AlertCircle } from "lucide-react";
import type { VehicleDocument } from "@shared/schema";

interface VehicleDocumentsSectionProps {
    vehicleId: number;
}

const DOCUMENT_TYPES = [
    { value: "crlv", label: "CRLV" },
    { value: "seguro", label: "Seguro" },
    { value: "contrato", label: "Contrato" },
    { value: "nota_fiscal", label: "Nota Fiscal" },
    { value: "outro", label: "Outro" },
];

export default function VehicleDocumentsSection({ vehicleId }: VehicleDocumentsSectionProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [newDocument, setNewDocument] = useState({
        name: "",
        type: "outro",
        fileUrl: "",
        fileName: "",
        expirationDate: "",
        notes: "",
    });

    const { data: documents = [], isLoading } = useQuery<VehicleDocument[]>({
        queryKey: [`/api/vehicles/${vehicleId}/documents`],
        queryFn: async () => {
            const response = await fetch(`/api/vehicles/${vehicleId}/documents`, {
                headers: getAuthHeaders(),
            });
            return response.json();
        },
        enabled: !!vehicleId,
    });

    const createDocumentMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiRequest("POST", `/api/vehicles/${vehicleId}/documents`, data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/documents`] });
            toast({
                title: "Sucesso",
                description: "Documento adicionado com sucesso",
            });
            setIsAdding(false);
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message || "Erro ao adicionar documento",
                variant: "destructive",
            });
        },
    });

    const deleteDocumentMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/vehicles/${vehicleId}/documents/${id}`, undefined);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/documents`] });
            toast({
                title: "Sucesso",
                description: "Documento excluído com sucesso",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message || "Erro ao excluir documento",
                variant: "destructive",
            });
        },
    });

    const resetForm = () => {
        setNewDocument({
            name: "",
            type: "outro",
            fileUrl: "",
            fileName: "",
            expirationDate: "",
            notes: "",
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Verificar tamanho (máximo 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast({
                    title: "Erro",
                    description: "Arquivo muito grande. Máximo 5MB.",
                    variant: "destructive",
                });
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                setNewDocument({
                    ...newDocument,
                    fileUrl: reader.result as string,
                    fileName: file.name,
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!newDocument.name || !newDocument.fileUrl) {
            toast({
                title: "Erro",
                description: "Preencha o nome e selecione um arquivo",
                variant: "destructive",
            });
            return;
        }

        createDocumentMutation.mutate({
            ...newDocument,
            expirationDate: newDocument.expirationDate || null,
        });
    };

    const handleDelete = (doc: VehicleDocument) => {
        if (confirm(`Tem certeza que deseja excluir o documento "${doc.name}"?`)) {
            deleteDocumentMutation.mutate(doc.id);
        }
    };

    const isExpiring = (date: Date | null) => {
        if (!date) return false;
        const now = new Date();
        const expirationDate = new Date(date);
        const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiration <= 30 && daysUntilExpiration > 0;
    };

    const isExpired = (date: Date | null) => {
        if (!date) return false;
        return new Date(date) < new Date();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-burnt-yellow"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-burnt-yellow" />
                    Documentos ({documents.length})
                </h3>
                {!isAdding && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAdding(true)}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Adicionar Documento
                    </Button>
                )}
            </div>

            {/* Formulário de novo documento */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="doc-name">Nome do Documento *</Label>
                            <Input
                                id="doc-name"
                                value={newDocument.name}
                                onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                                placeholder="Ex: CRLV 2024, Apólice Seguro"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="doc-type">Tipo</Label>
                            <Select
                                value={newDocument.type}
                                onValueChange={(value) => setNewDocument({ ...newDocument, type: value })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DOCUMENT_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="doc-file">Arquivo *</Label>
                            <Input
                                id="doc-file"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                onChange={handleFileChange}
                                className="mt-1"
                            />
                            {newDocument.fileName && (
                                <p className="text-xs text-green-600 mt-1">
                                    ✓ {newDocument.fileName}
                                </p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="doc-expiration">Data de Vencimento</Label>
                            <Input
                                id="doc-expiration"
                                type="date"
                                value={newDocument.expirationDate}
                                onChange={(e) => setNewDocument({ ...newDocument, expirationDate: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="doc-notes">Observações</Label>
                        <Textarea
                            id="doc-notes"
                            value={newDocument.notes}
                            onChange={(e) => setNewDocument({ ...newDocument, notes: e.target.value })}
                            placeholder="Observações sobre o documento..."
                            className="mt-1"
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsAdding(false);
                                resetForm();
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={createDocumentMutation.isPending}
                            className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                        >
                            {createDocumentMutation.isPending ? "Salvando..." : "Salvar Documento"}
                        </Button>
                    </div>
                </form>
            )}

            {/* Lista de documentos */}
            {documents.length === 0 && !isAdding ? (
                <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>Nenhum documento cadastrado</p>
                    <p className="text-sm">Adicione documentos como CRLV, seguro, contratos, etc.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${isExpired(doc.expirationDate)
                                    ? "border-red-300 bg-red-50"
                                    : isExpiring(doc.expirationDate)
                                        ? "border-yellow-300 bg-yellow-50"
                                        : "bg-white"
                                }`}
                        >
                            <div className="flex items-center space-x-3">
                                <FileText className="h-8 w-8 text-gray-400" />
                                <div>
                                    <p className="font-medium">{doc.name}</p>
                                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                            {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                                        </span>
                                        <span>{doc.fileName}</span>
                                        {doc.expirationDate && (
                                            <span className="flex items-center">
                                                <Calendar className="h-3 w-3 mr-1" />
                                                Vence: {new Date(doc.expirationDate).toLocaleDateString("pt-BR")}
                                                {isExpired(doc.expirationDate) && (
                                                    <span className="ml-1 text-red-600 flex items-center">
                                                        <AlertCircle className="h-3 w-3 mr-1" />
                                                        Vencido
                                                    </span>
                                                )}
                                                {isExpiring(doc.expirationDate) && !isExpired(doc.expirationDate) && (
                                                    <span className="ml-1 text-yellow-600 flex items-center">
                                                        <AlertCircle className="h-3 w-3 mr-1" />
                                                        Vence em breve
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        // Abrir documento em nova aba
                                        const link = document.createElement("a");
                                        link.href = doc.fileUrl;
                                        link.download = doc.fileName;
                                        link.click();
                                    }}
                                >
                                    Download
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(doc)}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
