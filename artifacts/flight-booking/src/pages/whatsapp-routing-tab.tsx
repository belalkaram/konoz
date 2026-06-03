import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { authFetch, BASE } from "@/lib/api";
import { useLanguage } from "@/contexts/language-context";

export default function WhatsappRoutingTab() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [agentPhone, setAgentPhone] = useState("");

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["whatsapp-routing-agents"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/agents`);
      if (!res.ok) throw new Error("Failed to fetch routing agents");
      return res.json() as Promise<{ agents: any[] }>;
    }
  });

  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/employees`);
      if (!res.ok) throw new Error("Failed to fetch employees");
      const data = await res.json();
      return data.employees as { id: number; name: string; username: string }[];
    }
  });

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ["whatsapp-routing-customers"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/customers`);
      if (!res.ok) throw new Error("Failed to fetch routing customers");
      return res.json() as Promise<{ customers: any[] }>;
    }
  });

  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: parseInt(employeeId), agentPhone })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add agent");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم إضافة الموظف للتوزيع" : "✅ Agent added to routing" });
      setEmployeeId("");
      setAgentPhone("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-routing-agents"] });
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "❌ خطأ" : "❌ Error", description: err.message, variant: "destructive" });
    }
  });

  const toggleAgentMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      });
      if (!res.ok) throw new Error("Failed to toggle agent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-routing-agents"] });
    }
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${BASE}/api/whatsapp/routing/agents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete agent");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم الحذف" : "✅ Deleted" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-routing-agents"] });
    }
  });

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle>{language === "ar" ? "الموظفين في التوزيع التلقائي (Round Robin)" : "Agents in Round Robin Routing"}</CardTitle>
          <CardDescription>
            {language === "ar" ? "قم بإضافة الموظفين الذين سيستقبلون محادثات الواتساب الجديدة تلقائياً بالتناوب." : "Add agents who will automatically receive new WhatsApp chats in rotation."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2 max-w-2xl">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">{language === "ar" ? "الموظف" : "Employee"}</label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر الموظف" : "Select an employee"} />
                </SelectTrigger>
                <SelectContent>
                  {employeesData?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.name} ({emp.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">{language === "ar" ? "رقم واتساب الموظف" : "Agent WhatsApp Number"}</label>
              <Input 
                value={agentPhone} 
                onChange={e => setAgentPhone(e.target.value)} 
                placeholder="201xxxxxxxxx"
              />
            </div>
            <Button 
              onClick={() => addAgentMutation.mutate()} 
              disabled={!employeeId || !agentPhone || addAgentMutation.isPending}
            >
              {addAgentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
              {language === "ar" ? "إضافة موظف" : "Add Agent"}
            </Button>
          </div>

          <div className="rounded-md border mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الموظف" : "Employee"}</TableHead>
                  <TableHead>{language === "ar" ? "رقم الواتساب" : "WhatsApp Number"}</TableHead>
                  <TableHead>{language === "ar" ? "آخر تعيين" : "Last Assigned"}</TableHead>
                  <TableHead>{language === "ar" ? "إجمالي التعيينات" : "Total Assigned"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentsLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : agentsData?.agents?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">{language === "ar" ? "لا يوجد موظفين في القائمة" : "No agents in routing list"}</TableCell></TableRow>
                ) : (
                  agentsData?.agents?.map(agent => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.employeeName}</TableCell>
                      <TableCell>{agent.agentPhone}</TableCell>
                      <TableCell>{new Date(agent.lastAssignedAt).toLocaleString(language === "ar" ? "ar-EG" : "en-US")}</TableCell>
                      <TableCell>{agent.totalAssigned}</TableCell>
                      <TableCell>
                        <Button 
                          variant={agent.isActive ? "default" : "secondary"} 
                          size="sm" 
                          onClick={() => toggleAgentMutation.mutate({ id: agent.id, isActive: !agent.isActive })}
                        >
                          {agent.isActive ? <Power className="h-4 w-4 me-1" /> : <PowerOff className="h-4 w-4 me-1 text-muted-foreground" />}
                          {agent.isActive ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "متوقف" : "Paused")}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteAgentMutation.mutate(agent.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle>{language === "ar" ? "العملاء الموزعين" : "Routed Customers"}</CardTitle>
          <CardDescription>
            {language === "ar" ? "قائمة بالعملاء الجدد الذين تم توزيعهم على الموظفين." : "List of new customers who were routed to agents."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "رقم العميل" : "Customer Phone"}</TableHead>
                  <TableHead>{language === "ar" ? "الموظف المعين" : "Assigned Agent"}</TableHead>
                  <TableHead>{language === "ar" ? "تاريخ أول رسالة" : "First Message Date"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : customersData?.customers?.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">{language === "ar" ? "لا يوجد عملاء موزعين بعد" : "No routed customers yet"}</TableCell></TableRow>
                ) : (
                  customersData?.customers?.map(cust => (
                    <TableRow key={cust.id}>
                      <TableCell className="font-medium" dir="ltr">{cust.customerPhone}</TableCell>
                      <TableCell>{cust.agentName}</TableCell>
                      <TableCell>{new Date(cust.firstMessageDate).toLocaleString(language === "ar" ? "ar-EG" : "en-US")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
