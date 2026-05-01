import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authFetch } from "../lib/api";

export interface Employee {
  id: number;
  name: string;
  initials: string;
  role: string;
  username: string;
  email?: string | null;
  isActive?: boolean;
}

interface EmployeeContextValue {
  currentEmployee: Employee | null;
  employees: Employee[];
  sessionToken: string | null;
  isLoading: boolean;
  login: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshEmployees: () => Promise<void>;
  refreshCurrentEmployee: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextValue>({
  currentEmployee: null,
  employees: [],
  sessionToken: null,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  refreshEmployees: async () => {},
  refreshCurrentEmployee: async () => {},
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/employees`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { employees: Employee[] };
        setEmployees(data.employees);
      }
    } catch {
    }
  }, []);

  const refreshCurrentEmployee = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { employee: Employee };
        if (data.employee?.id) {
          setCurrentEmployee(data.employee);
        }
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    async function init() {
      await refreshCurrentEmployee();
      await loadEmployees();
      setIsLoading(false);
    }
    init();
  }, [loadEmployees, refreshCurrentEmployee]);

  const login = useCallback(async (username: string, pin: string) => {
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: (body as { message?: string }).message ?? "Invalid credentials" };
      }

      const body = (await res.json()) as { employee: Employee };
      setCurrentEmployee(body.employee);
      return { success: true };
    } catch {
      return { success: false, error: "Unable to connect. Please try again." };
    }
  }, []);

  const logout = useCallback(() => {
    authFetch(`${BASE}/api/auth/logout`, { method: "POST" }).catch(() => {});
    setCurrentEmployee(null);
  }, []);

  return (
    <EmployeeContext.Provider value={{ currentEmployee, employees, sessionToken: null, isLoading, login, logout, refreshEmployees: loadEmployees, refreshCurrentEmployee }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  return useContext(EmployeeContext);
}

export function useCurrentEmployee(): Employee {
  const { currentEmployee } = useContext(EmployeeContext);
  if (!currentEmployee) {
    throw new Error("useCurrentEmployee must be called in an authenticated context");
  }
  return currentEmployee;
}
