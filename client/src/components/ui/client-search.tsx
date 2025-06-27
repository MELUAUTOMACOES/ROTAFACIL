import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@shared/schema";

interface ClientSearchProps {
  value?: number | null;
  onValueChange: (value: number | undefined) => void;
  placeholder?: string;
}

export function ClientSearch({ value, onValueChange, placeholder = "Pesquisar por nome ou CPF" }: ClientSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  console.log("ClientSearch Debug - value:", value, "searchQuery:", searchQuery, "selectedClient:", selectedClient?.name);

  // Buscar clientes quando houver query
  const { data: searchResults = [], isLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients/search', searchQuery],
    queryFn: async () => {
      console.log("Busca cliente - input:", searchQuery);
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Erro na busca');
      }
      const results = await response.json();
      console.log("Resultados encontrados:", results);
      return results;
    },
    enabled: searchQuery.length >= 2,
    staleTime: 30000, // Cache por 30 segundos
  });

  // Buscar cliente selecionado para mostrar o nome
  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  useEffect(() => {
    if (value && allClients.length > 0) {
      const client = allClients.find((c) => c.id === value);
      setSelectedClient(client || null);
      console.log("Cliente selecionado encontrado:", client?.name);
    } else {
      setSelectedClient(null);
      console.log("Nenhum cliente selecionado");
    }
  }, [value, allClients]);

  // Mostrar resultados quando houver busca e o input estiver focado
  useEffect(() => {
    setShowResults(inputFocused && searchQuery.length >= 2);
  }, [inputFocused, searchQuery]);

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
    const query = e.target.value;
    console.log("Input alterado para:", query);
    setSearchQuery(query);
    
    // Se o input foi limpo e há um cliente selecionado, manter o nome
    if (query === "" && selectedClient) {
      // Não faz nada, mantém o cliente selecionado
    }
  };

  const handleInputFocus = () => {
    console.log("Input focado");
    setInputFocused(true);
    // Limpar o input para permitir nova busca
    if (selectedClient) {
      setSearchQuery("");
    }
  };

  const handleSelect = (client: Client) => {
    console.log("Cliente selecionado:", client.name);
    setSelectedClient(client);
    onValueChange(client.id);
    setSearchQuery(client.name); // Mostrar o nome no input
    setShowResults(false);
    setInputFocused(false);
  };

  const handleClear = () => {
    console.log("Limpando seleção de cliente");
    setSelectedClient(null);
    onValueChange(undefined);
    setSearchQuery("");
    inputRef.current?.focus();
  };

  // Valor do input: nome do cliente selecionado ou texto da busca
  const inputValue = selectedClient && !inputFocused ? selectedClient.name : searchQuery;

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className="w-full pr-8"
        />
        {selectedClient && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Resultados da busca */}
      {showResults && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
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
  );
}