import type { ReactNode } from "react";
import { loginConfig, requireUser, secretWarning } from "@/lib/auth";
import { YardShell } from "@/components/yard-nav";

export default async function YardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const config = loginConfig();
  return (
    <YardShell user={user} showPasswordWarning={config.usingDefault || secretWarning()}>
      {children}
    </YardShell>
  );
}
