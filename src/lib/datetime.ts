const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** 업로드/스캔 시각 표시용 — 서버가 UTC로 돌아도 화면엔 한국 시간(KST)으로 보여준다. */
export function formatDateTimeKST(date: Date): string {
  const p = kstParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/**
 * 기준 시각이 속한 "한국 달력 기준 오늘"의 시작~끝을 UTC Date로 반환한다.
 * 서버(UTC)의 자정이 아니라 한국의 자정을 하루 경계로 써야 "오늘 검수" 집계가
 * 한국 시간과 어긋나지 않는다.
 */
export function kstDayRange(reference: Date = new Date()): { start: Date; end: Date } {
  const p = kstParts(reference);
  const start = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) - KST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
