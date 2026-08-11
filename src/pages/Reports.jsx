import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QrCode, CalendarDays, ChevronDown, ChevronRight, Users, TrendingUp,
  AlertTriangle, Check, X as XIcon, ExternalLink,
} from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/lib/PermissionContext";
import { useToast } from "@/components/ui/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Reports() {
  const { user } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const { toast } = useToast();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("all");
  const [from, setFrom] = useState(subDays(new Date(), 30).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [attendances, setAttendances] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionDetail, setSessionDetail] = useState(null); // { date, groups: [{ group, present, absent }] }
  const [childDetail, setChildDetail] = useState(null); // { child, sessions: [{ date, present }] }

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
    }).catch((e) => {
      toast({ title: "No se pudieron cargar los grupos/libros", description: e.message, variant: "destructive" });
    });
  }, [user, permsLoading]);

  const loadAttendances = async () => {
    if (!user?.parish_id) return;
    setLoading(true);
    try {
      const f = { parish_id: user.parish_id };
      if (groupId !== "all") f.group_id = groupId;
      const att = await base44.entities.Attendance.filter(f, "-date");
      setAttendances(att.filter((a) => a.date >= from && a.date <= to));
    } catch (e) {
      // No dejar las filas del grupo/rango anterior en pantalla: con el
      // filtro ya cambiado, esos datos responderían a la selección vieja y
      // se verían como si fueran la respuesta a la nueva (tasas y faltas
      // incorrectas). Mejor una tabla vacía que un número equivocado.
      setAttendances([]);
      toast({ title: "No se pudo cargar la asistencia", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAttendances(); }, [user, groupId, from, to]);

  const groupsById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);

  // Which dates each group met on, and which dates each child was present — the
  // backbone both the faltas table and the drill-down dialogs read from.
  const sessionsIndex = useMemo(() => {
    const datesPerGroup = {};
    const childAttDates = {};
    attendances.forEach((a) => {
      (datesPerGroup[a.group_id] ||= new Set()).add(a.date);
      (childAttDates[a.child_id] ||= new Set()).add(a.date);
    });
    return { datesPerGroup, childAttDates };
  }, [attendances]);

  // Attendance counts by date, most recent first (for the table)
  const byDate = useMemo(() => {
    const map = {};
    attendances.forEach((a) => { map[a.date] = (map[a.date] || 0) + 1; });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [attendances]);

  // Same data, chronological, with the expected roster size so bars carry a rate
  const chartData = useMemo(() => [...byDate].reverse().map(([date, count]) => {
    const groupIdsThatDay = [...new Set(attendances.filter((a) => a.date === date).map((a) => a.group_id))];
    const scopeGroupIds = groupId === "all" ? groupIdsThatDay : [groupId];
    const expected = scopeGroupIds.reduce(
      (sum, gid) => sum + children.filter((c) => c.group_id === gid && c.active).length,
      0
    );
    return {
      date,
      count,
      expected,
      rate: expected ? Math.round((count / expected) * 100) : null,
      label: format(parseISO(date), "d MMM", { locale: es }),
    };
  }), [byDate, attendances, children, groupId]);

  // Absences: for each child, count of dates (within range where their group had attendance) they were absent
  const absences = useMemo(() => {
    const { datesPerGroup, childAttDates } = sessionsIndex;
    const scopedChildren = groupId === "all" ? children : children.filter((c) => c.group_id === groupId);
    const activeChildren = scopedChildren.filter((c) => c.active);
    return activeChildren
      .map((c) => {
        const groupDates = datesPerGroup[c.group_id] || new Set();
        const present = childAttDates[c.id] || new Set();
        let absencesCount = 0;
        groupDates.forEach((d) => { if (!present.has(d)) absencesCount++; });
        return { child: c, present: present.size, absences: absencesCount, totalSessions: groupDates.size };
      })
      .sort((a, b) => b.absences - a.absences);
  }, [attendances, children, groupId, sessionsIndex]);

  const kpis = useMemo(() => {
    const totalPresent = absences.reduce((s, a) => s + a.present, 0);
    const totalPossible = absences.reduce((s, a) => s + a.totalSessions, 0);
    const rate = totalPossible ? Math.round((totalPresent / totalPossible) * 100) : null;
    const topAbsentee = absences.find((a) => a.absences > 0) || null;
    return { sessions: byDate.length, rate, tracked: absences.length, topAbsentee };
  }, [absences, byDate]);

  const openSessionDetail = (date) => {
    const { datesPerGroup } = sessionsIndex;
    const dayAtt = attendances.filter((a) => a.date === date);
    const groupIdsToday = [...new Set(dayAtt.map((a) => a.group_id))];
    const scopeGroupIds = groupId === "all" ? groupIdsToday : [groupId].filter((gid) => datesPerGroup[gid]?.has(date));
    const detail = scopeGroupIds.map((gid) => {
      const presentIds = new Set(dayAtt.filter((a) => a.group_id === gid).map((a) => a.child_id));
      const groupChildren = children.filter((c) => c.group_id === gid && c.active);
      return {
        group: groupsById[gid],
        present: groupChildren.filter((c) => presentIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
        absent: groupChildren.filter((c) => !presentIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
    setSessionDetail({ date, groups: detail });
  };

  const openChildDetail = (child) => {
    const { datesPerGroup, childAttDates } = sessionsIndex;
    const groupDates = [...(datesPerGroup[child.group_id] || [])].sort((a, b) => (a < b ? 1 : -1));
    const present = childAttDates[child.id] || new Set();
    setChildDetail({ child, sessions: groupDates.map((d) => ({ date: d, present: present.has(d) })) });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><QrCode className="w-6 h-6 text-gold" />Reportes</h1>
        <p className="text-muted-foreground text-sm">Asistencia por fecha y faltas acumuladas. Toca una barra o un niño para ver el detalle.</p>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Clases registradas</p>
              {loading ? <Skeleton className="h-7 w-10 mt-0.5" /> : <p className="text-2xl font-heading font-semibold mt-0.5">{kpis.sessions}</p>}
            </div>
            <div className="w-9 h-9 rounded-md bg-muted grid place-items-center text-muted-foreground"><CalendarDays className="w-4 h-4" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Asistencia promedio</p>
              {loading ? (
                <Skeleton className="h-7 w-14 mt-0.5" />
              ) : (
                <p className="text-2xl font-heading font-semibold mt-0.5">{kpis.rate === null ? "—" : `${kpis.rate}%`}</p>
              )}
            </div>
            <div className="w-9 h-9 rounded-md bg-moss/15 grid place-items-center text-moss"><TrendingUp className="w-4 h-4" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Más faltas</p>
              {loading ? (
                <Skeleton className="h-7 w-28 mt-0.5" />
              ) : kpis.topAbsentee ? (
                <button
                  onClick={() => openChildDetail(kpis.topAbsentee.child)}
                  className="text-left group"
                >
                  <p className="text-lg font-heading font-semibold mt-0.5 truncate group-hover:underline">{kpis.topAbsentee.child.name}</p>
                  <p className="text-xs text-destructive font-medium">{kpis.topAbsentee.absences} faltas</p>
                </button>
              ) : (
                <p className="text-2xl font-heading font-semibold mt-0.5">—</p>
              )}
            </div>
            <div className="w-9 h-9 rounded-md bg-destructive/10 grid place-items-center text-destructive shrink-0"><AlertTriangle className="w-4 h-4" /></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" />Asistencia por fecha</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros en el rango seleccionado.</p>
          ) : (
            <>
              <div className="h-56 -ml-2 mb-1">
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
                      formatter={(_value, _name, item) => {
                        const { count, expected, rate } = item.payload;
                        const detail = expected ? `${count} de ${expected} niños (${rate}%)` : `${count} niños`;
                        return [detail, "Asistencia"];
                      }}
                      labelFormatter={() => "Toca la barra para ver el detalle"}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--chart-1))"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                      className="cursor-pointer"
                      activeBar={{ fill: "hsl(var(--chart-1))", fillOpacity: 0.75, stroke: "hsl(var(--chart-1))" }}
                      onClick={(data) => openSessionDetail(data.date)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Toca una barra para ver quién asistió ese día.</p>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground inline-flex items-center gap-1 select-none">
                  <ChevronDown className="w-3.5 h-3.5" />Ver tabla de datos
                </summary>
                <Table className="mt-2">
                  <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead className="text-right">Asistencias</TableHead><TableHead className="w-8" /></TableRow></TableHeader>
                  <TableBody>
                    {byDate.map(([date, count]) => (
                      <TableRow key={date} className="cursor-pointer hover:bg-muted/50" onClick={() => openSessionDetail(date)}>
                        <TableCell className="capitalize">{format(parseISO(date), "EEEE d 'de' MMMM yyyy", { locale: es })}</TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">{count}</TableCell>
                        <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
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
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : absences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Niño</TableHead><TableHead>Asistencia</TableHead><TableHead className="text-right">Faltas</TableHead><TableHead className="w-8" /></TableRow></TableHeader>
              <TableBody>
                {absences.map(({ child, present, absences: ab, totalSessions }) => {
                  const presentPct = totalSessions ? (present / totalSessions) * 100 : 0;
                  const absentPct = totalSessions ? (ab / totalSessions) * 100 : 0;
                  return (
                    <TableRow key={child.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openChildDetail(child)}>
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
                      <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Drill-down: who was present/absent on a given date */}
      <Dialog open={!!sessionDetail} onOpenChange={(o) => !o && setSessionDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {sessionDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-gold" />
                  {format(parseISO(sessionDetail.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                </DialogTitle>
                <DialogDescription>
                  {sessionDetail.groups.reduce((s, g) => s + g.present.length, 0)} de{" "}
                  {sessionDetail.groups.reduce((s, g) => s + g.present.length + g.absent.length, 0)} niños asistieron.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {sessionDetail.groups.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin registros para este grupo ese día.</p>
                )}
                {sessionDetail.groups.map(({ group, present, absent }) => (
                  <div key={group?.id || "sin-grupo"} className="space-y-2">
                    {groupId === "all" && (
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group?.name || "Sin grupo/libro"}</p>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-[hsl(var(--chart-2))] mb-1 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Presentes ({present.length})</p>
                        <ul className="space-y-1">
                          {present.map((c) => (
                            <li key={c.id}>
                              <Link to={`/ninos/${c.id}`} className="text-sm hover:underline flex items-center gap-1 group">
                                {c.name}<ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                              </Link>
                            </li>
                          ))}
                          {present.length === 0 && <li className="text-xs text-muted-foreground">Nadie</li>}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[hsl(var(--chart-3))] mb-1 flex items-center gap-1"><XIcon className="w-3.5 h-3.5" />Faltaron ({absent.length})</p>
                        <ul className="space-y-1">
                          {absent.map((c) => (
                            <li key={c.id}>
                              <Link to={`/ninos/${c.id}`} className="text-sm hover:underline flex items-center gap-1 group">
                                {c.name}<ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                              </Link>
                            </li>
                          ))}
                          {absent.length === 0 && <li className="text-xs text-muted-foreground">Nadie</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Drill-down: one child's session-by-session history */}
      <Dialog open={!!childDetail} onOpenChange={(o) => !o && setChildDetail(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {childDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Users className="w-4 h-4 text-gold" />{childDetail.child.name}</DialogTitle>
                <DialogDescription>
                  {childDetail.sessions.filter((s) => s.present).length} de {childDetail.sessions.length} clases en el rango seleccionado.
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {childDetail.sessions.map(({ date, present }) => (
                  <li key={date} className="flex items-center justify-between text-sm rounded-md px-2 py-1.5 odd:bg-muted/40">
                    <span className="capitalize">{format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}</span>
                    {present ? (
                      <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold bg-[hsl(var(--chart-2))]/15 text-[hsl(var(--chart-2))]"><Check className="w-3 h-3" />Presente</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold bg-[hsl(var(--chart-3))]/15 text-[hsl(var(--chart-3))]"><XIcon className="w-3 h-3" />Falta</span>
                    )}
                  </li>
                ))}
                {childDetail.sessions.length === 0 && <p className="text-sm text-muted-foreground">Sin clases registradas en el rango.</p>}
              </ul>
              <DialogFooter>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/ninos/${childDetail.child.id}`}>Ver perfil completo<ExternalLink className="w-3.5 h-3.5 ml-1.5" /></Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
