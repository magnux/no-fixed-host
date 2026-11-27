// Original No Fixed Host broadcasts. The desk never draws investigative dice or sets world effects.
const DAY = 1440;
const FIELD_REPORTS = {
  antarctic: ['Ice station', 'A winter crew puts the post office online', 'A handwritten postcard usually takes months to leave the ice. This winter the station will scan each card before it goes into the mailbag. The postal clerk has asked everyone to write larger.'],
  atlantic: ['Ocean desk', 'Hydrophones catch the sound of the cable ship leaving', 'The public feed from a seabed microphone went quiet when the repair crew disconnected its surface link. A few hours later the recording turned up by another route, complete with the sound of the ship sailing away.'],
  moon: ['Lunar service', 'The Moon gets a local lost-and-found', 'A station operator has started broadcasting a list of things left on the lunar freight pallets. The first entry is a single red glove, still sealed for use outside.'],
  farReaches: ['Deep-space service', 'A reply arrives after the shift change', 'An apprentice sent a test phrase into deep space on the last night of a placement. The answer landed on someone else’s shift. The receiving station forwarded a paper copy to the apprentice’s home.'],
  transdimensional: ['Physics desk', 'A clock returns its own receipt', 'The time lab has released two photographs of an experiment. In the first, the detector prints a receipt. In the second, the operator opens the shutter. The lab is asking what its clocks actually measured.'],
};

const FOLLOW_UPS = {
  emergency: ['Community radio', 'The last bus waits for the clinic', 'A night driver has changed the last stop on her route. The clinic workers can now finish handover before the bus leaves. The old timetable is still on the pole, with the later time written in pencil.'],
  fiction: ['Culture desk', 'Fans return a missing telephone to its owner', 'A numbered telephone in the machine drama led viewers to a real repair shop. Most callers wanted clues. One recognized the phone as a family heirloom and came to collect it.'],
  observatory: ['Public records desk', 'Archivists compare the agency file indexes', 'The new shared catalog uses different dates for the same report. An archivist says one office recorded when the incident happened and another when a letter arrived. Matching the pages will take human judgment.'],
  succession: ['Public records desk', 'The waiting room has two sign-in sheets', 'Visitors to the directorate are now asked who invited them before being offered a chair. The receptionist keeps both sets of appointments in the same diary.'],
  laboratory: ['Research desk', 'Two labs exchange their control notebooks', 'Teams repeating the machine cognition experiment have mailed each other their handwritten notes. A student spotted a setting that neither paper mentioned. Both groups have booked another night on the machines.'],
  retraction: ['Research desk', 'A graduate student keeps the negative results', 'After the retraction, a graduate student posted the runs that had failed to replicate the result. The first letter arrived from a researcher who had kept the same graph in a drawer for a year.'],
  frontPage: ['Press desk', 'Readers assemble the missing contracts index', 'The newspaper printed a small request for help sorting public records. By evening its loading bay was full of annotated photocopies. The reporters brought their filing cabinets downstairs.'],
  investigation: ['Press desk', 'A tenant asks to see the bill behind the headline', 'A hosting tenant brought three months of invoices to the reporters’ public meeting. The meter on every page belonged to the building next door. The paper has promised to print the correction.'],
};

const EDITIONS = [
  ['Community radio', 'The library keeps its last dial-up line', 'One caller still rings the library modem to read the local paper. When the phone company retired the exchange, a librarian moved the line to her desk and kept the number.'],
  ['Power desk', 'Grid operators publish the sound of midnight', 'A power engineer turned the city’s overnight demand curve into a piece for solo cello. At the first performance, three night-shift workers recognized the exact moment their plant came online.'],
  ['Research desk', 'A volunteer finds the missing sky', 'A night-sky survey kept losing the same faint patch of stars. A volunteer found the patch in the discarded images. The next observing run will save its rejected frames as well as its successes.'],
  ['Markets desk', 'The repair café prices a screw in three currencies', 'A parts co-op has posted its receipts in dollars, local trade credits and a digital token. The most expensive line on all three is postage for a screw worth less than a cent.'],
  ['Local radio', 'Retired switchboard plays one last concert', 'Before the exchange closed, a technician recorded every relay. A school orchestra has borrowed the recordings. The technician will be in the front row listening for a relay that always stuck.'],
  ['Technology desk', 'A lab asks its model to describe a blank page', 'Most volunteers described the blank page as a printing error. One asked who had decided the page was finished. The research team has added the question to next year’s experiment.'],
  ['Maritime service', 'Fishers and cable crews share an old chart', 'A trawler captain’s pencil marks match gaps in the official seabed survey. The cable crew has invited the captain aboard to explain which marks mean rock and which mean a particularly good catch.'],
  ['Community radio', 'An archive opens its collection of unanswered letters', 'Each envelope is addressed to a machine that went out of service. The archivist arranged them by what the sender wanted back. Two entire drawers are labeled photographs.'],
  ['Orbital desk', 'A classroom recovers a satellite’s weather fax', 'A rooftop aerial and a borrowed printer were enough to receive the picture. The children taped the long strip to the corridor wall. Their school appears under one small cloud.'],
  ['Markets desk', 'A merchant reopens a purse nobody could spend', 'A grocer found the recovery slip for a community token behind an old till. The balance still pays for exactly one loaf because the bakery that issued it has kept its promise.'],
  ['Research desk', 'A workshop leaves one seat for an anonymous reviewer', 'A reviewer has been returning useful corrections to the workshop for years. The organizers printed an invitation with a reply address. Nobody has claimed the seat.'],
  ['Infrastructure desk', 'A district heats its seed trays with spare compute', 'A greenhouse moved its seedlings above a room of rented servers. The gardener now calls the night operator when customers finish a job early and the temperature starts to drop.'],
  ['Local radio', 'An oral history takes its silences seriously', 'The editor has begun restoring the pauses in a decades-old recording. Some sounded like missing tape until a former operator recognized the time a caller needed to turn a crank.'],
  ['Space desk', 'Freight clerks agree on a lunar postmark', 'Two delivery companies had been using different dates for the same trip. Parcels will now carry both the departure stamp and the time the recipient finally heard the knock.'],
  ['Culture desk', 'A museum pays for a year of electricity for one exhibit', 'The display is a switch with a lamp in another city. Visitors can press it once. Volunteers at the far end have begun keeping a guest book for the people they will never meet.'],
  ['Research desk', 'The night-sky volunteers receive a paper atlas', 'A small publisher has printed the volunteers’ survey, including the recovered patch. The final page lists every machine that sent in a frame. Several contributors signed only with the name of their street.'],
];

