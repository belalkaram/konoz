import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Send, Clock, Layers, FileText, Play, CheckCircle, Users, Filter, Pause, CheckCircle2 } from "lucide-react";
import { authFetch, BASE } from "@/lib/api";
import * as XLSX from "xlsx";

export default function WhatsappControls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [numbers, setNumbers] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [timeGapMin, setTimeGapMin] = useState(5);
  const [timeGapMax, setTimeGapMax] = useState(10);
  const [batchSize, setBatchSize] = useState(10);
  const [campaignName, setCampaignName] = useState("");
  const [checkingNumbers, setCheckingNumbers] = useState(false);
  const [filteredNumbers, setFilteredNumbers] = useState<string[]>([]);

  // ── Fetch Campaigns ────────────────────────────────────────────────────────
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["whatsapp-campaigns"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns`);
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json() as Promise<{ campaigns: any[] }>;
    }
  });

  // ── Fetch Groups ───────────────────────────────────────────────────────────
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["whatsapp-groups"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/groups`);
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json() as Promise<{ groups: any }>;
    }
  });

  // ── Create Campaign Mutation ───────────────────────────────────────────────
  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          messageTemplate,
          numbers: filteredNumbers.length > 0 ? filteredNumbers : numbers,
          timeGapMin,
          timeGapMax,
          batchSize
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Campaign created and started!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
      setCampaignName("");
      setMessageTemplate("");
      setNumbers([]);
      setFilteredNumbers([]);
    },
    onError: (err: any) => {
      toast({ title: "❌ Error", description: err.message, variant: "destructive" });
    }
  });

  // ── Resume Campaign Mutation ───────────────────────────────────────────────
  const resumeCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns/${campaignId}/resume`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to resume campaign");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Campaign resumed!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
    },
    onError: (err: any) => {
      toast({ title: "❌ Error", description: err.message, variant: "destructive" });
    }
  });

  // ── Pause Campaign Mutation ────────────────────────────────────────────────
  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await authFetch(`${BASE}/api/whatsapp/campaigns/${campaignId}/pause`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to pause campaign");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "⏸️ Campaign paused!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
    },
    onError: (err: any) => {
      toast({ title: "❌ Error", description: err.message, variant: "destructive" });
    }
  });

  // ── File Upload Handler ────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Assume first column contains numbers
        const parsedNumbers = data
          .map(row => row[0])
          .filter(Boolean)
          .map(n => String(n).trim().replace(/[^0-9]/g, '')) // Keep only digits
          .filter(n => n.length >= 10); // Basic validation
          
        setNumbers(parsedNumbers);
        setFilteredNumbers([]); // Reset filter
        toast({ title: `✅ Loaded ${parsedNumbers.length} numbers successfully` });
      } catch (err) {
        toast({ title: "❌ Error reading file", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Filter Numbers Handler ─────────────────────────────────────────────────
  const handleFilterNumbers = async () => {
    if (numbers.length === 0) {
      toast({ title: "⚠️ Please upload a file with numbers first" });
      return;
    }

    setCheckingNumbers(true);
    try {
      const res = await authFetch(`${BASE}/api/whatsapp/check-numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers })
      });
      
      if (!res.ok) throw new Error("Failed to check numbers");
      const data = await res.json();
      
      // Evolution API returns array of results
      const validNumbers = data
        .filter((item: any) => item.exists)
        .map((item: any) => item.jid.split('@')[0]);
        
      setFilteredNumbers(validNumbers);
      toast({ title: `🔍 Numbers filtered. Valid: ${validNumbers.length} out of ${numbers.length}` });
    } catch (err: any) {
      toast({ title: "❌ Error filtering numbers", description: err.message, variant: "destructive" });
    } finally {
      setCheckingNumbers(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <h1 className="text-3xl font-bold text-foreground mb-6">WhatsApp Controls</h1>

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="flex flex-col sm:flex-row h-auto w-full max-w-2xl mx-auto gap-2 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="campaigns" className="text-sm font-medium w-full">Bulk Campaigns</TabsTrigger>
          <TabsTrigger value="reports" className="text-sm font-medium w-full">Reports</TabsTrigger>
          <TabsTrigger value="groups" className="text-sm font-medium w-full">Group Management</TabsTrigger>
        </TabsList>

        {/* ── Campaigns Tab ────────────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Create Campaign Card */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Send className="h-5 w-5 text-primary" />
                  Create New Campaign
                </CardTitle>
                <CardDescription>
                  Upload numbers and write your message to send in bulk.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* 1. File Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Upload Excel with Numbers</label>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="cursor-pointer" />
                    <Button variant="outline" size="icon" title="Upload File">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  {numbers.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Loaded {numbers.length} numbers.
                      {filteredNumbers.length > 0 && ` (Filtered: ${filteredNumbers.length} valid)`}
                    </p>
                  )}
                </div>

                {/* 2. Filter Numbers */}
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleFilterNumbers}
                    disabled={numbers.length === 0 || checkingNumbers}
                  >
                    {checkingNumbers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                    Filter Numbers (Check WhatsApp existence)
                  </Button>
                </div>

                {/* 3. Campaign Details */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Campaign Name</label>
                  <Input 
                    placeholder="e.g. Ramdan Campaign" 
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Message Template</label>
                  <Textarea 
                    placeholder="Type your message here..." 
                    rows={5}
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                  />
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" /> Time Gap (Seconds)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input type="number" placeholder="Min" value={timeGapMin} onChange={(e) => setTimeGapMin(parseInt(e.target.value))} />
                      <span>to</span>
                      <Input type="number" placeholder="Max" value={timeGapMax} onChange={(e) => setTimeGapMax(parseInt(e.target.value))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Layers className="h-4 w-4" /> Batch Size
                    </label>
                    <Input type="number" value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value))} />
                  </div>
                </div>

                <Button 
                  className="w-full bg-primary hover:bg-primary/90" 
                  onClick={() => createCampaignMutation.mutate()}
                  disabled={createCampaignMutation.isPending || numbers.length === 0 || !messageTemplate || !campaignName}
                >
                  {createCampaignMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Start Campaign
                </Button>

              </CardContent>
            </Card>

            {/* Campaign Summary / Quick Stats */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-5 w-5 text-primary" />
                  Instructions & Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• The Excel file must contain numbers in the first column.</p>
                <p>• It is recommended to use large time gaps (e.g., 5 to 10 seconds) to avoid number blocking.</p>
                <p>• The filter feature checks if the number has a WhatsApp account before sending.</p>
                <p>• The batch feature pauses sending after a certain number of messages to rest the account.</p>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ── Reports Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="reports" className="space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                Campaign Reports
              </CardTitle>
              <CardDescription>
                Monitor sending status and reports for current and past campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignsData?.campaigns.map((camp: any) => (
                      <TableRow key={camp.id}>
                        <TableCell className="font-medium">{camp.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            camp.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            camp.status === 'running' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {camp.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {camp.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {camp.status === 'paused' && <Pause className="w-3.5 h-3.5" />}
                            {camp.status === 'completed' ? 'Completed' :
                             camp.status === 'running' ? 'Running' : 'Paused'}
                          </span>
                        </TableCell>
                        <TableCell>{camp.total}</TableCell>
                        <TableCell className="text-emerald-600 font-semibold">{camp.sent}</TableCell>
                        <TableCell className="text-destructive font-semibold">{camp.failed}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {camp.status === 'paused' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                onClick={() => resumeCampaignMutation.mutate(camp.id)}
                                disabled={resumeCampaignMutation.isPending}
                              >
                                <Play className="mr-1 h-3.5 w-3.5" /> Resume
                              </Button>
                            )}
                            {camp.status === 'running' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                                onClick={() => pauseCampaignMutation.mutate(camp.id)}
                                disabled={pauseCampaignMutation.isPending}
                              >
                                <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {campaignsData?.campaigns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                          No campaigns yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Groups Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="groups" className="space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5 text-primary" />
                Group Management
              </CardTitle>
              <CardDescription>
                View groups the account is subscribed to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupsLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group Name</TableHead>
                      <TableHead>Identifier (JID)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupsData?.groups?.map((group: any) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.subject}</TableCell>
                        <TableCell className="font-mono text-xs">{group.id}</TableCell>
                      </TableRow>
                    ))}
                    {(!groupsData?.groups || groupsData.groups.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                          No groups found or not loaded yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
