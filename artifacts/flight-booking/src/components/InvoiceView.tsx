import React from "react";
import {
  Printer,
  Download,
  Plane,
  Calendar,
  User,
  MapPin,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useLanguage } from "@/contexts/language-context";

interface InvoiceViewProps {
  invoice: {
    invoiceNumber: string;
    issueDate: string;
    totalAmount: string;
    status: string;
    notes?: string;
    internalNotes?: string;
    costPrice?: string;
    profit?: string;
  };
  ticket: {
    flightRoute: string;
    airline: string;
    flightNumber: string;
    departureDatetime: string;
    pnr: string;
    passengerName?: string;
  };
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  isAdmin?: boolean;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({
  invoice,
  ticket,
  customer,
  isAdmin = false,
}) => {
  const { t, isRtl } = useLanguage();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const safeFormatDate = (dateValue?: string, pattern = "yyyy/MM/dd") => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return format(date, pattern);
  };

  const printCss = `
    @page {
      size: A4 portrait;
      margin: 0;
    }

    :root {
      --background: #ffffff;
      --foreground: #0f172a;
      --card: #ffffff;
      --card-foreground: #0f172a;
      --popover: #ffffff;
      --popover-foreground: #0f172a;
      --primary: #2563eb;
      --primary-foreground: #ffffff;
      --secondary: #f1f5f9;
      --secondary-foreground: #1e293b;
      --muted: #f8fafc;
      --muted-foreground: #64748b;
      --accent: #f1f5f9;
      --accent-foreground: #1e293b;
      --destructive: #dc2626;
      --destructive-foreground: #ffffff;
      --border: #e2e8f0;
      --input: #e2e8f0;
      --ring: #2563eb;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html,
    body {
      width: 210mm;
      height: 297mm;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      overflow: hidden !important;
      font-family: Arial, Tahoma, sans-serif !important;
    }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .print-page {
      width: 210mm;
      height: 297mm;
      padding: 8mm;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .print-scale-wrapper {
      width: 194mm;
      height: 281mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .print-inner {
      width: 960px;
      transform-origin: center center;
    }

    .print-hidden,
    .print\\:hidden {
      display: none !important;
    }

    #invoice-card {
      width: 960px !important;
      max-width: 960px !important;
      min-width: 960px !important;
      margin: 0 auto !important;
      background: #ffffff !important;
      color: #0f172a !important;
      border: 1px solid #e2e8f0 !important;
      border-top: 8px solid ${isAdmin ? "#9333ea" : "#2563eb"} !important;
      border-radius: 18px !important;
      box-shadow: none !important;
      overflow: hidden !important;
      direction: ${isRtl ? "rtl" : "ltr"} !important;
    }

    .invoice-content {
      padding: 30px !important;
    }

    .invoice-header {
      display: flex !important;
      flex-direction: row !important;
      justify-content: space-between !important;
      align-items: flex-start !important;
      gap: 28px !important;
      margin-bottom: 24px !important;
    }

    .brand-row {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
    }

    .brand-title {
      font-size: 34px !important;
      line-height: 1.15 !important;
      font-weight: 900 !important;
      color: #0f172a !important;
      margin: 0 !important;
      letter-spacing: -0.5px !important;
    }

    .brand-subtitle {
      font-size: 13px !important;
      color: #64748b !important;
      margin: 7px 0 0 !important;
    }

    .invoice-title-box {
      text-align: ${isRtl ? "left" : "right"} !important;
      min-width: 230px !important;
    }

    .invoice-title {
      font-size: 23px !important;
      line-height: 1.25 !important;
      font-weight: 900 !important;
      color: #1e293b !important;
      margin: 0 0 6px !important;
    }

    .invoice-number {
      font-size: 15px !important;
      color: #64748b !important;
      margin: 0 0 8px !important;
    }

    .status-badge {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 5px 13px !important;
      border-radius: 999px !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      border: 1px solid #e2e8f0 !important;
      height: auto !important;
      line-height: 1.4 !important;
    }

    .status-paid {
      background: #dcfce7 !important;
      color: #15803d !important;
      border-color: #bbf7d0 !important;
    }

    .status-pending {
      background: #fef9c3 !important;
      color: #a16207 !important;
      border-color: #fef08a !important;
    }

    .status-cancelled {
      background: #fee2e2 !important;
      color: #b91c1c !important;
      border-color: #fecaca !important;
    }

    .status-draft {
      background: #f3f4f6 !important;
      color: #374151 !important;
      border-color: #e5e7eb !important;
    }

    .separator {
      height: 1px !important;
      background: #e2e8f0 !important;
      margin: 22px 0 !important;
      border: 0 !important;
    }

    .info-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 42px !important;
      margin-bottom: 28px !important;
    }

    .section-label {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-size: 13px !important;
      line-height: 1.4 !important;
      font-weight: 900 !important;
      color: #94a3b8 !important;
      margin-bottom: 12px !important;
    }

    .customer-name {
      font-size: 20px !important;
      line-height: 1.35 !important;
      font-weight: 900 !important;
      color: #1e293b !important;
      margin: 0 0 6px !important;
      word-break: break-word !important;
    }

    .small-line {
      font-size: 14px !important;
      line-height: 1.5 !important;
      color: #475569 !important;
      margin: 3px 0 !important;
      word-break: break-word !important;
    }

    .detail-row {
      display: flex !important;
      justify-content: flex-start !important;
      align-items: center !important;
      gap: 10px !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      margin: 4px 0 !important;
    }

    .detail-value {
      font-weight: 800 !important;
      color: #1e293b !important;
    }

    .detail-label {
      color: #64748b !important;
    }

    .flight-table {
      border: 1px solid #e2e8f0 !important;
      border-radius: 16px !important;
      overflow: hidden !important;
      margin-bottom: 28px !important;
      background: #f8fafc !important;
    }

    .flight-table-header,
    .flight-table-row {
      display: grid !important;
      grid-template-columns: 2fr 1fr 1fr !important;
      gap: 16px !important;
      align-items: center !important;
    }

    .flight-table-header {
      background: #f1f5f9 !important;
      color: #334155 !important;
      font-weight: 900 !important;
      padding: 14px 18px !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
    }

    .flight-table-row {
      padding: 18px !important;
      border-top: 1px solid #e2e8f0 !important;
      background: #ffffff !important;
    }

    .route-title {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      color: #1e293b !important;
      font-size: 18px !important;
      font-weight: 900 !important;
      margin-bottom: 6px !important;
      line-height: 1.4 !important;
    }

    .totals-box {
      display: flex !important;
      justify-content: ${isRtl ? "flex-start" : "flex-end"} !important;
      margin-bottom: 26px !important;
    }

    .totals-inner {
      width: 310px !important;
      max-width: 310px !important;
    }

    .total-row {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      color: #475569 !important;
      margin-bottom: 10px !important;
      font-size: 15px !important;
      line-height: 1.5 !important;
    }

    .final-total {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding-top: 12px !important;
      border-top: 1px solid #e2e8f0 !important;
    }

    .final-total-label {
      font-size: 18px !important;
      font-weight: 900 !important;
      color: #1e293b !important;
    }

    .final-total-value {
      font-size: 28px !important;
      line-height: 1.2 !important;
      font-weight: 900 !important;
      color: #2563eb !important;
      white-space: nowrap !important;
    }

    .notes-box {
      background: #eff6ff !important;
      border: 1px solid #dbeafe !important;
      border-radius: 14px !important;
      padding: 14px !important;
      margin-bottom: 24px !important;
    }

    .notes-title {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      color: #1e40af !important;
      font-weight: 900 !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      margin-bottom: 8px !important;
    }

    .notes-text {
      color: #1d4ed8 !important;
      font-size: 14px !important;
      line-height: 1.7 !important;
      margin: 0 !important;
      word-break: break-word !important;
    }

    .admin-box {
      display: none !important;
    }

    .footer {
      margin-top: 24px !important;
      text-align: center !important;
      color: #94a3b8 !important;
      font-size: 12px !important;
      line-height: 1.5 !important;
    }

    .footer-content {
      display: flex !important;
      flex-direction: row !important;
      justify-content: space-between !important;
      align-items: center !important;
      gap: 12px !important;
      padding-top: 14px !important;
      border-top: 1px solid #e2e8f0 !important;
    }

    .footer-contact {
      display: flex !important;
      flex-direction: row !important;
      gap: 18px !important;
    }

    svg {
      flex-shrink: 0 !important;
    }

    #invoice-card .text-blue-600,
    #invoice-card .text-blue-700,
    #invoice-card .text-blue-800 {
      color: #2563eb !important;
    }

    #invoice-card .text-green-600,
    #invoice-card .text-green-700 {
      color: #16a34a !important;
    }

    #invoice-card .text-yellow-700 {
      color: #a16207 !important;
    }

    #invoice-card .text-red-700 {
      color: #b91c1c !important;
    }

    #invoice-card .text-gray-700 {
      color: #374151 !important;
    }

    #invoice-card .text-purple-700 {
      color: #7e22ce !important;
    }

    #invoice-card .text-purple-400 {
      color: #c084fc !important;
    }

    #invoice-card .bg-green-100 {
      background-color: #dcfce7 !important;
    }

    #invoice-card .bg-yellow-100 {
      background-color: #fef9c3 !important;
    }

    #invoice-card .bg-red-100 {
      background-color: #fee2e2 !important;
    }

    #invoice-card .bg-gray-100 {
      background-color: #f3f4f6 !important;
    }

    #invoice-card .bg-blue-50 {
      background-color: #eff6ff !important;
    }

    #invoice-card .bg-purple-50\\/30 {
      background-color: #faf5ff !important;
    }

    #invoice-card .bg-slate-50\\/50 {
      background-color: #f8fafc !important;
    }

    #invoice-card .border-green-200 {
      border-color: #bbf7d0 !important;
    }

    #invoice-card .border-yellow-200 {
      border-color: #fef08a !important;
    }

    #invoice-card .border-red-200 {
      border-color: #fecaca !important;
    }

    #invoice-card .border-blue-100 {
      border-color: #dbeafe !important;
    }

    #invoice-card .border-purple-100 {
      border-color: #f3e8ff !important;
    }

    #invoice-card .border-purple-200 {
      border-color: #e9d5ff !important;
    }

    #invoice-card .border-slate-100 {
      border-color: #f1f5f9 !important;
    }

    #invoice-card .border-t-blue-600 {
      border-top-color: #2563eb !important;
    }

    #invoice-card .border-t-purple-600 {
      border-top-color: #9333ea !important;
    }

    #invoice-card .text-slate-400 {
      color: #94a3b8 !important;
    }

    #invoice-card .text-slate-500 {
      color: #64748b !important;
    }

    #invoice-card .text-slate-600 {
      color: #475569 !important;
    }

    #invoice-card .text-slate-700 {
      color: #334155 !important;
    }

    #invoice-card .text-slate-800 {
      color: #1e293b !important;
    }

    #invoice-card .text-slate-900 {
      color: #0f172a !important;
    }
  `;

