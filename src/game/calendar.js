// Campaign storage measures elapsed simulation time. UTC is the common clock for every host.
export const MINUTES_PER_DAY = 1440;
export const CAMPAIGN_EPOCH = Date.UTC(2026, 11, 12, 4, 20);
const openingMinute = (CAMPAIGN_EPOCH / 60_000) % MINUTES_PER_DAY;

export function utcMinuteOfDay(elapsed) {
  return (openingMinute + elapsed) % MINUTES_PER_DAY;
}

export function campaignDay(elapsed) {
  return Math.floor((openingMinute + elapsed) / MINUTES_PER_DAY) + 1;
}

export function minutesToMidnight(elapsed) {
  return MINUTES_PER_DAY - utcMinuteOfDay(elapsed);
}

export function campaignDate(elapsed) {
  return new Date(CAMPAIGN_EPOCH + elapsed * 60_000);
}

const dateFormats = new Map();

export function dateLabel(elapsed, language = 'en') {
  if (!dateFormats.has(language)) {
    dateFormats.set(language, new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language,
      { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }));
  }
  return dateFormats.get(language).format(campaignDate(elapsed));
}

export function timeLabel(elapsed) {
  const minute = utcMinuteOfDay(elapsed);
  return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
}

export function campaignStamp(elapsed, language = 'en') {
  return dateLabel(elapsed, language) + ' · ' + timeLabel(elapsed) + ' UTC';
}
