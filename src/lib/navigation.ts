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

