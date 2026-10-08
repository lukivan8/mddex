import { ImageViewer } from "../../components/ImageViewer";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock3, RotateCcw } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { LocationIcon } from "./LocationIcon";
import { ResourceCredit } from "./ResourceCredit";
import { soulStormRoutesResource } from "./resources";
import {
  soulStormRoutes,
  stormRouteIdForRegion,
  type StormRouteId,
} from "./soul-storm-routes";
import { countdown, soulStormSchedule } from "./soul-storm";
import { useLocationImages } from "./useLocationImages";

export function SoulStormRoutesPage({ region }: { region?: StormRouteId }) {
  const [defaultRegion, setDefaultRegion] =
    useState<StormRouteId>("howling-woods");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const initialTime = Date.now();
    const schedule = soulStormSchedule(initialTime);
    setNow(initialTime);
    setDefaultRegion(
      stormRouteIdForRegion(
        schedule.active ? schedule.current.region : schedule.upcoming[0].region,
      )!,
    );
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const schedule = now === null ? null : soulStormSchedule(now);
  const currentRegion = schedule
    ? schedule.active
      ? schedule.current.region
      : schedule.upcoming[0].region
    : null;
  const selectedRegion = region ?? defaultRegion;
  const images = useLocationImages();
  const route = soulStormRoutes.find(
    (candidate) => candidate.id === selectedRegion,
  )!;
  const map = `/resources/soul-storm-routes/${route.id}.png`;
  return (
    <>
      <AppHeader active="resources" />
      <main id="main" className="shell resources-main">
        <Link to="/resources" className="resources-back">
          <ArrowLeft size={14} aria-hidden="true" /> All resources
        </Link>
        <p className="eyebrow">REFERENCES / MINECRAFT DUNGEONS II</p>
        <h1>
          Soul Storm farming routes<span className="accent">.</span>
        </h1>
        <div className="storm-route-quickstart">
          <div>
            <Clock3 size={20} aria-hidden="true" />
            <div>
              <h2>Find the active region</h2>
              {schedule && currentRegion ? (
                <div
                  className="storm-route-current"
                  aria-label="Current storm status"
                >
                  <LocationIcon image={images[currentRegion]} />
                  <div>
                    <strong>{currentRegion}</strong>
                    <span>
                      {schedule.active
                        ? `Active · ends in ${countdown(schedule.remaining)}`
                        : `No storm active · next starts in ${countdown(schedule.remaining)}`}
                    </span>
                  </div>
                </div>
              ) : (
                <p>Checking storm schedule…</p>
              )}
              <p>Storms start every 40 minutes and last 20 minutes.</p>
              <Link to="/resources/soul-storm" className="storm-guide-link">
                Check schedule for each specific location →
              </Link>
            </div>
          </div>
          <div>
            <RotateCcw size={20} aria-hidden="true" />
            <div>
              <h2>Reset after each clear</h2>
              <p>
                Beat all three generators, exit to the main menu, and load back
                into your world. Repeat while the storm is active. Reloading
                does not reset the storm timer.
              </p>
            </div>
          </div>
        </div>
        <nav className="storm-route-regions" aria-label="Choose a storm region">
          {soulStormRoutes.map((candidate) => (
            <Link
              key={candidate.id}
              to="/resources/soul-storm-routes"
              search={{ region: candidate.id }}
              replace
              resetScroll={false}
              className="storm-route-region"
              aria-current={
                candidate.id === selectedRegion ? "page" : undefined
              }
            >
              <LocationIcon image={images[candidate.region]} />
              {candidate.region}
            </Link>
          ))}
        </nav>
        <section
          aria-labelledby="storm-route-heading"
          className="storm-route-detail"
        >
          <div className="storm-route-heading">
            <LocationIcon image={images[route.region]} featured />
            <div>
              <p className="eyebrow">REGION ROUTE</p>
              <h2 id="storm-route-heading">{route.region}</h2>
              <p className="muted">{route.summary}</p>
            </div>
          </div>
          <div className="storm-route-layout">
            <div className="storm-route-instructions">
              <p className="storm-route-start">
                <span className="eyebrow">START AT</span>
                <strong>{route.start}</strong>
              </p>
              <ol>
                {route.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {"warning" in route && (
                <aside className="storm-route-warning">
                  <h3>Bring a bow</h3>
                  <p>{route.warning}</p>
                </aside>
              )}
              {"alternative" in route && (
                <aside className="storm-route-alternative">
                  <h3>Alternative route</h3>
                  <p>{route.alternative}</p>
                </aside>
              )}
            </div>
            <ImageViewer
              key={route.id}
              src={map}
              title={`${route.region} route map`}
              alt={`LordForce’s annotated ${route.region} map with red arrows showing the generator farming route${route.id === "frozen-highlands" ? ", including Highland Cliffs marked 3 and the alternative route marked 4" : ""}.`}
              width={1920}
              height={1080}
            />
          </div>
        </section>
        <ResourceCredit credit={soulStormRoutesResource.credit} />
      </main>
      <AppFooter />
    </>
  );
}
