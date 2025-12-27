import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Option {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
}

interface MultiSelectFilterProps {
    title: string;
    options: Option[];
    selectedValues: string[];
    onSelectionChange: (values: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
}

export function MultiSelectFilter({
    title,
    options,
    selectedValues,
    onSelectionChange,
    placeholder = "Selecione...",
    searchPlaceholder = "Buscar...",
    className,
}: MultiSelectFilterProps) {
    const [open, setOpen] = React.useState(false);

    const handleSelect = (value: string) => {
        const newSelected = selectedValues.includes(value)
            ? selectedValues.filter((v) => v !== value)
            : [...selectedValues, value];
        onSelectionChange(newSelected);
    };

    const handleClear = () => {
        onSelectionChange([]);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "h-8 w-full justify-between bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 border-dashed dark:border-zinc-600",
                        selectedValues.length > 0 ? "border-solid" : "",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-medium text-gray-600 dark:text-zinc-300">{title}</span>
                        {selectedValues.length > 0 && (
                            <>
                                <div className="h-4 w-[1px] bg-gray-300 dark:bg-zinc-600" />
                                <Badge
                                    variant="secondary"
                                    className="rounded-sm px-1 font-normal text-[10px] h-5"
                                >
                                    {selectedValues.length} selecionado(s)
                                </Badge>
                            </>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selectedValues.includes(option.value);
                                const Icon = option.icon;

                                return (
                                    <CommandItem
                                        key={option.value}
                                        onSelect={() => handleSelect(option.value)}
                                        className="text-xs"
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-3 w-3")} />
                                        </div>
                                        {Icon && <Icon className="mr-2 h-3 w-3 text-muted-foreground" />}
                                        <span>{option.label}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {selectedValues.length > 0 && (
                            <>
                                <div className="h-[1px] bg-gray-100 dark:bg-zinc-700 my-1" />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={handleClear}
                                        className="justify-center text-center text-xs font-medium"
                                    >
                                        Limpar filtros
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
