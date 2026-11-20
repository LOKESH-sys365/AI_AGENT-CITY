import { redirect } from "next/navigation";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { getUserSettings } from "@/lib/user-settings";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) redirect("/login");

  const cityCount = db
    .prepare("SELECT COUNT(*) AS count FROM cities WHERE owner_id = ?")
    .get(ownerId) as { count: number };
  return <SettingsForm initialSettings={getUserSettings(ownerId)} rootLocked={cityCount.count > 0} />;
}
