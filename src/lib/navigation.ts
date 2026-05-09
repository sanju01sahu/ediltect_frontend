import {
  BarChart3,
  Coins,
  CreditCard,
  FileCheck2,
  Gift,
  Home,
  ShieldCheck,
  SunMedium,
  Users,
} from "lucide-react";
import { Role } from "@/types/api";

export const navItems = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/users", label: "Users", icon: Users },
  { href: "/solutions", label: "Solutions", icon: SunMedium },
  { href: "/contracts", label: "Contracts", icon: FileCheck2 },
  { href: "/commissions", label: "Commissions", icon: Coins },
  { href: "/bonuses", label: "Bonuses", icon: Gift },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/audit-logs", label: "Audit Logs", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const hiddenByRole: Record<Role, string[]> = {
  ADMIN: [],
  AREA_MANAGER: ["/audit-logs"],
  AGENT: ["/users", "/payments", "/audit-logs", "/reports"]
};

export function getAllowedNavItems(role: Role) {
  const blocked = new Set(hiddenByRole[role]);
  return navItems.filter((item) => !blocked.has(item.href));
}

export function canAccessRoute(role: Role, pathname: string) {
  const allowedHrefs = new Set(getAllowedNavItems(role).map((item) => item.href));
  return allowedHrefs.has(pathname);
}
