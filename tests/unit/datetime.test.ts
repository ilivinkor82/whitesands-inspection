import { describe, expect, it } from "vitest";
import { formatDateTimeKST, kstDayRange } from "@/lib/datetime";

describe("formatDateTimeKST", () => {
  it("UTC 시각을 한국 시간(KST, UTC+9)으로 표시한다", () => {
    // 2026-10-12 07:57 UTC = 2026-10-12 16:57 KST
    expect(formatDateTimeKST(new Date("2026-10-12T07:57:00.000Z"))).toBe("2026-10-12 16:57");
  });

  it("UTC 자정 근처에서 날짜가 KST 기준으로 넘어간다", () => {
    // 2026-10-12 23:30 UTC = 2026-10-13 08:30 KST
    expect(formatDateTimeKST(new Date("2026-10-12T23:30:00.000Z"))).toBe("2026-10-13 08:30");
  });
});

describe("kstDayRange", () => {
  it("한국 자정(UTC 15:00 전날)을 하루 시작으로 잡는다", () => {
    // 2026-10-12 16:57 KST 기준 '오늘'은 2026-10-12 00:00 KST ~ 2026-10-13 00:00 KST
    const { start, end } = kstDayRange(new Date("2026-10-12T07:57:00.000Z"));
    expect(start.toISOString()).toBe("2026-10-11T15:00:00.000Z"); // = 2026-10-12 00:00 KST
    expect(end.toISOString()).toBe("2026-10-12T15:00:00.000Z"); // = 2026-10-13 00:00 KST
  });

  it("UTC로는 전날이어도 KST로는 이미 다음날인 시각을 올바른 하루로 묶는다", () => {
    // 2026-10-12 23:30 UTC = 2026-10-13 08:30 KST -> '오늘'은 10/13 KST
    const { start } = kstDayRange(new Date("2026-10-12T23:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-10-12T15:00:00.000Z"); // = 2026-10-13 00:00 KST
  });
});
