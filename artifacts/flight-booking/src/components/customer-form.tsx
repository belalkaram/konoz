import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SheetFooter } from "@/components/ui/sheet";
import { STATUS_LABELS, CUSTOMER_STATUSES } from "@/lib/customer-constants";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

export interface CustomerFormData {
  fullName: string;
  phone: string;
  whatsapp: string;
  email: string;
  nationality: string;
  passportNumber: string;
  nationalId: string;
  address: string;
  status: string;
  // Optional Ticket fields
  pnr?: string;
  bookingDate?: string;
  travelDate?: string;
  costPrice?: string;
  ticketPrice?: string;
}

export const EMPTY_CUSTOMER_FORM: CustomerFormData = {
  fullName: "",
  phone: "",
  whatsapp: "",
  email: "",
  nationality: "",
  passportNumber: "",
  nationalId: "",
  address: "",
  status: "new",
  pnr: "",
  bookingDate: "",
  travelDate: "",
  costPrice: "",
  ticketPrice: "",
};

interface Props {
  initialValues?: Partial<CustomerFormData>;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function CustomerForm({ initialValues, submitLabel, isPending, onSubmit, onCancel }: Props) {
  const { t, isRtl } = useLanguage();
  const [form, setForm] = useState<CustomerFormData>({ ...EMPTY_CUSTOMER_FORM, ...initialValues });
  const [errors, setErrors] = useState<Partial<CustomerFormData>>({});

  function set(field: keyof CustomerFormData, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  }

  function validate(): boolean {
    const errs: Partial<CustomerFormData> = {};
    if (!form.fullName.trim()) {
      errs.fullName = isRtl ? "الاسم الكامل مطلوب" : "Full name is required";
    }
    if (!form.phone.trim()) {
      errs.phone = isRtl ? "رقم الهاتف مطلوب" : "Phone number is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const REQUIRED = new Set(["fullName", "phone"]);
    const payload: Record<string, unknown> = {};
    Object.entries(form).forEach(([k, v]) => {
      if (REQUIRED.has(k)) {
        payload[k] = v;
      } else {
        payload[k] = v || null;
      }
    });
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
        <Label htmlFor="cf-fullName">{t("employees.fullName")}</Label>
        <Input id="cf-fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder={isRtl ? "أحمد حسن" : "Ahmed Hassan"} />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
          <Label htmlFor="cf-phone">{t("customerProfile.labels.phone")} *</Label>
          <Input id="cf-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+96512345678" />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>
        <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
          <Label htmlFor="cf-whatsapp">{t("customerProfile.labels.whatsapp")}</Label>
          <Input id="cf-whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+96512345678" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
          <Label htmlFor="cf-email">{t("common.email")}</Label>
          <Input id="cf-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="ahmed@example.com" />
        </div>
        <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
          <Label>{t("common.status")}</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CUSTOMER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`statuses.${s}`) || STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
          <Label htmlFor="cf-nationality">{t("customerProfile.labels.nationality")}</Label>
          <Input id="cf-nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder={isRtl ? "كويتي" : "Kuwaiti"} />
        </div>
        <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
          <Label htmlFor="cf-passportNumber">{t("customerProfile.labels.passportNo")}</Label>
          <Input id="cf-passportNumber" value={form.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} placeholder="A12345678" />
        </div>
      </div>

      <div className="border-t pt-4 mt-2">
        <h3 className="text-sm font-semibold mb-3 text-primary uppercase tracking-wider">
          {isRtl ? "تفاصيل التذكرة (اختياري)" : "Ticket Information (Optional)"}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
            <Label htmlFor="cf-pnr">{t("common.pnr")}</Label>
            <Input id="cf-pnr" value={form.pnr} onChange={(e) => set("pnr", e.target.value)} placeholder="PNR / Reference" />
          </div>
          <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
            <Label htmlFor="cf-bookingDate">{t("common.bookingDate")}</Label>
            <Input id="cf-bookingDate" type="date" value={form.bookingDate} onChange={(e) => set("bookingDate", e.target.value)} />
          </div>
          <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
            <Label htmlFor="cf-travelDate">{t("common.travelDate")}</Label>
            <Input id="cf-travelDate" type="date" value={form.travelDate} onChange={(e) => set("travelDate", e.target.value)} />
          </div>
          <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
            <Label htmlFor="cf-ticketPrice">{t("common.price")}</Label>
            <Input id="cf-ticketPrice" type="number" step="0.001" value={form.ticketPrice} onChange={(e) => set("ticketPrice", e.target.value)} placeholder="0.000" />
          </div>
          <div className="space-y-1.5 text-right rtl:text-right ltr:text-left">
            <Label htmlFor="cf-costPrice">{t("common.costPrice")}</Label>
            <Input id="cf-costPrice" type="number" step="0.001" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} placeholder="0.000" />
          </div>
        </div>
      </div>

      <SheetFooter className="pt-2 flex-row gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={isPending}>{isPending ? (isRtl ? "جاري الحفظ..." : "Saving...") : submitLabel}</Button>
      </SheetFooter>
    </form>
  );
}
