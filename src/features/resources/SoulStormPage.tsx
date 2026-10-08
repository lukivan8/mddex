import { ResourceCredit } from "./ResourceCredit";
import { soulStormResource } from "./resources";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CloudLightning, Clock3, ArrowLeft } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { LocationIcon } from "./LocationIcon";
import { useLocationImages } from "./useLocationImages";
import { stormRouteIdForRegion } from "./soul-storm-routes";
import { countdown, soulStormSchedule, STORM_REGIONS } from "./soul-storm";

export function SoulStormPage() {
  // Render the same placeholder on the server and first client render.
  const [now, setNow] = useState<number | null>(null);
  const [twelveHourClock, setTwelveHourClock] = useState(false);
  const locationImages = useLocationImages();
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const schedule = now === null ? null : soulStormSchedule(now);
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: twelveHourClock ? "h12" : "h23",
  });
  const zone = timeFormat.resolvedOptions().timeZone;
  return (
    <>
      <AppHeader active="resources" />
      <main id="main" className="shell resources-main">
        <Link to="/resources" className="resources-back">
          <ArrowLeft size={14} aria-hidden="true" /> All resources
        </Link>
        <p className="eyebrow">TOOLS / MINECRAFT DUNGEONS II</p>
        <h1>
          Soul Storm forecast<span className="accent">.</span>
        </h1>
        <section
          className={`storm-status ${schedule?.active ? "storm-active" : ""}`}
          aria-label="Current storm status"
        >
          <div>
            <p className="eyebrow">
              <CloudLightning size={18} aria-hidden="true" />{" "}
              {schedule
                ? schedule.active
                  ? "STORM ACTIVE"
                  : "BETWEEN STORMS"
                : "CHECKING THE CLOCK"}
            </p>
            <div className="storm-featured-location">
              {schedule && (
                <LocationIcon
                  image={
                    locationImages[
                      schedule.active
                        ? schedule.current.region
                        : schedule.upcoming[0].region
                    ]
                  }
                  featured
                />
              )}
              <h2>
                {schedule
                  ? schedule.active
                    ? schedule.current.region
                    : "The next storm is forming"
                  : "Loading schedule…"}
              </h2>
            </div>
            <p className="muted">
              {schedule
                ? schedule.active
                  ? `Next up: ${schedule.upcoming[0].region}`
                  : `Next storm: ${schedule.upcoming[0].region}`
                : "Times will appear when this page loads."}
            </p>
          </div>
          <div className="storm-countdown">
            <span className="eyebrow">
              {schedule?.active ? "ENDS IN" : "STARTS IN"}
            </span>
            <strong
              role="timer"
              aria-label={
                schedule?.active
                  ? "Time until storm ends"
                  : "Time until next storm"
              }
            >
              {schedule ? countdown(schedule.remaining) : "--:--"}
            </strong>
            <span className="muted">20 min active / 40 min cycle</span>
          </div>
        </section>
        <section aria-labelledby="upcoming-heading">
          <div className="resources-section-heading">
            <h2 id="upcoming-heading">
              <Clock3 size={18} aria-hidden="true" /> Upcoming storms
            </h2>
            <label className="storm-clock-toggle">
              <input
                type="checkbox"
                checked={twelveHourClock}
                onChange={(event) => setTwelveHourClock(event.target.checked)}
              />
              Show 12-hour clock
            </label>
          </div>
          <p className="muted">
            {now === null
              ? "Loading your time zone…"
              : `Times in ${zone}. Each region returns every 4 hours 40 minutes.`}
          </p>
          <div className="storm-table-wrap">
            <table className="storm-table">
              <thead>
                <tr>
                  <th scope="col">Region</th>
                  <th scope="col">Starts</th>
                  <th scope="col">Ends</th>
                </tr>
              </thead>
              <tbody>
                {schedule?.upcoming.map((storm, index) => (
                  <tr key={storm.index}>
                    <th scope="row">
                      <span className="storm-order">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="storm-region">
                        <LocationIcon image={locationImages[storm.region]} />
                        {storm.region}
                        {index === 0 && (
                          <span className="storm-next">NEXT</span>
                        )}
                      </span>
                    </th>
                    <td>
                      <time dateTime={new Date(storm.start).toISOString()}>
                        {timeFormat.format(storm.start)}
                      </time>
                    </td>
                    <td>
                      <time dateTime={new Date(storm.end).toISOString()}>
                        {timeFormat.format(storm.end)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="storm-notes" aria-labelledby="farming-heading">
          <h2 id="farming-heading">Farm the active storm faster</h2>
          <p>
            After clearing a Soul Storm, leave and rejoin your world. The storm
            respawns in whichever region is currently active, letting you clear
            it again without waiting for the next storm.
          </p>
          <p>
            Check the active region and countdown above before each run. You can
            repeat this while the storm is active; rejoining does not reset its
            timer.
          </p>
          <Link
            to="/resources/soul-storm-routes"
            search={{
              region: schedule
                ? stormRouteIdForRegion(
                    schedule.active
                      ? schedule.current.region
                      : schedule.upcoming[0].region,
                  )
                : undefined,
            }}
            className="storm-guide-link"
          >
            Explore farming routes and maps →
          </Link>
        </section>
        <section className="storm-notes" aria-labelledby="schedule-heading">
          <h2 id="schedule-heading">How the forecast works</h2>
          <p>
            The rotation starts at 00:00 UTC on January 1, 2026. A storm begins
            every 40 minutes and runs for 20 minutes. After{" "}
            {STORM_REGIONS.at(-1)}, the rotation returns to {STORM_REGIONS[0]}.
          </p>
          <p>
            Storms unlock after completing The Final Souldown. Forecasts use
            your device’s clock and the published schedule; server changes can
            make them inaccurate.
          </p>
        </section>
        <ResourceCredit credit={soulStormResource.credit} />
      </main>
      <AppFooter />
    </>
  );
}
