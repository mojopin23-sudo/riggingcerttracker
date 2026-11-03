import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { getSessionUser, loginConfig } from "@/lib/auth";
import { Banner } from "@/components/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firstParam, safeNextPath } from "@/lib/params";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getSessionUser()) redirect("/");
  const params = await searchParams;
  const error = firstParam(params.error);
  const next = safeNextPath(firstParam(params.next));
  const config = loginConfig();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm font-semibold tracking-[0.16em] text-[#9a3412] uppercase">Rig Runner · Jourdanton</p>
      <h1 className="font-heading mt-2 text-7xl leading-none font-bold tracking-wide">331</h1>
      <p className="mt-2 text-xl font-medium">Equipment certifications for Terminal 331.</p>
      <p className="mt-2 text-base text-muted-foreground">
        Winch trucks, cranes, forklifts, tandem poles, pickups, and trailers. One shared yard login.
      </p>

      <form action={login} className="mt-8 space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <input type="hidden" name="next" value={next} />
        <Banner error={error} />
        {config.locked ? (
          <p className="rounded-xl bg-[#7c2d12] px-4 py-3 text-base text-white">
            This server has no APP_PASSWORD yet. Set it, then come back.
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="username" className="text-base">
            Name
          </Label>
          <Input id="username" name="username" autoComplete="username" defaultValue={config.user} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-base">
            Password
          </Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" size="yard" className="w-full">
          Sign in
        </Button>
        {config.usingDefault ? (
          <p className="text-sm leading-5 text-muted-foreground">
            This copy is using the built-in login <span className="font-semibold text-foreground">terminal</span> /{" "}
            <span className="font-semibold text-foreground">terminal331</span>. Change it before the app leaves the yard office.
          </p>
        ) : null}
      </form>
    </main>
  );
}
