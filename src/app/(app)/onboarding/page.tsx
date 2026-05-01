import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={user} active="new">
      <OnboardingWizard />
    </AppShell>
  );
}
