import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, CheckCircle2, XCircle, TrendingUp, TrendingDown, BarChart3, Users, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

const tipSchema = z.object({
  match_name: z.string().trim().min(1, "Match name is required").max(200),
  sport: z.string().trim().min(1, "Sport is required").max(50),
  bet_type: z.string().trim().min(1, "Bet type is required").max(200),
  odds: z.number().min(1.01, "Odds must be greater than 1"),
  analysis: z.string().max(2000).optional(),
  match_start_time: z.string().min(1, "Match start time is required"),
});

interface Tip {
  id: string;
  match_name: string;
  sport: string;
  bet_type: string;
  odds: number;
  status: string;
  analysis: string | null;
  match_start_time: string;
  created_at: string;
}

interface TrackingEntry {
  id: string;
  stake: number;
  tip_id: string;
  user_id: string;
  profiles: { username: string } | null;
}

const Dashboard = () => {
  const { user, isModerator, loading: authLoading } = useAuth();
  const [tips, setTips] = useState<Tip[]>([]);
  const [tracking, setTracking] = useState<TrackingEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [matchName, setMatchName] = useState("");
  const [sport, setSport] = useState("");
  const [betType, setBetType] = useState("");
  const [odds, setOdds] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [matchStartTime, setMatchStartTime] = useState("");

  const fetchTips = async () => {
    const { data } = await supabase.from("tips").select("*").order("created_at", { ascending: false });
    if (data) setTips(data as Tip[]);
  };

  const fetchTracking = async () => {
    const { data } = await supabase.from("user_tracking").select("*, profiles(username)");
    if (data) setTracking(data as unknown as TrackingEntry[]);
  };

  useEffect(() => {
    if (isModerator) {
      fetchTips();
      fetchTracking();
    }
  }, [isModerator]);

  if (authLoading) return null;
  if (!user || !isModerator) return <Navigate to="/" />;

  const handleCreateTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = tipSchema.safeParse({
      match_name: matchName,
      sport,
      bet_type: betType,
      odds: parseFloat(odds),
      analysis: analysis || undefined,
      match_start_time: matchStartTime,
    });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("tips").insert({
      created_by: user.id,
      match_name: matchName.trim(),
      sport: sport.trim(),
      bet_type: betType.trim(),
      odds: parseFloat(odds),
      analysis: analysis.trim() || null,
      match_start_time: new Date(matchStartTime).toISOString(),
    });
    setSubmitting(false);
    if (error) toast.error("Failed to create tip");
    else {
      toast.success("Tip created!");
      setMatchName(""); setSport(""); setBetType(""); setOdds(""); setAnalysis(""); setMatchStartTime("");
      fetchTips();
    }
  };

  const updateTipStatus = async (tipId: string, status: string) => {
    const { error } = await supabase.from("tips").update({ status: status as any }).eq("id", tipId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Tip marked as ${status}`);
      fetchTips();
    }
  };

  // Stats
  const totalTips = tips.length;
  const wonTips = tips.filter((t) => t.status === "won").length;
  const lostTips = tips.filter((t) => t.status === "lost").length;
  const totalStakes = tracking.reduce((acc, t) => acc + Number(t.stake), 0);

  // Per-tip aggregation for won tips profit
  const wonTipIds = new Set(tips.filter((t) => t.status === "won").map((t) => t.id));
  const lostTipIds = new Set(tips.filter((t) => t.status === "lost").map((t) => t.id));
  const totalProfit = tracking.reduce((acc, t) => {
    const tip = tips.find((tp) => tp.id === t.tip_id);
    if (!tip) return acc;
    if (wonTipIds.has(t.tip_id)) return acc + Number(t.stake) * (Number(tip.odds) - 1);
    if (lostTipIds.has(t.tip_id)) return acc - Number(t.stake);
    return acc;
  }, 0);
  const roi = totalStakes > 0 ? (totalProfit / totalStakes) * 100 : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Moderator Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Tips</p>
          <p className="text-xl font-bold">{totalTips}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Won</p>
          <p className="text-xl font-bold text-success">{wonTips}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Lost</p>
          <p className="text-xl font-bold text-destructive">{lostTips}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Stakes</p>
          <p className="text-xl font-bold font-mono">${totalStakes.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">ROI</p>
          <p className={`text-xl font-bold font-mono ${roi >= 0 ? "text-success" : "text-destructive"}`}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create" className="gap-1"><Plus className="h-4 w-4" />Create Tip</TabsTrigger>
          <TabsTrigger value="manage" className="gap-1"><BarChart3 className="h-4 w-4" />Manage Tips</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><Users className="h-4 w-4" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader><CardTitle>Create New Tip</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTip} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Match Name</label>
                    <Input placeholder="e.g. PSG vs OM" value={matchName} onChange={(e) => setMatchName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sport</label>
                    <Select value={sport} onValueChange={setSport}>
                      <SelectTrigger><SelectValue placeholder="Select sport" /></SelectTrigger>
                      <SelectContent>
                        {["Football", "Basketball", "Tennis", "MMA", "Boxing", "Baseball", "Hockey", "Esports", "Other"].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bet Type</label>
                    <Input placeholder='e.g. "Over 1.5 goals", "Mbappé to score"' value={betType} onChange={(e) => setBetType(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Odds</label>
                    <Input type="number" step="0.01" min="1.01" placeholder="e.g. 1.85" value={odds} onChange={(e) => setOdds(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Match Start Time</label>
                    <Input type="datetime-local" value={matchStartTime} onChange={(e) => setMatchStartTime(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Analysis (optional)</label>
                  <Textarea placeholder="Share your analysis..." value={analysis} onChange={(e) => setAnalysis(e.target.value)} rows={3} />
                </div>
                <Button type="submit" disabled={submitting} className="gap-1">
                  <Plus className="h-4 w-4" />
                  {submitting ? "Creating..." : "Create Tip"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead>Bet</TableHead>
                    <TableHead>Odds</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tips.map((tip) => (
                    <TableRow key={tip.id}>
                      <TableCell className="font-medium">
                        <div>
                          <span>{tip.match_name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{tip.sport}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>{tip.bet_type}</TableCell>
                      <TableCell className="font-mono">{Number(tip.odds).toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{format(new Date(tip.match_start_time), "MMM d, HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          tip.status === "won" ? "bg-success/10 text-success" :
                          tip.status === "lost" ? "bg-destructive/10 text-destructive" : ""
                        }>{tip.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {tip.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="gap-1 text-success hover:text-success" onClick={() => updateTipStatus(tip.id, "won")}>
                              <CheckCircle2 className="h-3 w-3" /> Won
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => updateTipStatus(tip.id, "lost")}>
                              <XCircle className="h-3 w-3" /> Lost
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader><CardTitle>User Stakes Analytics</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tip</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Stake</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tracking.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No tracking data yet</TableCell></TableRow>
                  )}
                  {tracking.map((t) => {
                    const tip = tips.find((tp) => tp.id === t.tip_id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{tip?.match_name || "Unknown"}</TableCell>
                        <TableCell>{t.profiles?.username || "User"}</TableCell>
                        <TableCell className="font-mono">${Number(t.stake).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tip?.status || "unknown"}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
