import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QrCode, CalendarDays } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";

export default function Reports() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("all");
  const [from, setFrom] = useState(subDays(new Date(), 30).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [attendances, setAttendances] = useState([]);
  const [children, setChildren] = useState([]);

  useEffect(() => {
    if (!user?.parish_id) return;
    const gFilter = { parish_id: user.parish_id };
    let gf = base44.entities.Group.filter(gFilter);
    let cf = base44.entities.Child.filter(gFilter);
    if (user.role === "user" && user.group_id) {
      gf = base44.entities.Group.filter({ id: user.group_id }).catch(() => []);
      cf = base44.entities.Child.filter({ parish_id: user.parish_id, group_id: user.group_id });
    }
    Promise.all([gf, cf]).then(([g, c]) => {
      setGroups(g);
      setChildren(c);
      if (user.role === "user" && user.group_id) setGroupId(user.group_id);
    });
  }, [user]);

  const loadAttendances = async () => {
    if (!user?.parish_id) return;
    const f = { parish_id: user.parish_id };
    if (groupId !== "all") f.group_id = groupId;
    const att = await base44.entities.Attendance.filter(f, "-date");
    setAttendances(att.filter((a) => a.date >= from && a.date <= to));
  };

  useEffect(() => { loadAttendances(); }, [user, groupId, from, to]);

  // Attendance counts by date
  const byDate = useMemo(() => {
    const map = {};
    attendances.forEach((a) => { map[a.date] = (map[a.date] || 0) + 1; });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [attendances]);

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
    return activeChildren.map((c) => {
      const groupDates = datesPerGroup[c.group_id] || new Set();
      const present = childAttDates[c.id] || new Set();
      let absences = 0;
      groupDates.forEach((d) => { if (!present.has(d)) absences++; });
      return { child: c, present: present.size, absences, totalSessions: groupDates.size };
    });
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
            <Label>Grupo</Label>
            {user?.role === "user" ? (
              <Input disabled value={groups.find((g) => g.id === groupId)?.name || ""} />
            ) : (
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grupos</SelectItem>
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
          {byDate.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros en el rango seleccionado.</p>
          ) : (
            <Table>
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Faltas acumuladas por niño</CardTitle></CardHeader>
        <CardContent>
          {absences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Niño</TableHead><TableHead className="text-right">Sesiones</TableHead><TableHead className="text-right">Presentes</TableHead><TableHead className="text-right">Faltas</TableHead></TableRow></TableHeader>
              <TableBody>
                {absences.map(({ child, present, absences: ab, totalSessions }) => (
                  <TableRow key={child.id}>
                    <TableCell className="font-medium">{child.name}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{totalSessions}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-moss font-medium">{present}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-destructive font-medium">{ab}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}