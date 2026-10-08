import { describe, expect, it } from "vitest";
import {
  countdown,
  soulStormSchedule,
  STORM_DURATION,
  STORM_EPOCH,
  STORM_INTERVAL,
  STORM_REGIONS,
} from "./soul-storm";

describe("Soul Storm schedule", () => {
  it("starts the first storm at the UTC epoch", () => {
    const schedule = soulStormSchedule(STORM_EPOCH);
    expect(schedule.active).toBe(true);
    expect(schedule.current.region).toBe("Howling Woods");
    expect(schedule.remaining).toBe(STORM_DURATION);
    expect(schedule.upcoming[0].region).toBe("Singer's Meadow");
  });
  it("ends exactly at 20 minutes and waits until 40 minutes", () => {
    expect(soulStormSchedule(STORM_EPOCH + STORM_DURATION - 1).active).toBe(
      true,
    );
    const gap = soulStormSchedule(STORM_EPOCH + STORM_DURATION);
    expect(gap.active).toBe(false);
    expect(gap.remaining).toBe(STORM_DURATION);
    const next = soulStormSchedule(STORM_EPOCH + STORM_INTERVAL);
    expect(next.active).toBe(true);
    expect(next.current.region).toBe("Singer's Meadow");
  });
  it("wraps the seven-region rotation and upcoming timestamps", () => {
    const schedule = soulStormSchedule(STORM_EPOCH + STORM_INTERVAL * 6);
    expect(schedule.current.region).toBe("Honeycomb Fields");
    expect(schedule.upcoming.map((storm) => storm.region)).toEqual(
      STORM_REGIONS,
    );
    expect(schedule.upcoming[6].start - schedule.current.start).toBe(
      STORM_INTERVAL * 7,
    );
    expect(
      schedule.upcoming.every(
        (storm) => storm.end - storm.start === STORM_DURATION,
      ),
    ).toBe(true);
  });
  it("handles clocks before the epoch without undefined regions", () => {
    const schedule = soulStormSchedule(STORM_EPOCH - 1);
    expect(schedule.active).toBe(false);
    expect(schedule.current.region).toBe("Honeycomb Fields");
    expect(schedule.upcoming[0].start).toBe(STORM_EPOCH);
  });
  it("rounds countdowns up and clamps expired times", () => {
    expect(countdown(1)).toBe("00:01");
    expect(countdown(60001)).toBe("01:01");
    expect(countdown(-1)).toBe("00:00");
  });
});
