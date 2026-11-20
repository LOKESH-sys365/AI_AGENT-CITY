import { redirect } from "next/navigation";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";

export default async function CityIndexPage() {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) redirect("/login");

  const city = db
    .prepare("SELECT id FROM cities WHERE owner_id = ? ORDER BY id DESC LIMIT 1")
    .get(ownerId) as { id: number } | undefined;

  if (!city) redirect("/dashboard");
  redirect(`/city/${city.id}`);
}
