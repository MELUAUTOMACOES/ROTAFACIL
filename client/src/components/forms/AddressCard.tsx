import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, MapPin, Trash2 } from "lucide-react";
import { buscarEnderecoPorCep } from "@/lib/cep";
import { useToast } from "@/hooks/use-toast";

export type AddressData = {
  id?: number;
  label: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  lat?: number | null;
  lng?: number | null;
  isPrimary: boolean;
};

interface AddressCardProps {
  address: AddressData;
  index: number;
  isExpanded: boolean;
  canRemove: boolean;
  onUpdate: (index: number, field: keyof AddressData, value: string | boolean) => void;
  onRemove: (index: number) => void;
  onToggleExpand: (index: number) => void;
  onSetPrimary: (index: number) => void;
}

export default function AddressCard({
  address,
  index,
  isExpanded,
  canRemove,
  onUpdate,
  onRemove,
  onToggleExpand,
  onSetPrimary,
}: AddressCardProps) {
  const { toast } = useToast();
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  // Busca automática de CEP
  useEffect(() => {
    const cleanCep = address.cep?.replace(/\D/g, "") || "";
    
    if (cleanCep.length === 8) {
      const fetchAddress = async () => {
        setIsLoadingCep(true);
        try {
          const endereco = await buscarEnderecoPorCep(cleanCep);
          
          onUpdate(index, "logradouro", endereco.logradouro || "");
          onUpdate(index, "bairro", endereco.bairro || "");
          onUpdate(index, "cidade", endereco.localidade || "");
          onUpdate(index, "estado", endereco.uf || "");
        } catch (error) {
          console.warn("CEP lookup failed", error);
        } finally {
          setIsLoadingCep(false);
        }
      };
      fetchAddress();
    }
  }, [address.cep]);

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const handleCepChange = (value: string) => {
    onUpdate(index, "cep", formatCep(value));
  };

  const getAddressSummary = () => {
    if (!address.logradouro && !address.cidade) {
      return address.cep || "Novo endereço";
    }
    const parts = [
      address.logradouro,
      address.numero,
      address.bairro || address.cidade,
    ].filter(Boolean);
    return parts.join(", ") || address.cep || "Novo endereço";
  };

  return (
    <Card className={address.isPrimary ? "border-primary border-2" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              {isExpanded ? (
                <Input
                  placeholder="Ex: Matriz, Filial Sul, etc"
                  value={address.label}
                  onChange={(e) => onUpdate(index, "label", e.target.value)}
                  className="h-8"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {address.label || `Endereço ${index + 1}`}
                  </span>
                  {address.isPrimary && (
                    <Badge variant="default" className="h-5">
                      Principal
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!address.isPrimary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSetPrimary(index)}
                className="h-8 text-xs"
              >
                Tornar Principal
              </Button>
            )}
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onToggleExpand(index)}
              className="h-8 w-8"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {!isExpanded && (
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <span>{getAddressSummary()}</span>
            {address.isPrimary && (
              <Badge variant="default" className="h-5">
                Principal
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <Label htmlFor={`cep-${index}`}>
                CEP <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`cep-${index}`}
                placeholder="00000-000"
                value={address.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                disabled={isLoadingCep}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={`logradouro-${index}`}>
                Logradouro <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`logradouro-${index}`}
                placeholder="Rua, Avenida, etc"
                value={address.logradouro}
                onChange={(e) => onUpdate(index, "logradouro", e.target.value)}
                disabled={isLoadingCep}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1">
              <Label htmlFor={`numero-${index}`}>
                Número <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`numero-${index}`}
                placeholder="123"
                value={address.numero}
                onChange={(e) => onUpdate(index, "numero", e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <Label htmlFor={`complemento-${index}`}>Complemento</Label>
              <Input
                id={`complemento-${index}`}
                placeholder="Apto, Sala, Bloco, etc"
                value={address.complemento}
                onChange={(e) => onUpdate(index, "complemento", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor={`bairro-${index}`}>
                Bairro <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`bairro-${index}`}
                placeholder="Bairro"
                value={address.bairro}
                onChange={(e) => onUpdate(index, "bairro", e.target.value)}
                disabled={isLoadingCep}
              />
            </div>
            <div>
              <Label htmlFor={`cidade-${index}`}>
                Cidade <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`cidade-${index}`}
                placeholder="Cidade"
                value={address.cidade}
                onChange={(e) => onUpdate(index, "cidade", e.target.value)}
                disabled={isLoadingCep}
              />
            </div>
            <div>
              <Label htmlFor={`estado-${index}`}>
                Estado <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`estado-${index}`}
                placeholder="UF"
                value={address.estado}
                onChange={(e) => onUpdate(index, "estado", e.target.value.toUpperCase())}
                maxLength={2}
                disabled={isLoadingCep}
              />
            </div>
          </div>

          {address.isPrimary && (
            <div className="bg-primary/10 border border-primary rounded-md p-3">
              <p className="text-sm text-primary font-medium">
                ✓ Este é o endereço principal do cliente
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