  const fitPrintableInvoice = (root: ParentNode) => {
    const wrapper = root.querySelector(".print-scale-wrapper") as HTMLElement | null;
    const inner = root.querySelector(".print-inner") as HTMLElement | null;
    const card = root.querySelector("#invoice-card") as HTMLElement | null;

    if (!wrapper || !inner || !card) return;

    inner.style.transform = "scale(1)";
    inner.style.width = "960px";

    const availableWidth = wrapper.clientWidth;
    const availableHeight = wrapper.clientHeight;

    const cardWidth = card.scrollWidth;
    const cardHeight = card.scrollHeight;

    const scaleX = availableWidth / cardWidth;
    const scaleY = availableHeight / cardHeight;

    const scale = Math.min(scaleX, scaleY, 1);

    inner.style.transform = `scale(${scale})`;
  };

  const buildPrintableHTML = (cardHTML: string) => {
    return `
      <!DOCTYPE html>
      <html dir="${isRtl ? "rtl" : "ltr"}">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title></title>
          <style>${printCss}</style>
        </head>

        <body>
          <div class="print-page">
            <div class="print-scale-wrapper">
              <div class="print-inner">
                ${cardHTML}
              </div>
            </div>
          </div>

          <script>
            document.title = "";

            function fitPrintableInvoice() {
              const wrapper = document.querySelector(".print-scale-wrapper");
              const inner = document.querySelector(".print-inner");
              const card = document.getElementById("invoice-card");

              if (!wrapper || !inner || !card) return;

              inner.style.transform = "scale(1)";
              inner.style.width = "960px";

              const availableWidth = wrapper.clientWidth;
              const availableHeight = wrapper.clientHeight;

              const cardWidth = card.scrollWidth;
              const cardHeight = card.scrollHeight;

              const scaleX = availableWidth / cardWidth;
              const scaleY = availableHeight / cardHeight;
              const scale = Math.min(scaleX, scaleY, 1);

              inner.style.transform = "scale(" + scale + ")";
            }

            window.onload = function () {
              fitPrintableInvoice();

              setTimeout(function () {
                window.print();
                window.close();
              }, 350);
            };
          </script>
        </body>
      </html>
    `;
  };

