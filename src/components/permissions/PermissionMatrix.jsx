import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, RotateCcw } from "lucide-react";
import { PERMISSION_REGISTRY, permissionKey, getRegistryDefaults } from "@/lib/permissionRegistry";

export default function PermissionMatrix({ permissions, onSave, saving }) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);

  const defaults = useMemo(() => getRegistryDefaults(), []);
  const effective = useMemo(() => ({ ...defaults, ...permissions }), [defaults, permissions]);
  const current = editMode ? draft : effective;

  const total = useMemo(
    () => Object.values(PERMISSION_REGISTRY).reduce((sum, m) => sum + m.actions.length, 0),
    []
  );
  const granted = Object.values(current).filter((v) => v === true).length;

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
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Qué puede hacer un catequista</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {editMode
              ? "Activa o desactiva cada permiso y guarda para aplicarlo a todos los catequistas de tu parroquia."
              : "El administrador de parroquia siempre tiene acceso total. Esto solo controla al rol catequista."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline">{granted}/{total}</Badge>
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
      <CardContent className="space-y-5">
        {editMode && (
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={resetToDefault}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Restaurar valores por defecto
          </Button>
        )}
        {Object.entries(PERMISSION_REGISTRY).map(([module, data]) => (
          <div key={module} className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{data.label}</p>
            <div className="divide-y divide-border rounded-lg border">
              {data.actions.map((action) => {
                const key = permissionKey(module, action.id);
                const isOn = current[key] === true;
                return (
                  <div key={key} className="flex items-center justify-between gap-4 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{action.label}</p>
                      {action.description && (
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      )}
                    </div>
                    <Switch
                      checked={isOn}
                      disabled={!editMode}
                      onCheckedChange={() => editMode && toggle(key)}
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
