import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Save, X, RotateCcw } from "lucide-react";
import { PERMISSION_REGISTRY, permissionKey, getRegistryDefaults } from "@/lib/permissionRegistry";

export default function PermissionMatrix({ permissions, onSave, saving }) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);

  const defaults = useMemo(() => getRegistryDefaults(), []);
  const effective = useMemo(() => ({ ...defaults, ...permissions }), [defaults, permissions]);
  const current = editMode ? draft : effective;

  const startEdit = () => { setDraft({ ...effective }); setEditMode(true); };
  const cancelEdit = () => { setDraft(null); setEditMode(false); };
  const resetToDefault = () => setDraft({ ...defaults });
  const toggle = (key) => setDraft((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    const ok = await onSave(draft);
    if (ok) setEditMode(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Catequista · reglas por módulo</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {editMode
              ? "Activa o desactiva cada permiso y guarda para aplicarlo a todos los catequistas de tu parroquia."
              : "Esto solo controla al rol catequista — el administrador de parroquia siempre tiene acceso total."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editMode ? (
            <>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="w-4 h-4 mr-1" />Cancelar
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="w-4 h-4 mr-1" />{saving ? "Guardando…" : "Guardar"}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="w-4 h-4 mr-1" />Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-6">
        {editMode && (
          <Button size="sm" variant="ghost" className="text-muted-foreground -mt-1 -ml-2" onClick={resetToDefault}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Restaurar valores por defecto
          </Button>
        )}
        {Object.entries(PERMISSION_REGISTRY).map(([module, data]) => (
          <div key={module}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-2">{data.label}</p>
            <div className="divide-y divide-border">
              {data.actions.map((action) => {
                const key = permissionKey(module, action.id);
                const isOn = current[key] === true;
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between gap-4 py-3 pl-3 -ml-3 border-l-2 transition-colors ${
                      isOn ? "border-l-primary/50" : "border-l-transparent"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      {action.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">{key}</p>
                    </div>
                    <Switch
                      checked={isOn}
                      disabled={!editMode}
                      onCheckedChange={() => editMode && toggle(key)}
                      className="shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
