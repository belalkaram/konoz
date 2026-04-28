import { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface Employee {
  id: number;
  name: string;
  initials: string;
  role: string;
  username: string;
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
}

const EmployeeContext = createContext<EmployeeContextValue>({
  currentEmployee: null,
  employees: [],
  sessionToken: null,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  refreshEmployees: async () => {},
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

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as { employee: Employee };
          if (!cancelled && data.employee?.id) {
            setCurrentEmployee(data.employee);
          }
        }
      } catch {
      }
      if (!cancelled) {
        await loadEmployees();
        setIsLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [loadEmployees]);

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
    fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setCurrentEmployee(null);
  }, []);

  return (
    <EmployeeContext.Provider value={{ currentEmployee, employees, sessionToken: null, isLoading, login, logout, refreshEmployees: loadEmployees }}>
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
