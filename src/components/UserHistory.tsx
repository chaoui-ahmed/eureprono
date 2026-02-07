import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

interface TrackingEntry {
  id: string;
  stake: number;
  created_at: string;
  tips: {
    match_name: string;
    bet_type: string;
    odds: number;
    status: string;
    sport: string;
  };
}

const UserHistory = ({ userId }: { userId: string }) => {
  const [entries, setEntries] = useState<TrackingEntry[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("user_tracking")
        .select("*, tips(match_name, bet_type, odds, status, sport)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (data) setEntries(data as unknown as TrackingEntry[]);
    };
    fetch();
  }, [userId]);

  const totalStaked = entries.reduce((acc, e) => acc + Number(e.stake), 0);
  const wonEntries = entries.filter((e) => e.tips.status === "won");
  const lostEntries = entries.filter((e) => e.tips.status === "lost");
  const totalProfit = wonEntries.reduce((acc, e) => acc + Number(e.stake) * (Number(e.tips.odds) - 1), 0)
    - lostEntries.reduce((acc, e) => acc + Number(e.stake), 0);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Staked</p>
            <p className="text-xl font-bold font-mono">${totalStaked.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Profit/Loss</p>
            <p className={`text-xl font-bold font-mono ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
              {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">ROI</p>
            <p className={`text-xl font-bold font-mono flex items-center justify-center gap-1 ${roi >= 0 ? "text-success" : "text-destructive"}`}>
              {roi >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {roi.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-xl font-bold font-mono">
              {wonEntries.length + lostEntries.length > 0
                ? ((wonEntries.length / (wonEntries.length + lostEntries.length)) * 100).toFixed(0)
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bet History</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No bets tracked yet. Start by clicking "I played this!" on a tip.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead>Bet</TableHead>
                  <TableHead>Odds</TableHead>
                  <TableHead>Stake</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const pl = e.tips.status === "won"
                    ? Number(e.stake) * (Number(e.tips.odds) - 1)
                    : e.tips.status === "lost" ? -Number(e.stake) : 0;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.tips.match_name}</TableCell>
                      <TableCell className="text-sm">{e.tips.bet_type}</TableCell>
                      <TableCell className="font-mono">{Number(e.tips.odds).toFixed(2)}</TableCell>
                      <TableCell className="font-mono">${Number(e.stake).toFixed(2)}</TableCell>
                      <TableCell>
                        {e.tips.status === "won" && <Badge className="bg-success/10 text-success border-success/30" variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Won</Badge>}
                        {e.tips.status === "lost" && <Badge className="bg-destructive/10 text-destructive border-destructive/30" variant="outline"><XCircle className="h-3 w-3 mr-1" />Lost</Badge>}
                        {e.tips.status === "pending" && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                        {e.tips.status === "void" && <Badge variant="outline">Void</Badge>}
                      </TableCell>
                      <TableCell className={`font-mono font-bold ${pl > 0 ? "text-success" : pl < 0 ? "text-destructive" : ""}`}>
                        {pl !== 0 ? `${pl > 0 ? "+" : ""}$${pl.toFixed(2)}` : "-"}
                      </TableCell>
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
};

export default UserHistory;