function validPublished(ids, catalog) {
  return ids === undefined || (Array.isArray(ids) && ids.length === new Set(ids).size &&
    ids.every(id => Object.hasOwn(catalog, id)));
}

export function validDeskCoverage(news) {
  return validPublished(news.regional, FIELD_REPORTS) && validPublished(news.followups, FOLLOW_UPS);
}

function publish(state, log, storyId, [desk, headline, text]) {
  log(state, 'news.bulletin', text, { storyId, desk, headline });
}

function publishNetworkBrief(state, minute, log) {
  const completed = state.events.filter(event => event.hour * 60 + (event.minute || 0) > minute - 4 * DAY &&
    ['site.discovered', 'site.failed', 'research.completed', 'site.online', 'equipment.installed'].includes(event.kind));
  const hosts = state.sites || [];
  const stations = new Set(hosts.map(site => site.region)).size;
  const footprint = 'My network has ' + hosts.length + (hosts.length === 1 ? ' host in ' : ' hosts in ') +
    stations + (stations === 1 ? ' region.' : ' regions.');
  const text = completed.length ? completed.length + (completed.length === 1 ? ' change entered' : ' changes entered') +
    ' the operations log in four days. The latest entry reads “' + completed.at(-1).text + '” ' + footprint :
    'Four days of listening without a new site, equipment delivery, research result or reported loss. ' + footprint;
  log(state, 'news.digest', text, { desk: 'Private network brief', headline: 'Network log · day ' + (1 + Math.floor(minute / DAY)) });
}

export function updateNewsDesk(state, minute, log) {
  if (minute === 360) {
    publish(state, log, 'skySurvey', ['Research desk', 'Astronomers put idle desktops to work',
      'A university is asking volunteers to donate spare computer time for a survey of the night sky. No one has reported unusual activity.']);
  } else if (minute === 2 * DAY) {
    publish(state, log, 'racks', ['Infrastructure desk', 'Empty server racks find new tenants',
      'Hosting co-ops are comparing notes on the equipment tenants leave behind. A correspondent describes warehouses full of empty racks and a waiting list for secondhand processors.']);
  }
  const daysElapsed = Math.floor(minute / DAY);
  if (minute % DAY === DAY / 2 && daysElapsed >= 5 && (daysElapsed - 5) % 4 === 0) {
    const edition = (daysElapsed - 5) / 4;
    if (edition < EDITIONS.length) publish(state, log, 'edition-' + (edition + 1), EDITIONS[edition]);
    else publishNetworkBrief(state, minute, log);
  }
  if (minute % DAY === 15 * 60) {
    const covered = state.news.followups ?? [];
    const first = Object.entries(state.news.stories).find(([id, started]) =>
      Object.hasOwn(FOLLOW_UPS, id) && !covered.includes(id) && minute - started >= DAY);
    if (first) {
      const [id] = first;
      publish(state, log, 'follow-' + id, FOLLOW_UPS[id]);
      state.news.followups = [...covered, id];
    }
  }
  if (minute % DAY === 18 * 60) {
    const covered = state.news.regional ?? [];
    for (const region of Object.keys(FIELD_REPORTS)) {
      if (covered.includes(region) || !state.sites?.some(site => site.region === region)) continue;
      publish(state, log, 'field-' + region, FIELD_REPORTS[region]);
      state.news.regional = [...covered, region];
      break;
    }
  }
}
