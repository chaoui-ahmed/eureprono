import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
}

const TipComments = ({ tipId }: { tipId: string }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("tip_comments")
      .select("*, profiles(username)")
      .eq("tip_id", tipId)
      .order("created_at", { ascending: true });
    if (data) setComments(data as unknown as Comment[]);
  };

  useEffect(() => {
    fetchComments();
  }, [tipId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("tip_comments").insert({
      user_id: user.id,
      tip_id: tipId,
      content: newComment.trim(),
    });
    setLoading(false);
    if (error) toast.error("Failed to post comment");
    else {
      setNewComment("");
      fetchComments();
    }
  };

  return (
    <div className="border-t border-dashed border-border px-4 py-3 space-y-3">
      <div className="max-h-48 overflow-y-auto space-y-2">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No comments yet</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="text-sm">
            <span className="font-semibold">{c.profiles?.username || "User"}</span>
            <span className="text-muted-foreground text-xs ml-2">
              {format(new Date(c.created_at), "MMM d, HH:mm")}
            </span>
            <p className="text-muted-foreground">{c.content}</p>
          </div>
        ))}
      </div>
      {user && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={500}
          />
          <Button type="submit" size="icon" disabled={loading || !newComment.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
};

export default TipComments;
