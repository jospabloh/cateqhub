import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DATA_PROCESSING_NOTICE } from "@/lib/legal";

export default function ConsentDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aviso sobre el manejo de datos personales sensibles</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          {DATA_PROCESSING_NOTICE.map((section) => (
            <div key={section.heading}>
              <p className="font-medium text-foreground mb-1">{section.heading}</p>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
