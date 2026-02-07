import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import TipCard from "@/components/TipCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, History } from "lucide-react";
import UserHistory from "@/components/UserHistory";

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
  created_by: string;
  profiles: { username: string } | null;
}

const Index = () => {
  const { user } = useAuth();
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackedTips, setTrackedTips] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Record<string, { like: number; fire: number; userLiked: boolean; userFired: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const fetchTips = async () => {
    const { data } = await supabase
      .from("tips")
      .select("*, profiles(username)")
      .order("created_at", { ascending: false });
    if (data) setTips(data as unknown as Tip[]);
    setLoading(false);
  };

  const fetchTracking = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_tracking")
      .select("tip_id")
      .eq("user_id", user.id);
    if (data) setTrackedTips(new Set(data.map((t) => t.tip_id)));
  };

  const fetchReactions = async () => {
    const { data } = await supabase.from("tip_reactions").select("*");
    if (data) {
      const map: Record<string, { like: number; fire: number; userLiked: boolean; userFired: boolean }> = {};
      data.forEach((r) => {
        if (!map[r.tip_id]) map[r.tip_id] = { like: 0, fire: 0, userLiked: false, userFired: false };
        if (r.reaction_type === "like") {
          map[r.tip_id].like++;
          if (r.user_id === user?.id) map[r.tip_id].userLiked = true;
        } else if (r.reaction_type === "fire") {
          map[r.tip_id].fire++;
          if (r.user_id === user?.id) map[r.tip_id].userFired = true;
        }
      });
      setReactions(map);
    }
  };

  const fetchCommentCounts = async () => {
    const { data } = await supabase.from("tip_comments").select("tip_id");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((c) => {
        counts[c.tip_id] = (counts[c.tip_id] || 0) + 1;
      });
      setCommentCounts(counts);
    }
  };

  useEffect(() => {
    fetchTips();
    fetchReactions();
    fetchCommentCounts();
  }, []);

  useEffect(() => {
    fetchTracking();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("tips-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tips" }, () => {
        fetchTips();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReact = async (tipId: string, type: string) => {
    if (!user) return;
    const key = type === "like" ? "userLiked" : "userFired";
    const current = reactions[tipId]?.[key];

    if (current) {
      await supabase
        .from("tip_reactions")
        .delete()
        .eq("user_id", user.id)
        .eq("tip_id", tipId)
        .eq("reaction_type", type);
    } else {
      await supabase.from("tip_reactions").insert({
        user_id: user.id,
        tip_id: tipId,
        reaction_type: type,
      });
    }
    fetchReactions();
  };

  const activeTips = tips.filter((t) => t.status === "pending");
  const settledTips = tips.filter((t) => t.status !== "pending");

  return (
    <Tabs defaultValue="active" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tips Feed</h1>
        {user && (
          <TabsList>
            <TabsTrigger value="active" className="gap-1">
              <TrendingUp className="h-4 w-4" />
              Active
              {activeTips.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{activeTips.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="settled" className="gap-1">Settled</TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="h-4 w-4" />
              My History
            </TabsTrigger>
          </TabsList>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      ) : (
        <>
          <TabsContent value="active" className="space-y-4">
            {activeTips.length === 0 && <p className="text-center text-muted-foreground py-12">No active tips right now. Check back soon!</p>}
            {activeTips.map((tip) => (
              <TipCard
                key={tip.id}
                tip={tip}
                reactions={reactions[tip.id] || { like: 0, fire: 0, userLiked: false, userFired: false }}
                commentCount={commentCounts[tip.id] || 0}
                isTracked={trackedTips.has(tip.id)}
                onTrack={fetchTracking}
                onReact={(type) => handleReact(tip.id, type)}
              />
            ))}
          </TabsContent>
          <TabsContent value="settled" className="space-y-4">
            {settledTips.length === 0 && <p className="text-center text-muted-foreground py-12">No settled tips yet.</p>}
            {settledTips.map((tip) => (
              <TipCard
                key={tip.id}
                tip={tip}
                reactions={reactions[tip.id] || { like: 0, fire: 0, userLiked: false, userFired: false }}
                commentCount={commentCounts[tip.id] || 0}
                isTracked={trackedTips.has(tip.id)}
                onTrack={fetchTracking}
                onReact={(type) => handleReact(tip.id, type)}
              />
            ))}
          </TabsContent>
          <TabsContent value="history">
            {user && <UserHistory userId={user.id} />}
          </TabsContent>
        </>
      )}
    </Tabs>
  );
};

export default Index;
