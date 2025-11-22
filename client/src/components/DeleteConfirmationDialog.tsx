import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
}

export function DeleteConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Confirmar Exclusão",
    description = "Esta ação é irreversível. Tem certeza que deseja excluir este item?",
}: DeleteConfirmationDialogProps) {
    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                        <p>{description}</p>
                        <p className="text-red-600 font-semibold">
                            ⚠️ Esta ação não pode ser desfeita!
                        </p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                    >
                        Excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
