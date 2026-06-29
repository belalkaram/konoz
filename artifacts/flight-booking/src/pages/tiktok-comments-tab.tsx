import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authFetch, BASE } from "@/lib/api";
import { MessageCircle, RefreshCw, Reply } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export function TiktokCommentsTab() {
  const { language } = useLanguage();

  const { data: comments, isLoading } = useQuery({
    queryKey: ["tiktok-comments"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/tiktok/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{language === "ar" ? "التعليقات" : "Comments"}</h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar" 
              ? "متابعة جميع التعليقات الواردة على مقاطع فيديو TikTok الخاصة بك."
              : "Monitor all incoming comments on your TikTok videos."}
          </p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
                <TableHead>{language === "ar" ? "التعليق" : "Comment"}</TableHead>
                <TableHead>{language === "ar" ? "الفيديو" : "Video ID"}</TableHead>
                <TableHead>{language === "ar" ? "الوقت" : "Time"}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {comments?.map((comment: any) => (
                <TableRow key={comment.id}>
                  <TableCell className="font-semibold text-primary">@{comment.authorName || comment.authorId}</TableCell>
                  <TableCell className="max-w-md truncate">{comment.content}</TableCell>
                  <TableCell className="text-xs font-mono">{comment.videoId}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(comment.timestamp), "yyyy-MM-dd HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-8">
                      <Reply className="h-4 w-4 me-2" />
                      {language === "ar" ? "رد" : "Reply"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {comments?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    {language === "ar" ? "لا توجد تعليقات حتى الآن." : "No comments found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
