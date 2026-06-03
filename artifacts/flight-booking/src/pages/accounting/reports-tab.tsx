import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/language-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SecretNumber } from "@/components/secret-number";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, TrendingUp, DollarSign, Wallet, Users, FileSpreadsheet, Building2, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function ReportsTab() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [filterMode, setFilterMode] = useState<"today" | "week" | "month" | "custom">("month");
  
  // Date states
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1); // Start of month
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Compute start/end dates based on mode
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (filterMode === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (filterMode === "week") {
      // Start of week (Sunday)
      const day = now.getDay();
      const diff = now.getDate() - day;
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (filterMode === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [filterMode, customStart, customEnd]);

  // Fetch report data
  const { data, isLoading } = useQuery({
    queryKey: ["accounting-report", startDate, endDate],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/accounting/report?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch report data");
      return res.json();
    },
  });

  const handleDownloadPdf = async () => {
    if (!pdfRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      // Create temporary container on the document body
      const printRoot = document.createElement("div");
      printRoot.id = "print-pdf-root";
      printRoot.style.position = "absolute";
      printRoot.style.left = "-9999px";
      printRoot.style.top = "-9999px";
      printRoot.style.width = "794px"; // A4 width at 96 DPI
      printRoot.style.background = "#ffffff";
      printRoot.style.color = "#000000";
      
      // Clone our print template
      const clone = pdfRef.current.cloneNode(true) as HTMLDivElement;
      clone.style.display = "block";
      printRoot.appendChild(clone);
      document.body.appendChild(printRoot);

      // Brief delay to allow rendering
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
        windowWidth: 794,
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // A4 is 210mm x 297mm
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
      pdf.save(`Financial-Report-${format(new Date(startDate), "yyyy-MM-dd")}-to-${format(new Date(endDate), "yyyy-MM-dd")}.pdf`);
      
      document.body.removeChild(printRoot);
      toast({ title: language === "ar" ? "✅ تم تحميل التقرير بنجاح" : "✅ Report downloaded successfully" });
    } catch (err) {
      console.error(err);
      toast({ title: language === "ar" ? "❌ فشل تحميل التقرير" : "❌ Failed to download report", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const stats = data?.stats || {
    totalRevenue: 0,
    totalCost: 0,
    netProfit: 0,
    totalExpenses: 0,
    rentExpenses: 0,
    generalExpenses: 0,
    totalSalaries: 0,
    totalPayments: 0,
  };

  const periodLabel = useMemo(() => {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    const formatStr = "dd MMMM yyyy";
    const opt = { locale: language === "ar" ? ar : undefined };
    return `${format(sDate, formatStr, opt)} - ${format(eDate, formatStr, opt)}`;
  }, [startDate, endDate, language]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-border/40 shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>{language === "ar" ? "فترة التقرير" : "Report Period"}</Label>
            <Select value={filterMode} onValueChange={(val: any) => setFilterMode(val)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{language === "ar" ? "اليوم" : "Today"}</SelectItem>
                <SelectItem value="week">{language === "ar" ? "هذا الأسبوع" : "This Week"}</SelectItem>
                <SelectItem value="month">{language === "ar" ? "هذا الشهر" : "This Month"}</SelectItem>
                <SelectItem value="custom">{language === "ar" ? "فترة مخصصة" : "Custom Period"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterMode === "custom" && (
            <>
              <div className="space-y-2">
                <Label>{language === "ar" ? "من تاريخ" : "From Date"}</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[160px]" />
              </div>
            </>
          )}

          <Button onClick={handleDownloadPdf} disabled={isLoading || isGeneratingPdf} className="ms-auto bg-primary hover:bg-primary/90 flex items-center gap-2">
            {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {language === "ar" ? "تحميل تقرير PDF" : "Download PDF Report"}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{language === "ar" ? "الإيرادات" : "Total Revenue"}</p>
                  <p className="text-2xl font-bold mt-1 text-primary">
                    <SecretNumber>{stats.totalRevenue.toFixed(2)}</SecretNumber> <span className="text-sm font-medium">KWD</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{language === "ar" ? "صافي الأرباح" : "Net Profit"}</p>
                  <p className={`text-2xl font-bold mt-1 ${stats.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    <SecretNumber>{stats.netProfit.toFixed(2)}</SecretNumber> <span className="text-sm font-medium">KWD</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{language === "ar" ? "المصروفات العامة" : "General Expenses"}</p>
                  <p className="text-2xl font-bold mt-1 text-red-500">
                    <SecretNumber>{stats.generalExpenses.toFixed(2)}</SecretNumber> <span className="text-sm font-medium">KWD</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{language === "ar" ? "الإيجارات" : "Rents"}</p>
                  <p className="text-2xl font-bold mt-1 text-orange-500">
                    <SecretNumber>{stats.rentExpenses.toFixed(2)}</SecretNumber> <span className="text-sm font-medium">KWD</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-500 dark:bg-orange-950/20 dark:text-orange-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{language === "ar" ? "رواتب الموظفين" : "Salaries"}</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600">
                    <SecretNumber>{stats.totalSalaries.toFixed(2)}</SecretNumber> <span className="text-sm font-medium">KWD</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{language === "ar" ? "المدفوعات المستلمة" : "Payments Received"}</p>
                  <p className="text-2xl font-bold mt-1 text-indigo-600">
                    <SecretNumber>{stats.totalPayments.toFixed(2)}</SecretNumber> <span className="text-sm font-medium">KWD</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ledger Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{language === "ar" ? "تفاصيل المعاملات المالية للفترة" : "Transaction Details for Period"}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "نوع المعاملة" : "Type"}</TableHead>
                    <TableHead>{language === "ar" ? "البيان / التفاصيل" : "Description / Details"}</TableHead>
                    <TableHead>{language === "ar" ? "القيمة" : "Value"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Map tickets */}
                  {data?.tickets.map((t: any) => (
                    <TableRow key={`t-${t.id}`}>
                      <TableCell className="whitespace-nowrap">{format(new Date(t.createdAt), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {language === "ar" ? "حجز تذكرة" : "Ticket Sale"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {t.customerName} - {t.flightRoute || "-"} ({t.ticketStatus})
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                        +<SecretNumber>{parseFloat(t.price).toFixed(2)}</SecretNumber> {t.currency}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Map expenses */}
                  {data?.expenses.map((e: any) => (
                    <TableRow key={`e-${e.id}`}>
                      <TableCell className="whitespace-nowrap">{format(new Date(e.date), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          {language === "ar" ? "مصروفات" : "Expense"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {e.categoryName} {e.description ? `(${e.description})` : ""}
                      </TableCell>
                      <TableCell className="font-bold text-red-600 dark:text-red-400">
                        -<SecretNumber>{parseFloat(e.amount).toFixed(2)}</SecretNumber> {e.currency}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Map payrolls */}
                  {data?.payrolls.map((p: any) => (
                    <TableRow key={`p-${p.id}`}>
                      <TableCell className="whitespace-nowrap">{p.paymentDate ? format(new Date(p.paymentDate), "yyyy-MM-dd") : "-"}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {language === "ar" ? "راتب" : "Salary"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.employeeName} - {language === "ar" ? "راتب شهر" : "Salary for"} {p.month}/{p.year} ({p.status})
                      </TableCell>
                      <TableCell className="font-bold text-amber-600">
                        -<SecretNumber>{(p.netSalary || 0).toFixed(2)}</SecretNumber> {p.currency}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Empty state check */}
                  {data?.tickets.length === 0 && data?.expenses.length === 0 && data?.payrolls.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد معاملات مالية مسجلة لهذه الفترة" : "No transactions recorded for this period"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* OFFSCREEN PRINT TEMPLATE (Reflects A4 page perfectly) */}
      <div style={{ display: "none" }}>
        <div ref={pdfRef} className="p-8 w-[794px] min-h-[1123px] bg-white text-black font-sans relative" dir={language === "ar" ? "rtl" : "ltr"}>
          {/* Header */}
          <div className="flex justify-between items-center border-b pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">{language === "ar" ? "نظام كنوز لإدارة علاقات العملاء" : "Konoz CRM System"}</h1>
              <p className="text-sm text-gray-500 mt-1">{language === "ar" ? "تقرير الأداء المالي التفصيلي" : "Detailed Financial Performance Report"}</p>
            </div>
            <div className="text-end">
              <span className="text-xs font-semibold px-3 py-1 rounded bg-blue-50 text-blue-900">{language === "ar" ? "سري للغاية" : "CONFIDENTIAL"}</span>
              <p className="text-xs text-gray-400 mt-2">{language === "ar" ? "تاريخ التوليد:" : "Generated on:"} {new Date().toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")}</p>
            </div>
          </div>

          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <h2 className="text-sm font-bold text-gray-700 uppercase mb-1">{language === "ar" ? "الفترة الزمنية للتقرير:" : "Report Time Frame:"}</h2>
            <p className="text-base font-semibold text-blue-800">{periodLabel}</p>
          </div>

          {/* Core financial metrics */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="border p-4 rounded bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 uppercase">{language === "ar" ? "إجمالي الإيرادات" : "Total Revenue"}</p>
              <p className="text-xl font-bold text-blue-950 mt-1">{stats.totalRevenue.toFixed(2)} KWD</p>
            </div>
            <div className="border p-4 rounded bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 uppercase">{language === "ar" ? "صافي الأرباح" : "Net Profit"}</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{stats.netProfit.toFixed(2)} KWD</p>
            </div>
            <div className="border p-4 rounded bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 uppercase">{language === "ar" ? "إجمالي المصروفات العامة" : "General Expenses"}</p>
              <p className="text-xl font-bold text-red-700 mt-1">{stats.generalExpenses.toFixed(2)} KWD</p>
            </div>
            <div className="border p-4 rounded bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 uppercase">{language === "ar" ? "إجمالي الإيجارات" : "Total Rents"}</p>
              <p className="text-xl font-bold text-orange-700 mt-1">{stats.rentExpenses.toFixed(2)} KWD</p>
            </div>
            <div className="border p-4 rounded bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 uppercase">{language === "ar" ? "إجمالي رواتب الموظفين" : "Total Salaries"}</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{stats.totalSalaries.toFixed(2)} KWD</p>
            </div>
            <div className="border p-4 rounded bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 uppercase">{language === "ar" ? "المدفوعات المستلمة" : "Payments Received"}</p>
              <p className="text-xl font-bold text-indigo-700 mt-1">{stats.totalPayments.toFixed(2)} KWD</p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-gray-800 mb-3 border-b pb-1 uppercase">{language === "ar" ? "ملخص المعاملات المالية" : "Financial Transaction Log"}</h3>
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 font-bold border-b">
                  <th className="py-2 px-3 text-start">{language === "ar" ? "التاريخ" : "Date"}</th>
                  <th className="py-2 px-3 text-start">{language === "ar" ? "النوع" : "Type"}</th>
                  <th className="py-2 px-3 text-start">{language === "ar" ? "البيان" : "Description"}</th>
                  <th className="py-2 px-3 text-end">{language === "ar" ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody>
                {data?.tickets.map((t: any) => (
                  <tr key={`pdf-t-${t.id}`} className="border-b">
                    <td className="py-2 px-3">{format(new Date(t.createdAt), "yyyy-MM-dd")}</td>
                    <td className="py-2 px-3">{language === "ar" ? "حجز تذكرة" : "Ticket Sale"}</td>
                    <td className="py-2 px-3">{t.customerName} - {t.flightRoute || "-"}</td>
                    <td className="py-2 px-3 text-end text-emerald-700 font-bold">+{parseFloat(t.price).toFixed(2)} {t.currency}</td>
                  </tr>
                ))}
                {data?.expenses.map((e: any) => (
                  <tr key={`pdf-e-${e.id}`} className="border-b">
                    <td className="py-2 px-3">{format(new Date(e.date), "yyyy-MM-dd")}</td>
                    <td className="py-2 px-3">{language === "ar" ? "مصروفات" : "Expense"}</td>
                    <td className="py-2 px-3">{e.categoryName} {e.description ? `(${e.description})` : ""}</td>
                    <td className="py-2 px-3 text-end text-red-600 font-bold">-{parseFloat(e.amount).toFixed(2)} {e.currency}</td>
                  </tr>
                ))}
                {data?.payrolls.map((p: any) => (
                  <tr key={`pdf-p-${p.id}`} className="border-b">
                    <td className="py-2 px-3">{p.paymentDate ? format(new Date(p.paymentDate), "yyyy-MM-dd") : "-"}</td>
                    <td className="py-2 px-3">{language === "ar" ? "راتب موظف" : "Employee Salary"}</td>
                    <td className="py-2 px-3">{p.employeeName} - {p.month}/{p.year}</td>
                    <td className="py-2 px-3 text-end text-amber-700 font-bold">-{(p.netSalary || 0).toFixed(2)} {p.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer / Summary Box */}
          <div className="absolute bottom-12 left-8 right-8 border-t pt-6 flex justify-between items-start text-xs text-gray-500">
            <div>
              <p className="font-bold text-gray-800">{language === "ar" ? "ملخص ختامي:" : "Concluding Summary:"}</p>
              <p className="mt-1 leading-relaxed max-w-md">
                {language === "ar"
                  ? "تم إصدار هذا التقرير كوثيقة رسمية للنظام المالي لشركة كنوز. يعكس التقرير أداء الإيرادات والأرباح والمصروفات والرواتب للمدة المحددة أعلاه."
                  : "This report is generated as an official system financial statement for Konoz System. It represents revenues, profits, expenses, and payrolls for the specified period."}
              </p>
            </div>
            <div className="text-end">
              <p className="font-bold text-gray-800">{language === "ar" ? "نظام حماية كنوز الموثوق" : "Konoz System Reliability Protection"}</p>
              <p className="mt-1">https://konoz.system</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
