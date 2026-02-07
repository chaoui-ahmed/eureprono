import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_profit: number;
  total_staked: number;
  wins: number;
  total_bets: number;
}

const medals = [
  { icon: Trophy, color: "text-warning", bg: "bg-warning/10" },
  { icon: Medal, color: "text-muted-foreground", bg: "bg-muted/30" },
  { icon: Award, color: "text-warning/70", bg: "bg-warning/5" },
];

const Leaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // Fetch all tracking with tip data and profile data
      const { data: trackingData } = await supabase
        .from("user_tracking")
        .select("user_id, stake, tip_id, tips(odds, status), profiles(username)");

      if (!trackingData) {
        setLoading(false);
        return;
      }

      // Get current month boundaries
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Group by user
      const userMap = new Map<string, LeaderboardEntry>();

      (trackingData as any[]).forEach((t) => {
        const tipStatus = t.tips?.status;
        if (!tipStatus || tipStatus === "pending" || tipStatus === "void") return;

        const uid = t.user_id;
        if (!userMap.has(uid)) {
          userMap.set(uid, {
            user_id: uid,
            username: t.profiles?.username || "User",
            total_profit: 0,
            total_staked: 0,
            wins: 0,
            total_bets: 0,
          });
        }
        const entry = userMap.get(uid)!;
        const stake = Number(t.stake);
        entry.total_staked += stake;
        entry.total_bets++;

        if (tipStatus === "won") {
          entry.total_profit += stake * (Number(t.tips.odds) - 1);
          entry.wins++;
        } else if (tipStatus === "lost") {
          entry.total_profit -= stake;
        }
      });

      const sorted = Array.from(userMap.values())
        .sort((a, b) => b.total_profit - a.total_profit)
        .slice(0, 10);

      setEntries(sorted);
      setLoading(false);
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Trophy className="h-8 w-8 text-warning" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground">Top performers this month</p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          No settled bets yet. The leaderboard will populate as tips are resolved.
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl mx-auto">
          {entries.map((entry, idx) => {
            const medal = medals[idx];
            const MedalIcon = medal?.icon;
            const roi = entry.total_staked > 0 ? (entry.total_profit / entry.total_staked) * 100 : 0;

            return (
              <Card key={entry.user_id} className={`${idx < 3 ? "border-2" : ""} ${idx === 0 ? "border-warning/50" : idx === 1 ? "border-muted/50" : idx === 2 ? "border-warning/30" : ""}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${medal?.bg || "bg-muted/20"}`}>
                    {MedalIcon ? (
                      <MedalIcon className={`h-5 w-5 ${medal.color}`} />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{entry.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.wins}/{entry.total_bets} wins · ROI: {roi.toFixed(1)}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`text-lg font-bold font-mono ${entry.total_profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {entry.total_profit >= 0 ? "+" : ""}${entry.total_profit.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">profit</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
