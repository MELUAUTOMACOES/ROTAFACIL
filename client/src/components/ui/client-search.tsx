import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@shared/schema";

interface ClientSearchProps {
  value?: number | null;
  onValueChange: (value: number | undefined) => void;
  placeholder?: string;
}

export function ClientSearch({ value, onValueChange, placeholder = "Buscar cliente..." }: ClientSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Buscar clientes quando houver query
  const { data: searchResults = [], isLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients/search', searchQuery],
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
    } else {
      setSelectedClient(null);
    }
  }, [value, allClients]);

  const handleSelect = (client: Client) => {
    setSelectedClient(client);
    onValueChange(client.id);
    setOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    setSelectedClient(null);
    onValueChange(undefined);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedClient ? (
            <span className="truncate">
              {selectedClient.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Buscar por nome ou CPF"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          {searchQuery.length >= 2 ? (
            <>
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Buscando...
                </div>
              ) : searchResults.length > 0 ? (
                <CommandGroup>
                  {searchResults.map((client) => (
                    <CommandItem
                      key={client.id}
                      onSelect={() => handleSelect(client)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {client.logradouro}, {client.numero}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <CommandEmpty>Cliente não encontrado</CommandEmpty>
              )}
            </>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}
          {selectedClient && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="w-full"
              >
                Limpar seleção
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}