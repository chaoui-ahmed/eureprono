import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Flame, Heart, MessageCircle, Clock, DollarSign, CheckCircle2, XCircle, Minus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import TipComments from "./TipComments";

interface TipCardProps {
  tip: {
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
    profiles?: { username: string } | null;
  };
  reactions: { like: number; fire: number; userLiked: boolean; userFired: boolean };
  commentCount: number;
  isTracked: boolean;
  onTrack: () => void;
  onReact: (type: string) => void;
}

const statusConfig: Record<string, { icon: any; class: string; label: string }> = {
  pending: { icon: Clock, class: "bg-warning/10 text-warning border-warning/30", label: "Pending" },
  won: { icon: CheckCircle2, class: "bg-success/10 text-success border-success/30", label: "Won" },
  lost: { icon: XCircle, class: "bg-destructive/10 text-destructive border-destructive/30", label: "Lost" },
  void: { icon: Minus, class: "bg-muted/30 text-muted-foreground border-border", label: "Void" },
};

const TipCard = ({ tip, reactions, commentCount, isTracked, onTrack, onReact }: TipCardProps) => {
  const { user } = useAuth();
  const [stakeOpen, setStakeOpen] = useState(false);
  const [stake, setStake] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const status = statusConfig[tip.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const handleStake = async () => {
    const stakeNum = parseFloat(stake);
    if (!stakeNum || stakeNum <= 0) {
      toast.error("Enter a valid stake amount");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("user_tracking").insert({
      user_id: user!.id,
      tip_id: tip.id,
      stake: stakeNum,
    });
    setSubmitting(false);
    if (error) {
      if (error.message.includes("duplicate")) toast.error("You already tracked this tip");
      else toast.error("Failed to track tip");
    } else {
      toast.success("Tip tracked!");
      setStakeOpen(false);
      setStake("");
      onTrack();
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-dashed border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dashed border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{tip.sport}</Badge>
            <span className="text-xs text-muted-foreground">
              by {tip.profiles?.username || "Tipster"}
            </span>
          </div>
          <Badge className={`${status.class} border gap-1`} variant="outline">
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          <h3 className="text-lg font-bold">{tip.match_name}</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Bet Type</p>
              <p className="font-semibold">{tip.bet_type}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Odds</p>
              <p className="text-2xl font-bold font-mono text-primary">{Number(tip.odds).toFixed(2)}</p>
            </div>
          </div>

          {tip.analysis && (
            <p className="text-sm text-muted-foreground bg-accent/50 rounded-md p-3">{tip.analysis}</p>
          )}

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Kick-off: {format(new Date(tip.match_start_time), "MMM d, yyyy HH:mm")}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-dashed border-border px-4 py-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1 ${reactions.userLiked ? "text-destructive" : ""}`}
              onClick={() => onReact("like")}
              disabled={!user}
            >
              <Heart className={`h-4 w-4 ${reactions.userLiked ? "fill-current" : ""}`} />
              {reactions.like}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1 ${reactions.userFired ? "text-warning" : ""}`}
              onClick={() => onReact("fire")}
              disabled={!user}
            >
              <Flame className={`h-4 w-4 ${reactions.userFired ? "fill-current" : ""}`} />
              {reactions.fire}
            </Button>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setCommentsOpen(!commentsOpen)}>
              <MessageCircle className="h-4 w-4" />
              {commentCount}
            </Button>
          </div>

          {user && tip.status === "pending" && !isTracked && (
            <Dialog open={stakeOpen} onOpenChange={setStakeOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <DollarSign className="h-4 w-4" />
                  I played this!
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>How much is your stake?</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input
                    type="number"
                    placeholder="Enter stake amount"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    min="0.01"
                    step="0.01"
                  />
                  <Button className="w-full" onClick={handleStake} disabled={submitting}>
                    {submitting ? "Tracking..." : "Confirm Stake"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {isTracked && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Tracked
            </Badge>
          )}
        </div>

        {commentsOpen && <TipComments tipId={tip.id} />}
      </CardContent>
    </Card>
  );
};

export default TipCard;
