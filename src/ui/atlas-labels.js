// Each tag points to a representative location on the equirectangular chart.
// The side is the first choice for the label when neighboring regions leave it free.
export const earthMarkers = {
  coast: [-121, 47, 'NA–W', -1],
  northAmericaEast: [-76, 43, 'NA–E', 1],
  centralAmerica: [-91, 18, 'CAM', -1],
  southAmerica: [-61, -17, 'SAM', 1],
  europeNorth: [15, 62, 'EUR–N', -1],
  europe: [8, 42, 'EUR–S', -1],
  europeEast: [46, 57, 'EUR–E', 1],
  africa: [3, 26, 'AFR–N', -1],
  africaSouth: [26, -19, 'AFR–S', -1],
  middleEast: [46, 30, 'ME', 1],
  asiaNorth: [104, 43, 'AS–N', -1],
  asiaSouth: [78, 21, 'AS–S', -1],
  asia: [137, 37, 'AS–E', 1],
  australia: [134, -25, 'AUS', -1],
  antarctic: [24, -72, 'ANT', -1],
  atlantic: [-35, 6, 'ATL', -1],
  pacific: [-141, -9, 'PAC', -1],
  indianOcean: [78, -31, 'IND', 1],
  marianaTrench: [142.5, 11.3, 'MAR', -1],
};

const directions = Array.from({length: 16}, (_, step) => {
  const angle = step * Math.PI / 8;
  return [Math.cos(angle), Math.sin(angle)];
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function intersects(rect, other, gap = 2) {
  return rect.left < other.right + gap && rect.right > other.left - gap &&
    rect.top < other.bottom + gap && rect.bottom > other.top - gap;
}

// Prefer a short leader on the chosen side. Other labels and geographic markers
// get precedence, so dense areas such as Europe stay individually clickable.
export function positionAtlasLabels(chart, pins) {
  const width = chart.clientWidth;
  const height = chart.clientHeight;
  if (!width || !height) return;
  const globe = chart.parentElement;
  const mapWidth = globe.clientWidth;
  const mapHeight = globe.clientHeight;
  const dimensions = [width, height, mapWidth].join('/');
  if (chart.dataset.dimensions !== dimensions) {
    chart.dataset.dimensions = dimensions;
    chart.toggleAttribute('data-compact', mapWidth < 430);
  }
  const picker = chart.querySelector('.atlas-picker');
  const occupied = picker.offsetWidth ? [{
    left: picker.offsetLeft, right: picker.offsetLeft + picker.offsetWidth,
    top: picker.offsetTop, bottom: picker.offsetTop + picker.offsetHeight,
  }] : [];
  const nodes = pins.map(({button, leader, dot}) => {
    const [lon, lat, , side] = earthMarkers[button.dataset.id];
    const x = (width - mapWidth) / 2 + mapWidth * (lon + 180) / 360;
    const y = mapHeight * (90 - lat) / 180;
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    leader.setAttribute('x1', x);
    leader.setAttribute('y1', y);
    return { button, leader, x, y, side, w: button.offsetWidth, h: button.offsetHeight };
  });
  const lines = [];
  const anchors = nodes.map(({x, y}) => ({left:x - 3, right:x + 3, top:y - 3, bottom:y + 3}));
  for (const {button, leader, x, y, side, w, h} of nodes) {
    let best;
    let minScore = Infinity;
    for (const radius of [7, 14, 24, 38, 56, 80, 110]) {
      for (const [cos, sin] of directions) {
        const dx = side * cos;
        const left = clamp(Math.round(x + dx * (radius + w / 2) - w / 2), 1, width - w - 1);
        const top = clamp(Math.round(y + sin * (radius + h / 2) - h / 2), 1, height - h - 1);
        const box = {left, top, right: left + w, bottom: top + h};
        const endX = clamp(x, box.left, box.right);
        const endY = clamp(y, box.top, box.bottom);
        const line = { left: Math.min(x, endX), right: Math.max(x, endX), top: Math.min(y, endY), bottom: Math.max(y, endY) };
        const distance = Math.hypot(x - endX, y - endY);
        let score = distance + (1 - cos) * 3 + Math.abs(sin) * 2;
        if (occupied.some(other => intersects(box, other))) score += 10000;
        if (anchors.some(anchor => intersects(box, anchor))) score += 1000;
        if (lines.some(other => intersects(box, other, 1)) || occupied.some(other => intersects(line, other, 1))) score += 120;
        if (score < minScore) {
          minScore = score;
          best = {box, endX, endY, line};
        }
      }
    }
    if (minScore >= 10000 && !chart.hasAttribute('data-compact')) {
      chart.setAttribute('data-compact', '');
      positionAtlasLabels(chart, pins);
      return;
    }
    occupied.push(best.box);
    lines.push(best.line);
    button.style.left = best.box.left + 'px';
    button.style.top = best.box.top + 'px';
    leader.setAttribute('x2', best.endX);
    leader.setAttribute('y2', best.endY);
  }
}
