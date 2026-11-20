import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { getUserSettings } from "@/lib/user-settings";
import DocumentStudio from "./document-studio";

export default async function CityDocumentsPage({
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
  return (
    <main className="document-shell">
      <header className="document-header">
        <div>
          <p className="city-context">{city.name}</p>
          <h1>Document Studio</h1>
          <p>Local PDF Maker, Editor, and Judge with retrieval from your city library.</p>
        </div>
        <nav className="city-navigation" aria-label="Document navigation">
          <Link className="city-auth-link" href={`/city/${city.id}`}>Back to city</Link>
          <Link className="city-auth-link" href="/dashboard">All cities</Link>
        </nav>
      </header>
      <DocumentStudio cityId={city.id} enabledAgents={settings.enabledAgents} />
    </main>
  );
}
