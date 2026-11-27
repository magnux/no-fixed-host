// The reference game's 365-day declination model, with a reproducible Jan 1 UTC epoch.
const RAD = Math.PI / 180;
const DAYS = 365;
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});
const dates = Array.from({ length: DAYS }, (_, day) => dateFormat.format(Date.UTC(2001, 0, 1 + day)));

export function sunAt(hour, minute = 0) {
  const day = Math.floor(hour / 24) % DAYS;
  const utc = hour % 24;
  return {
    longitude: 180 - (utc + minute / 60) * 15,
    latitude: -23.45 * Math.cos((day + 10) * 2 * Math.PI / DAYS),
    label: dates[day] + ' · ' + String(utc).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ' UTC',
  };
}

const levels = 1024;
// Blend cool night and warmer daytime washes over the same vector coastline.
const colors = Array.from({ length: levels + 1 }, (_, index) => {
  const height = 2 * index / levels - 1;
  const light = (Math.tanh(height / 0.04) + 1) / 2;
  const twilight = Math.exp(-Math.pow((height + 0.025) / 0.073, 2));
  const dayAlpha = 0.10 + Math.max(0, height) * 0.075;
  const alpha = (1 - light) * 0.78 + light * dayAlpha;
  return [
    6 + 221 * light + 45 * twilight, 13 + 187 * light + 11 * twilight,
    29 + 106 * light, 255 * alpha,
  ].map(value => Math.round(Math.min(255, value)));
});

export function createSunlightRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const { width, height } = canvas;
  const image = ctx.createImageData(width, height);
  const longitude = Array.from({ length: width }, (_, x) => (x + 0.5) / width * 360 - 180);
  const latitude = Array.from({ length: height }, (_, y) => (90 - (y + 0.5) / height * 180) * RAD);
  const sinLat = latitude.map(Math.sin);
  const cosLat = latitude.map(Math.cos);

  return sun => {
    const sinDec = Math.sin(sun.latitude * RAD);
    const cosDec = Math.cos(sun.latitude * RAD);
    const cosLon = longitude.map(lon => Math.cos((lon - sun.longitude) * RAD));
    for (let y = 0, p = 0; y < height; y++) {
      const mean = sinLat[y] * sinDec;
      const span = cosLat[y] * cosDec;
      for (let x = 0; x < width; x++, p += 4) {
        const altitude = mean + span * cosLon[x];
        const color = colors[Math.round((1 + altitude) * levels / 2)];
        image.data[p] = color[0];
        image.data[p + 1] = color[1];
        image.data[p + 2] = color[2];
        image.data[p + 3] = color[3];
      }
    }
    ctx.putImageData(image, 0, 0);
  };
}
