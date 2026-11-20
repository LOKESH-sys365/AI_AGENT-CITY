import { notFound, redirect } from "next/navigation";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { getUserSettings } from "@/lib/user-settings";
import CityWorkspace from "./city-workspace";

export default async function OwnedCityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) redirect("/login");

  const { id } = await params;
  const cityId = Number(id);
  if (!Number.isSafeInteger(cityId) || cityId < 1) notFound();

  const city = db
    .prepare("SELECT id, name FROM cities WHERE id = ? AND owner_id = ?")
    .get(cityId, ownerId) as { id: number; name: string } | undefined;
  if (!city) notFound();

  const settings = getUserSettings(ownerId);
  return <CityWorkspace cityId={city.id} cityName={city.name} enabledAgents={settings.enabledAgents} />;
}
