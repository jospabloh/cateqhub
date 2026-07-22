import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function RestrictedNotice() {
  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-2">
        <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-medium">Acceso restringido</p>
        <p className="text-sm text-muted-foreground">Esta función está disponible solo para administradores de la parroquia.</p>
      </CardContent>
    </Card>
  );
}