import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type PeriodType = "7d" | "30d" | "90d" | "365d" | "custom";

export interface DateRangeFilterState {
  period: PeriodType;
  startDate?: string;
  endDate?: string;
}

interface DateRangeFilterProps {
  value: DateRangeFilterState;
  onChange: (state: DateRangeFilterState) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [tempStartDate, setTempStartDate] = useState<string>(value.startDate || "");
  const [tempEndDate, setTempEndDate] = useState<string>(value.endDate || "");

  // Inicializar datas quando o componente monta (apenas se não tiver datas)
  useEffect(() => {
    if (value.period !== "custom" && !value.startDate && !value.endDate) {
      const { startDate, endDate } = calculateDateRange(value.period);
      onChange({ period: value.period, startDate, endDate });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (period: PeriodType) => {
    if (period === "custom") {
      // Modo personalizado: não aplicar datas ainda
      onChange({ period });
      setTempStartDate(value.startDate || "");
      setTempEndDate(value.endDate || "");
    } else {
      // Período pré-definido: calcular e aplicar imediatamente
      const { startDate, endDate } = calculateDateRange(period);
      onChange({ period, startDate, endDate });
    }
  };

  const handleApplyCustom = () => {
    if (tempStartDate && tempEndDate) {
      onChange({
        period: "custom",
        startDate: tempStartDate,
        endDate: tempEndDate,
      });
    }
  };

  const periodLabels: Record<PeriodType, string> = {
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
    "365d": "Último ano",
    "custom": "Personalizado",
  };

  const formatDateForDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-400" />
        <Select value={value.period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="h-9 w-[180px] bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Selecione período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="365d">Último ano</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.period === "custom" && (
        <>
          <Input
            type="date"
            value={tempStartDate}
            onChange={(e) => setTempStartDate(e.target.value)}
            className="h-9 w-[140px] text-sm bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            placeholder="Data início"
          />
          <Input
            type="date"
            value={tempEndDate}
            onChange={(e) => setTempEndDate(e.target.value)}
            className="h-9 w-[140px] text-sm bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            placeholder="Data fim"
          />
          <Button
            onClick={handleApplyCustom}
            size="sm"
            className="h-9 bg-amber-500 hover:bg-amber-600 text-white"
            disabled={!tempStartDate || !tempEndDate}
          >
            Aplicar
          </Button>
        </>
      )}

      {value.startDate && value.endDate && (
        <div className="text-xs text-gray-500 dark:text-zinc-400">
          {value.period === "custom" && "Filtrado: "}
          {formatDateForDisplay(value.startDate)} - {formatDateForDisplay(value.endDate)}
        </div>
      )}
    </div>
  );
}

function calculateDateRange(period: PeriodType): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case "7d":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "90d":
      startDate.setDate(startDate.getDate() - 90);
      break;
    case "365d":
      startDate.setDate(startDate.getDate() - 365);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}
