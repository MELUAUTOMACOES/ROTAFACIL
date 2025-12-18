
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, User, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Client } from "@shared/schema";

interface ClientSelectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (client: Client) => void;
}

export function ClientSelectionModal({ open, onOpenChange, onSelect }: ClientSelectionModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [page, setPage] = useState(1);
    const limit = 20;

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setPage(1); // Reset page on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const { data, isLoading } = useQuery<{ data: Client[], total: number }>({
        queryKey: ['/api/clients/search', debouncedQuery, page],
        queryFn: async () => {
            const endpoint = debouncedQuery
                ? `/api/clients/search?q=${encodeURIComponent(debouncedQuery)}&page=${page}&limit=${limit}`
                : `/api/clients?page=${page}&limit=${limit}`;

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (!response.ok) throw new Error('Erro na busca');
            return response.json();
        },
        enabled: open,
        placeholderData: (previousData) => previousData,
    });

    const clients = data?.data || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const handleSelect = (client: Client) => {
        onSelect(client);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Selecionar Cliente</DialogTitle>
                </DialogHeader>

                <div className="flex items-center space-x-2 py-4">
                    <Search className="w-5 h-5 text-gray-500" />
                    <Input
                        placeholder="Buscar por nome, CPF, telefone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1"
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-auto min-h-[300px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Buscando...
                        </div>
                    ) : clients.length > 0 ? (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>CPF</TableHead>
                                        <TableHead>Endereço</TableHead>
                                        <TableHead>Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {clients.map((client) => (
                                        <TableRow key={client.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleSelect(client)}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center">
                                                    <User className="w-4 h-4 mr-2 text-gray-400" />
                                                    {client.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>{client.cpf}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center text-sm text-gray-500">
                                                    <MapPin className="w-3 h-3 mr-1" />
                                                    {client.logradouro}, {client.numero} - {client.bairro}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button size="sm" variant="outline" onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelect(client);
                                                }}>
                                                    Selecionar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-end space-x-2 py-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-gray-600">
                                        Página {page} de {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                    >
                                        Próxima
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                            <p>Nenhum cliente encontrado.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
