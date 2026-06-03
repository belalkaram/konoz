import { useLanguage } from "@/contexts/language-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpensesTab } from "./expenses-tab";
import { PayrollTab } from "./payroll-tab";
import { ExpenseCategoriesTab } from "./expense-categories-tab";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Calculator } from "lucide-react";

export default function AccountingLayout() {
  const { t, language } = useLanguage();

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={language === "ar" ? "الحسابات" : "Accounting"}
        description={language === "ar" ? "إدارة رواتب الموظفين والمصروفات" : "Manage employee payrolls and company expenses"}
        icon={Calculator}
      />

      <Card className="flex-1 border-border/40 shadow-sm overflow-hidden flex flex-col p-4 bg-white/50 dark:bg-card/50 backdrop-blur-sm">
        <Tabs defaultValue="payrolls" className="flex-1 flex flex-col h-full">
          <TabsList className="w-full justify-start border-b rounded-none px-2 h-12 bg-transparent gap-6">
            <TabsTrigger 
              value="payrolls"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
            >
              {language === "ar" ? "رواتب الموظفين" : "Employee Payrolls"}
            </TabsTrigger>
            <TabsTrigger 
              value="expenses"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
            >
              {language === "ar" ? "المصروفات" : "Expenses"}
            </TabsTrigger>
            <TabsTrigger 
              value="categories"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
            >
              {language === "ar" ? "أنواع المصروفات" : "Expense Categories"}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto p-4 mt-4">
            <TabsContent value="payrolls" className="h-full m-0">
              <PayrollTab />
            </TabsContent>
            
            <TabsContent value="expenses" className="h-full m-0">
              <ExpensesTab />
            </TabsContent>

            <TabsContent value="categories" className="h-full m-0">
              <ExpenseCategoriesTab />
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </div>
  );
}
