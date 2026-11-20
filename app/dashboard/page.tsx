"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

type City = { id: number; name: string };

function isCityList(value: unknown): value is { cities: City[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "cities" in value &&
    Array.isArray(value.cities) &&
    value.cities.every(
      (city) =>
        typeof city === "object" &&
        city !== null &&
        "id" in city &&
        typeof city.id === "number" &&
        "name" in city &&
        typeof city.name === "string",
    )
  );
}

function isCreatedCity(value: unknown): value is { city: City } {
  return (
    typeof value === "object" &&
    value !== null &&
    "city" in value &&
    typeof value.city === "object" &&
    value.city !== null &&
    "id" in value.city &&
    typeof value.city.id === "number" &&
    "name" in value.city &&
    typeof value.city.name === "string"
  );
}

function responseError(value: unknown, fallback: string) {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return fallback;
}

export default function DashboardPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cityName, setCityName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function loadCities() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/cities");
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(result, "Could not load your cities."));
      if (!isCityList(result)) throw new Error("The cities response was invalid.");
      setCities(result.cities);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your cities.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCities();
  }, []);

  async function createCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;

    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cityName }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(result, "Could not create the city."));
      if (!isCreatedCity(result)) throw new Error("The city response was invalid.");

      setCities((current) => [result.city, ...current]);
      setCityName("");
      setDialogOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not create the city.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-topline">
          <span>01 / YOUR CITY PROJECT</span>
          <span>TECHNICAL OVERVIEW</span>
          <nav className="dashboard-auth-actions" aria-label="Account">
            <Link href="/settings">Settings</Link>
            <button type="button" onClick={() => signOut({ redirectTo: "/login" })}>
              Log out
            </button>
          </nav>
        </header>

        <section className="dashboard-content">
          <div className="dashboard-intro">
            <p className="dashboard-kicker">INTRODUCING YOUR WORKSPACE</p>
            <h1>Agent City</h1>
            <p className="dashboard-summary">
              A local home for your AI agents, built around the work you want to get done.
            </p>

            <section className="dashboard-cities" aria-labelledby="cities-heading">
              <div className="dashboard-section-heading">
                <h2 id="cities-heading">Your cities</h2>
                <span>{String(cities.length).padStart(2, "0")} TOTAL</span>
              </div>

              {loading ? (
                <p className="dashboard-state">Loading your cities…</p>
              ) : loadError ? (
                <div className="dashboard-state dashboard-error" role="alert">
                  <span>{loadError}</span>
                  <button type="button" className="dashboard-text-button" onClick={() => void loadCities()}>
                    Try again
                  </button>
                </div>
              ) : cities.length === 0 ? (
                <p className="dashboard-state">Your first city is ready to be built.</p>
              ) : (
                <ul className="dashboard-city-list">
                  {cities.map((city, index) => (
                    <li className="dashboard-city" key={city.id}>
                      <Link className="dashboard-city-link" href={`/city/${city.id}`}>
                        <span className="dashboard-city-number">{String(index + 1).padStart(2, "0")}</span>
                        <div className="dashboard-city-details">
                          <h3>{city.name}</h3>
                          <p>LOCAL AGENT WORKSPACE</p>
                        </div>
                        <span className="dashboard-city-status">OPEN CITY</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="dashboard-feature">
            <div className="dashboard-feature-top">
              <span>PROJECT / {String(cities.length + 1).padStart(2, "0")}</span>
              <span aria-hidden="true" className="dashboard-feature-mark">◈</span>
            </div>
            <div className="dashboard-feature-art" aria-hidden="true">AI</div>
            <p>A private, local workspace for your agents.</p>
            <button type="button" className="dashboard-build-button" onClick={() => setDialogOpen(true)}>
              Build city <span aria-hidden="true">+</span>
            </button>
          </aside>
        </section>

        <footer className="dashboard-footer">
          <div>
            <span>POWERED BY</span>
            <p>Local Ollama models</p>
          </div>
          <div>
            <span>WORKSPACE</span>
            <p>Your private Agent City</p>
          </div>
          <div>
            <span>AVAILABLE AGENTS</span>
            <p>Five local agents</p>
          </div>
        </footer>
      </div>

      {dialogOpen && (
        <div className="dashboard-dialog-backdrop">
          <section className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="build-city-heading">
            <button
              type="button"
              className="dashboard-dialog-close"
              aria-label="Close"
              onClick={() => {
                setDialogOpen(false);
                setCreateError("");
              }}
            >
              ×
            </button>
            <p className="dashboard-kicker">NEW WORKSPACE</p>
            <h2 id="build-city-heading">Build a city</h2>
            <p>Give your local agent workspace a name.</p>
            <form onSubmit={createCity}>
              <label htmlFor="city-name">City name</label>
              <input
                autoFocus
                id="city-name"
                maxLength={60}
                value={cityName}
                onChange={(event) => setCityName(event.target.value)}
                placeholder="e.g. Studio North"
                required
              />
              {createError && <p className="dashboard-error" role="alert">{createError}</p>}
              <button type="submit" className="dashboard-dialog-submit" disabled={creating || !cityName.trim()}>
                {creating ? "Building…" : "Build city"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
