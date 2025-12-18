import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@shared/schema";
import { ClientSelectionModal } from "@/components/modals/ClientSelectionModal";

interface ClientSearchProps {
  value?: number | null;
  onValueChange: (value: number | undefined) => void;
  onSelect?: (client: Client | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ClientSearch({ value, onValueChange, onSelect, placeholder = "Pesquisar por nome ou CPF", disabled = false }: ClientSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  console.log("ClientSearch Debug - value:", value, "searchQuery:", searchQuery, "selectedClient:", selectedClient?.name);

  // Buscar clientes quando houver query (para o autocomplete inline)
  const { data: searchResults = [], isLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients/search', searchQuery],
    queryFn: async () => {
      console.log("Busca cliente - input:", searchQuery);
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(searchQuery)}&limit=5`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Erro na busca');
      }
      const result = await response.json();
      console.log("Resultados encontrados:", result.data);
      return result.data || [];
    },
    enabled: searchQuery.length >= 2 && !selectedClient, // Só busca se não tiver cliente selecionado
    staleTime: 30000,
  });

  // Buscar cliente selecionado para mostrar o nome inicial
  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  useEffect(() => {
    if (value && allClients.length > 0) {
      const client = allClients.find((c) => c.id === value);
      if (client) {
        setSelectedClient(client);
        setSearchQuery(client.name);
        console.log("Cliente selecionado encontrado:", client.name);
      }
    } else if (!value) {
      setSelectedClient(null);
      setSearchQuery("");
    }
  }, [value, allClients]);

  // Mostrar resultados quando houver busca e o input estiver focado
  useEffect(() => {
    setShowResults(inputFocused && searchQuery.length >= 2 && !selectedClient);
  }, [inputFocused, searchQuery, selectedClient]);

  // Fechar resultados quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowResults(false);
        setInputFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const query = e.target.value;
    console.log("Input alterado para:", query);
    setSearchQuery(query);

    if (selectedClient && query !== selectedClient.name) {
      setSelectedClient(null);
      onValueChange(undefined);
      if (onSelect) onSelect(null);
    }
  };

  const handleInputFocus = () => {
    if (disabled) return;
    console.log("Input focado");
    setInputFocused(true);
  };

  const handleSelect = (client: Client) => {
    console.log("Cliente selecionado:", client.name);
    setSelectedClient(client);
    onValueChange(client.id);
    if (onSelect) onSelect(client);
    setSearchQuery(client.name);
    setShowResults(false);
    setInputFocused(false);
  };

  const handleClear = () => {
    console.log("Limpando seleção de cliente");
    setSelectedClient(null);
    onValueChange(undefined);
    if (onSelect) onSelect(null);
    setSearchQuery("");
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="relative w-full flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            className="w-full pr-8"
            disabled={disabled}
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
            >
              <X className="h-4 w-4 text-gray-500" />
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsModalOpen(true)}
          disabled={disabled}
          title="Buscar cliente avançada"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Resultados da busca inline */}
        {showResults && (
          <div
            ref={resultsRef}
            className="absolute top-full left-0 z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Buscando...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="py-1">
                {searchResults.slice(0, 5).map((client) => (
                  <div
                    key={client.id}
                    onClick={() => handleSelect(client)}
                    className={cn(
                      "px-4 py-2 cursor-pointer hover:bg-gray-100",
                      "border-b border-gray-100 last:border-b-0"
                    )}
                  >
                    <div className="font-medium">{client.name}</div>
                    <div className="text-sm text-muted-foreground">
                      CPF: {client.cpf} • {client.logradouro}, {client.numero}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Cliente não encontrado
              </div>
            )}
          </div>
        )}
      </div>

      <ClientSelectionModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSelect={handleSelect}
      />
    </>
  );
}