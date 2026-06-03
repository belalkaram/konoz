import { useLanguage } from "@/contexts/language-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpensesTab } from "./expenses-tab";
import { PayrollTab } from "./payroll-tab";
import { ExpenseCategoriesTab } from "./expense-categories-tab";
import { ReportsTab } from "./reports-tab";
import { PageHeader } from "@/components/page-header";
import { SecurityEyeToggle } from "@/components/security-eye-toggle";
import { Calculator } from "lucide-react";

export default function AccountingLayout() {
  const { language } = useLanguage();

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={language === "ar" ? "الحسابات" : "Accounting"}
        description={language === "ar" ? "إدارة رواتب الموظفين والمصروفات والتقارير المالية" : "Manage employee payrolls, company expenses, and financial statements"}
        icon={Calculator}
        actions={<SecurityEyeToggle />}
      />

      <Tabs defaultValue="payrolls" className="w-full space-y-6">
        <TabsList className="w-full justify-start border-b rounded-none px-2 h-12 bg-transparent gap-6">
          <TabsTrigger 
            value="payrolls"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-sm cursor-pointer"
          >
            {language === "ar" ? "رواتب الموظفين" : "Employee Payrolls"}
          </TabsTrigger>
          <TabsTrigger 
            value="expenses"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-sm cursor-pointer"
          >
            {language === "ar" ? "المصروفات" : "Expenses"}
          </TabsTrigger>
          <TabsTrigger 
            value="categories"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-sm cursor-pointer"
          >
            {language === "ar" ? "أنواع المصروفات" : "Expense Categories"}
          </TabsTrigger>
          <TabsTrigger 
            value="reports"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-sm cursor-pointer"
          >
            {language === "ar" ? "التقارير المالية" : "Financial Reports"}
          </TabsTrigger>
        </TabsList>

        <div className="w-full">
          <TabsContent value="payrolls" className="m-0 focus-visible:outline-none">
            <PayrollTab />
          </TabsContent>
          
          <TabsContent value="expenses" className="m-0 focus-visible:outline-none">
            <ExpensesTab />
          </TabsContent>

          <TabsContent value="categories" className="m-0 focus-visible:outline-none">
            <ExpenseCategoriesTab />
          </TabsContent>

          <TabsContent value="reports" className="m-0 focus-visible:outline-none">
            <ReportsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
