import { requireAuth } from "@/lib/require-auth";

export default async function CityLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAuth();
  return children;
}
