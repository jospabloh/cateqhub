import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QrCode, CalendarDays, ChevronDown } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/lib/PermissionContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Reports() {
  const { user } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("all");
  const [from, setFrom] = useState(subDays(new Date(), 30).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [attendances, setAttendances] = useState([]);
  const [children, setChildren] = useState([]);

  useEffect(() => {
    if (!user?.parish_id) return;
    const gFilter = { parish_id: user.parish_id };
    const restricted = !can("reportes", "ver_todos_los_grupos") && user.group_id;
    let gf = base44.entities.Group.filter(gFilter);
    let cf = base44.entities.Child.filter(gFilter);
    if (restricted) {
      gf = base44.entities.Group.filter({ id: user.group_id }).catch(() => []);
      cf = base44.entities.Child.filter({ parish_id: user.parish_id, group_id: user.group_id });
    }
    Promise.all([gf, cf]).then(([g, c]) => {
      setGroups(g);
      setChildren(c);
      if (restricted) setGroupId(user.group_id);
    });
  }, [user, permsLoading]);

  const loadAttendances = async () => {
    if (!user?.parish_id) return;
    const f = { parish_id: user.parish_id };
    if (groupId !== "all") f.group_id = groupId;
    const att = await base44.entities.Attendance.filter(f, "-date");
    setAttendances(att.filter((a) => a.date >= from && a.date <= to));
  };

  useEffect(() => { loadAttendances(); }, [user, groupId, from, to]);

  // Attendance counts by date, most recent first (for the table)
  const byDate = useMemo(() => {
    const map = {};
    attendances.forEach((a) => { map[a.date] = (map[a.date] || 0) + 1; });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [attendances]);

  // Same data, chronological (for the chart)
  const chartData = useMemo(
    () => [...byDate].reverse().map(([date, count]) => ({
      date,
      count,
      label: format(parseISO(date), "d MMM", { locale: es }),
    })),
    [byDate]
  );

  // Absences: for each child, count of dates (within range where their group had attendance) they were absent
  const absences = useMemo(() => {
    const scopedChildren = groupId === "all" ? children : children.filter((c) => c.group_id === groupId);
    const activeChildren = scopedChildren.filter((c) => c.active);
    const datesPerGroup = {};
    attendances.forEach((a) => {
      datesPerGroup[a.group_id] = datesPerGroup[a.group_id] || new Set();
      datesPerGroup[a.group_id].add(a.date);
    });
    const childAttDates = {};
    attendances.forEach((a) => {
      childAttDates[a.child_id] = childAttDates[a.child_id] || new Set();
      childAttDates[a.child_id].add(a.date);
    });
    return activeChildren
      .map((c) => {
        const groupDates = datesPerGroup[c.group_id] || new Set();
        const present = childAttDates[c.id] || new Set();
        let absences = 0;
        groupDates.forEach((d) => { if (!present.has(d)) absences++; });
        return { child: c, present: present.size, absences, totalSessions: groupDates.size };
      })
      .sort((a, b) => b.absences - a.absences);
  }, [attendances, children, groupId]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><QrCode className="w-6 h-6 text-gold" />Reportes</h1>
        <p className="text-muted-foreground text-sm">Asistencia por fecha y faltas acumuladas.</p>
      </div>

      <Card>
        <CardContent className="pt-5 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Grupo/Libro</Label>
            {!can("reportes", "ver_todos_los_grupos") ? (
              <Input disabled value={groups.find((g) => g.id === groupId)?.name || ""} />
            ) : (
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grupos/libros</SelectItem>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5"><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" />Asistencia por fecha</CardTitle></CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros en el rango seleccionado.</p>
          ) : (
            <>
              <div className="h-56 -ml-2 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 2 }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value) => [`${value} niños`, "Asistencia"]}
                    />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground inline-flex items-center gap-1 select-none">
                  <ChevronDown className="w-3.5 h-3.5" />Ver tabla de datos
                </summary>
                <Table className="mt-2">
                  <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead className="text-right">Asistencias</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {byDate.map(([date, count]) => (
                      <TableRow key={date}>
                        <TableCell className="capitalize">{format(parseISO(date), "EEEE d 'de' MMMM yyyy", { locale: es })}</TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </details>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Faltas acumuladas por niño</CardTitle>
          {absences.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-2))]" />Presente</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-3))]" />Falta</span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {absences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Niño</TableHead><TableHead>Asistencia</TableHead><TableHead className="text-right">Faltas</TableHead></TableRow></TableHeader>
              <TableBody>
                {absences.map(({ child, present, absences: ab, totalSessions }) => {
                  const presentPct = totalSessions ? (present / totalSessions) * 100 : 0;
                  const absentPct = totalSessions ? (ab / totalSessions) * 100 : 0;
                  return (
                    <TableRow key={child.id}>
                      <TableCell className="font-medium">{child.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[72px] max-w-[140px] h-2 rounded-full bg-muted overflow-hidden flex gap-0.5">
                            {presentPct > 0 && <div className="h-full rounded-full bg-[hsl(var(--chart-2))]" style={{ width: `${presentPct}%` }} />}
                            {absentPct > 0 && <div className="h-full rounded-full bg-[hsl(var(--chart-3))]" style={{ width: `${absentPct}%` }} />}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">{present}/{totalSessions}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-destructive font-medium">{ab}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
