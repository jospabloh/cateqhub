import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import BadgeSheet from "@/components/BadgeSheet";
import { paginateChildren } from "@/lib/badgeLayout";
import { exportBadgeSheetPNG, exportBadgeSheetPDF, exportBadgeSheetSVG } from "@/lib/badgeExport";
import { ChevronLeft, ChevronRight, Download, Printer, QrCode } from "lucide-react";

export default function BadgePrint() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [children, setChildren] = useState(location.state?.children ?? null);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const pageRefs = useRef([]);

  // Si se recarga la página (o se abre el enlace directo), no hay location.state —
  // se vuelve a resolver desde los ids en la URL.
  useEffect(() => {
    if (children) return;
    const ids = (searchParams.get("ids") || "").split(",").filter(Boolean);
    if (!ids.length) return;
    setLoading(true);
    Promise.all(ids.map((id) => base44.entities.Child.get(id).catch(() => null)))
      .then((rows) => setChildren(rows.filter(Boolean)))
      .finally(() => setLoading(false));
  }, [children, searchParams]);

  const pages = useMemo(() => paginateChildren(children ?? []), [children]);
  const totalPages = pages.length;

  useEffect(() => {
    if (activePage >= totalPages) setActivePage(Math.max(0, totalPages - 1));
  }, [totalPages, activePage]);

  const filenameBase = `gafetes-qr-${new Date().toISOString().slice(0, 10)}`;

  const handlePNG = async () => {
    setExporting(true);
    try {
      await exportBadgeSheetPNG(pageRefs.current[activePage], `${filenameBase}-pagina-${activePage + 1}.png`);
    } finally {
      setExporting(false);
    }
  };

  const handleSVG = () => {
    exportBadgeSheetSVG(pages[activePage], `${filenameBase}-pagina-${activePage + 1}.svg`);
  };

  const handlePDF = async () => {
    setExporting(true);
    try {
      await exportBadgeSheetPDF(pageRefs.current, `${filenameBase}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  if (!children || children.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <QrCode className="w-6 h-6 text-gold" />Imprimir gafetes
        </h1>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {loading ? "Cargando…" : (
              <>No hay niños seleccionados. Vuelve a <Link to="/ninos" className="text-primary hover:underline">Niños</Link> y selecciona a quién imprimir.</>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="print:hidden space-y-2">
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <QrCode className="w-6 h-6 text-gold" />Imprimir gafetes
        </h1>
        <p className="text-sm text-muted-foreground">
          {children.length} {children.length === 1 ? "niño seleccionado" : "niños seleccionados"} · {totalPages}{" "}
          {totalPages === 1 ? "hoja tamaño carta" : "hojas tamaño carta"}.
        </p>
        <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
          El gafete impreso o descargado lleva <strong>únicamente el nombre del niño y el código QR</strong> con sus
          guías de corte de esquina — sin logo ni ningún otro dato.
        </p>
      </div>

      <div className="print:hidden flex flex-wrap items-center gap-3">
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" disabled={activePage === 0} onClick={() => setActivePage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground whitespace-nowrap">Página {activePage + 1} de {totalPages}</span>
            <Button size="icon" variant="outline" disabled={activePage === totalPages - 1} onClick={() => setActivePage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 md:ml-auto">
          <Button variant="outline" disabled={exporting} onClick={handlePNG}><Download className="w-4 h-4 mr-2" />PNG</Button>
          <Button variant="outline" disabled={exporting} onClick={handleSVG}><Download className="w-4 h-4 mr-2" />SVG</Button>
          <Button variant="outline" disabled={exporting} onClick={handlePDF}>
            <Download className="w-4 h-4 mr-2" />PDF{totalPages > 1 ? ` (${totalPages} hojas)` : ""}
          </Button>
          <Button disabled={exporting} onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
        </div>
      </div>

      <div className="overflow-auto border rounded-lg bg-muted/30 p-4 flex justify-center print:p-0 print:border-0 print:overflow-visible print:bg-white">
        <BadgeSheet pages={pages} activePage={activePage} pageRefs={pageRefs} />
      </div>
    </div>
  );
}
