import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { manualArticles } from "@/lib/manualData";
import { BookOpen, Search } from "lucide-react";

function renderContent(content) {
  return content
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block, i) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.every((l) => l.startsWith("- "))) {
        return (
          <ul key={i} className="list-disc list-inside space-y-1">
            {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
          </ul>
        );
      }
      return <p key={i}>{block.trim()}</p>;
    });
}

export default function Manual() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return manualArticles;
    return manualArticles.filter(
      (a) => a.title.toLowerCase().includes(q) || a.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const a of filtered) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category).push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><BookOpen className="w-6 h-6 text-gold" />Manual de usuario</h1>
        <p className="text-muted-foreground text-sm">Guías rápidas sobre cómo usar CateqHub.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar en el manual…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {grouped.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No encontramos nada con "{search}".</CardContent></Card>
      ) : (
        grouped.map(([category, articles]) => (
          <Card key={category}>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">{category}</h3>
              <Accordion type="single" collapsible>
                {articles.map((a) => (
                  <AccordionItem key={a.id} value={a.id}>
                    <AccordionTrigger>{a.title}</AccordionTrigger>
                    <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                      {renderContent(a.content)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