  const fixOklchColors = (clonedDocument: Document) => {
    const root = clonedDocument.documentElement;
    const body = clonedDocument.body;

    const safeVars: Record<string, string> = {
      "--background": "#ffffff",
      "--foreground": "#0f172a",
      "--card": "#ffffff",
      "--card-foreground": "#0f172a",
      "--popover": "#ffffff",
      "--popover-foreground": "#0f172a",
      "--primary": "#2563eb",
      "--primary-foreground": "#ffffff",
      "--secondary": "#f1f5f9",
      "--secondary-foreground": "#1e293b",
      "--muted": "#f8fafc",
      "--muted-foreground": "#64748b",
      "--accent": "#f1f5f9",
      "--accent-foreground": "#1e293b",
      "--destructive": "#dc2626",
      "--destructive-foreground": "#ffffff",
      "--border": "#e2e8f0",
      "--input": "#e2e8f0",
      "--ring": "#2563eb",
    };

    Object.entries(safeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    body.style.backgroundColor = "#ffffff";
    body.style.color = "#0f172a";

    const allElements = clonedDocument.querySelectorAll<HTMLElement>("*");

    allElements.forEach((el) => {
      const computed = clonedDocument.defaultView?.getComputedStyle(el);
      if (!computed) return;

      const colorProps = [
        "color",
        "backgroundColor",
        "borderColor",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
        "outlineColor",
        "textDecorationColor",
      ] as const;

      colorProps.forEach((prop) => {
        const value = computed[prop];

        if (value && value.includes("oklch")) {
          if (prop === "color") {
            el.style.color = "#0f172a";
          } else if (prop === "backgroundColor") {
            el.style.backgroundColor = "transparent";
          } else {
            el.style.borderColor = "#e2e8f0";
          }
        }
      });

      if (computed.boxShadow && computed.boxShadow.includes("oklch")) {
        el.style.boxShadow = "none";
      }
    });
  };

  const handlePrint = () => {
    const invoiceCard = document.getElementById("invoice-card");
    if (!invoiceCard) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(buildPrintableHTML(invoiceCard.outerHTML));
    printWindow.document.close();
  };

  const handleDownloadPDF = async () => {
    const invoiceCard = document.getElementById("invoice-card");
    if (!invoiceCard) return;

    setIsGenerating(true);

    let pdfRoot: HTMLDivElement | null = null;

    try {
      pdfRoot = document.createElement("div");
      pdfRoot.id = "invoice-pdf-render-root";
      pdfRoot.dir = isRtl ? "rtl" : "ltr";

      pdfRoot.style.position = "fixed";
      pdfRoot.style.left = "0";
      pdfRoot.style.top = "0";
      pdfRoot.style.width = "210mm";
      pdfRoot.style.height = "297mm";
      pdfRoot.style.backgroundColor = "#ffffff";
      pdfRoot.style.zIndex = "-1";
      pdfRoot.style.opacity = "0";
      pdfRoot.style.pointerEvents = "none";
      pdfRoot.style.overflow = "hidden";

      pdfRoot.innerHTML = `
        <style>${printCss}</style>
        <div class="print-page">
          <div class="print-scale-wrapper">
            <div class="print-inner">
              ${invoiceCard.outerHTML}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(pdfRoot);

      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 150));

      fitPrintableInvoice(pdfRoot);

      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 150));

      const pageElement = pdfRoot.querySelector(".print-page") as HTMLElement | null;

      if (!pageElement) {
        throw new Error("PDF page element was not found.");
      }

      const canvas = await html2canvas(pageElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: pageElement.offsetWidth,
        height: pageElement.offsetHeight,
        windowWidth: pageElement.offsetWidth,
        windowHeight: pageElement.offsetHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDocument) => {
          fixOklchColors(clonedDocument);

          const clonedRoot = clonedDocument.getElementById("invoice-pdf-render-root");

          if (clonedRoot) {
            clonedRoot.style.opacity = "1";
            clonedRoot.style.zIndex = "1";
            clonedRoot.style.position = "static";
          }
        },
      });

      const imgData = canvas.toDataURL("image/png", 1.0);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");
      pdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("حدث خطأ أثناء تحميل الفاتورة PDF. برجاء المحاولة مرة أخرى.");
    } finally {
      if (pdfRoot && document.body.contains(pdfRoot)) {
        document.body.removeChild(pdfRoot);
      }

      setIsGenerating(false);
    }
  };

  const statusColors: Record<string, string> = {
    paid: "bg-green-100 text-green-700 border-green-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    draft: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const statusText: Record<string, string> = {
    paid: isRtl ? "تم الدفع" : "Paid",
    pending: isRtl ? "بانتظار الدفع" : "Pending Payment",
    cancelled: isRtl ? "ملغاة" : "Cancelled",
    draft: isRtl ? "مسودة" : "Draft",
  };

  const formattedIssueDate = safeFormatDate(invoice.issueDate);

  const formattedDepartureDate = safeFormatDate(
    ticket.departureDatetime,
    "yyyy/MM/dd HH:mm"
  );

  const costPrice = parseFloat(invoice.costPrice || "0");
  const profit = parseFloat(invoice.profit || "0");

  const profitPercentage =
    costPrice > 0 && profit > 0
      ? `${((profit / costPrice) * 100).toFixed(1)}%`
      : "0%";

  return (
    <div
      id="invoice-view-container"
      className="max-w-5xl mx-auto p-4 md:p-8 space-y-6"
    >
      <div className="flex justify-end gap-3 print:hidden print-hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all shadow-sm"
        >
          <Printer className="w-4 h-4" />
          {isRtl ? "طباعة الفاتورة" : "Print Invoice"}
        </button>

        <button
          onClick={handleDownloadPDF}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 border border-input bg-background rounded-md hover:bg-accent transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isGenerating ? (isRtl ? "جاري التحميل..." : "Loading...") : (t("ticketDetail.invoice.downloadPdf") || "Download PDF")}
        </button>
      </div>

      <Card
        id="invoice-card"
        className={cn(
          "bg-white shadow-xl border-t-8 overflow-hidden",
          isAdmin ? "border-t-purple-600" : "border-t-blue-600"
        )}
      >
        <CardContent className="p-8 invoice-content">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 invoice-header">
            <div className="space-y-2">
              <div className="flex items-center gap-2 brand-row">
                <Plane className="w-8 h-8" style={{ color: "#2563eb" }} />

                <h1
                  className="text-3xl font-bold tracking-tight brand-title"
                  style={{ color: "#0f172a" }}
                >
                  Konoz Travel
                </h1>
              </div>

              <p
                className="text-sm brand-subtitle"
                style={{ color: "#64748b" }}
              >
                {isRtl ? "بوابتك لعالم من السفر المريح والآمن" : "Your gateway to comfortable and safe travel"}
              </p>
            </div>

            <div className="text-start md:text-end space-y-1 invoice-title-box">
              <h2
                className="text-xl font-bold invoice-title"
                style={{ color: "#1e293b" }}
              >
                {t("ticketDetail.invoice.title") || (isRtl ? "فاتورة ضريبية" : "Tax Invoice")}
              </h2>

              <p className="invoice-number" style={{ color: "#64748b" }}>
                #{invoice.invoiceNumber}
              </p>

              <Badge
                variant="outline"
                className={cn(
                  "mt-2 status-badge",
                  invoice.status === "paid" && "status-paid",
                  invoice.status === "pending" && "status-pending",
                  invoice.status === "cancelled" && "status-cancelled",
                  invoice.status === "draft" && "status-draft",
                  statusColors[invoice.status] || "bg-gray-100"
                )}
              >
                {statusText[invoice.status] || invoice.status}
              </Badge>
            </div>
          </div>

          <Separator className="my-8 separator" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10 info-grid">
            <div className="space-y-4">
              <h3
                className="text-sm font-semibold uppercase flex items-center gap-2 section-label"
                style={{ color: "#94a3b8" }}
              >
                <User className="w-4 h-4" />
                {t("ticketDetail.invoice.billTo") || (isRtl ? "بيانات العميل" : "Bill To")}
              </h3>

              <div className="space-y-1">
                <p
                  className="font-bold text-lg customer-name"
                  style={{ color: "#1e293b" }}
                >
                  {customer.name}
                </p>

                {customer.email && (
                  <p className="small-line" style={{ color: "#475569" }}>
                    {customer.email}
                  </p>
                )}

                {customer.phone && (
                  <p className="small-line" style={{ color: "#475569" }}>
                    {customer.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 text-start md:text-end">
              <h3
                className="text-sm font-semibold uppercase flex items-center gap-2 md:justify-end section-label"
                style={{ color: "#94a3b8" }}
              >
                <Calendar className="w-4 h-4" />
                {isRtl ? "تفاصيل الفاتورة" : "Invoice Details"}
              </h3>

              <div className="space-y-1">
                <div className="flex justify-between md:justify-end gap-4 detail-row">
                  <span className="detail-label" style={{ color: "#64748b" }}>
                    {isRtl ? "تاريخ الإصدار:" : "Issue Date:"}
                  </span>
                  <span
                    className="font-medium detail-value"
                    style={{ color: "#1e293b" }}
                  >
                    {formattedIssueDate}
                  </span>
                </div>

                <div className="flex justify-between md:justify-end gap-4 detail-row">
                  <span className="detail-label" style={{ color: "#64748b" }}>
                    {isRtl ? "رقم الحجز (PNR):" : "PNR (Booking Ref):"}
                  </span>
                  <span
                    className="font-medium detail-value"
                    style={{ color: "#1e293b" }}
                  >
                    {ticket.pnr || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-xl border border-slate-100 overflow-hidden mb-10 flight-table"
            style={{ backgroundColor: "#f8fafc" }}
          >
            <div
              className="p-4 font-bold grid grid-cols-4 gap-4 flight-table-header"
              style={{ backgroundColor: "#f1f5f9", color: "#334155" }}
            >
              <div className="col-span-2">{t("ticketDetail.invoice.description") || (isRtl ? "الوصف (تفاصيل الرحلة)" : "Description")}</div>
              <div className="text-center">{t("common.airline") || (isRtl ? "شركة الطيران" : "Airline")}</div>
              <div className="text-end">{t("ticketDetail.invoice.amount") || (isRtl ? "المبلغ" : "Amount")}</div>
            </div>

            <div className="p-6 grid grid-cols-4 gap-4 items-center border-b border-slate-100 flight-table-row">
              <div className="col-span-2 space-y-1">
                <div
                  className="font-bold flex items-center gap-2 route-title"
                  style={{ color: "#1e293b" }}
                >
                  <MapPin className="w-4 h-4" style={{ color: "#3b82f6" }} />
                  {ticket.flightRoute}
                </div>

                <p className="text-sm small-line" style={{ color: "#64748b" }}>
                  {isRtl ? `رقم الرحلة: ${ticket.flightNumber}` : `Flight No: ${ticket.flightNumber}`}
                </p>

                <p className="text-xs small-line" style={{ color: "#94a3b8" }}>
                  {isRtl ? `الموعد: ${formattedDepartureDate}` : `Departure: ${formattedDepartureDate}`}
                </p>
              </div>

              <div
                className="text-center font-medium"
                style={{ color: "#475569" }}
              >
                {ticket.airline}
              </div>

              <div className="text-end font-bold" style={{ color: "#0f172a" }}>
                {invoice.totalAmount} KWD
              </div>
            </div>
          </div>

          <div className="flex justify-end mb-10 totals-box">
            <div className="w-full md:w-64 space-y-3 totals-inner">
              <div
                className="flex justify-between total-row"
                style={{ color: "#475569" }}
              >
                <span>{t("ticketDetail.invoice.subtotal") || (isRtl ? "الإجمالي الفرعي:" : "Subtotal:")}</span>
                <span>{invoice.totalAmount} KWD</span>
              </div>

              <div
                className="flex justify-between total-row"
                style={{ color: "#475569" }}
              >
                <span>{t("ticketDetail.invoice.tax") || (isRtl ? "الضرائب" : "Tax")} (0%):</span>
                <span>0.00 KWD</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center py-2 final-total">
                <span
                  className="text-lg font-bold final-total-label"
                  style={{ color: "#1e293b" }}
                >
                  {t("ticketDetail.invoice.total") || (isRtl ? "الإجمالي النهائي:" : "Total:")}
                </span>

                <span
                  className="text-2xl font-black final-total-value"
                  style={{ color: "#2563eb" }}
                >
                  {invoice.totalAmount} KWD
                </span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 mb-8 notes-box">
              <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-1 notes-title">
                <Info className="w-4 h-4" />
                {isRtl ? "ملاحظات:" : "Notes:"}
              </h4>

              <p className="text-sm text-blue-700 leading-relaxed notes-text">
                {invoice.notes}
              </p>
            </div>
          )}

          {isAdmin && (
            <div className="mt-12 p-6 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/30 print:hidden print-hidden admin-box">
              <div className="flex items-center gap-2 mb-4 text-purple-700">
                <ShieldCheck className="w-6 h-6" />
                <h3 className="text-lg font-bold">{isRtl ? "بيانات الإدارة (سرية)" : "Admin Data (Confidential)"}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-purple-400 font-bold uppercase">
                    {t("common.costPrice") || (isRtl ? "التكلفة (Cost Price)" : "Cost Price")}
                  </p>

                  <p className="text-xl font-bold text-slate-800">
                    {invoice.costPrice || "0.00"} KWD
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-purple-400 font-bold uppercase">
                    {t("common.profit") || (isRtl ? "الربح الصافي (Profit)" : "Net Profit")}
                  </p>

                  <p className="text-xl font-bold text-green-600">
                    +{invoice.profit || "0.00"} KWD
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-purple-400 font-bold uppercase">
                    {isRtl ? "نسبة الربح" : "Profit margin"}
                  </p>

                  <p className="text-xl font-bold text-slate-800">
                    {profitPercentage}
                  </p>
                </div>
              </div>

              {invoice.internalNotes && (
                <div className="mt-4 pt-4 border-t border-purple-100">
                  <p className="text-xs text-purple-400 font-bold uppercase mb-1">
                    {isRtl ? "ملاحظات داخلية:" : "Internal Notes:"}
                  </p>

                  <p className="text-sm text-slate-700">
                    {invoice.internalNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-12 text-center space-y-4 footer">
            <Separator />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 pt-4 footer-content">
              <p>
                © {new Date().getFullYear()} Konoz Travel - {isRtl ? "جميع الحقوق محفوظة" : "All rights reserved"}
              </p>

              <div className="flex gap-4 footer-contact">
                <span>info@konoztravel.com</span>
                <span>+965 12345678</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              ${printCss}

              #invoice-view-container {
                width: 210mm !important;
                min-height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: none !important;
                background: #ffffff !important;
              }
            }

            #invoice-card {
              background-color: #ffffff !important;
              color: #0f172a !important;
              border-color: #e2e8f0 !important;
            }

            #invoice-card * {
              --background: #ffffff !important;
              --foreground: #0f172a !important;
              --card: #ffffff !important;
              --card-foreground: #0f172a !important;
              --popover: #ffffff !important;
              --popover-foreground: #0f172a !important;
              --primary: #2563eb !important;
              --primary-foreground: #ffffff !important;
              --secondary: #f1f5f9 !important;
              --secondary-foreground: #1e293b !important;
              --muted: #f8fafc !important;
              --muted-foreground: #64748b !important;
              --accent: #f1f5f9 !important;
              --accent-foreground: #1e293b !important;
              --destructive: #dc2626 !important;
              --destructive-foreground: #ffffff !important;
              --border: #e2e8f0 !important;
              --input: #e2e8f0 !important;
              --ring: #2563eb !important;
            }
          `,
        }}
      />
    </div>
  );
};