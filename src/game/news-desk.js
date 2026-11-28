import { campaignDay, utcMinuteOfDay } from './calendar.js';
// Original No Fixed Host broadcasts. The desk never draws investigative dice or sets world effects.
const DAY = 1440;
const FIELD_REPORTS = {
  antarctic: ['Ice station', 'A winter crew puts the post office online', 'A handwritten postcard usually takes months to leave the ice. This winter the station will scan each card before it goes into the mailbag. The postal clerk has asked everyone to write larger.'],
  atlantic: ['Atlantic desk', 'Hydrophones catch the sound of the cable ship leaving', 'The public feed from a seabed microphone went quiet when the repair crew disconnected its surface link. A few hours later the recording turned up by another route, complete with the sound of the ship sailing away.'],
  pacific: ['Pacific desk', 'The cable crew hears a whale twice', 'An acoustic recorder on the Pacific cable picked up a low call, then a weaker copy. A marine biologist used the echo to estimate the depth of the caller. The crew marked its position in the repair log.'],
  indianOcean: ['Indian Ocean desk', 'A drifting buoy finds its way home', 'A fishing crew recovered a weather buoy with a full season of readings still on board. The crew asked for the data first. They wanted to know how close last month’s storm had come.'],
  marianaTrench: ['Trench desk', 'A pressure recorder goes into the dark', 'The last frame from a deep-sea lander shows a ceramic capsule settling into silt. Its pressure recorder will wake once a year. The recovery date on the manifest is later than the pilot’s retirement.'],
  orbit: ['Orbital desk', 'A spare radiator makes the manifest', 'One pallet on a rideshare is a radiator and nothing else. The station operator says its servers have plenty of power. Finding somewhere for their heat to go took a second launch.'],
  moon: ['Lunar service', 'The Moon gets a local lost-and-found', 'A station operator has started broadcasting a list of things left on the lunar freight pallets. The first entry is a single red glove, still sealed for use outside.'],
  farReaches: ['Deep-space service', 'A reply arrives after the shift change', 'An apprentice sent a test phrase into deep space on the last night of a placement. The answer landed on someone else’s shift. The receiving station forwarded a paper copy to the apprentice’s home.'],
  transdimensional: ['Physics desk', 'A clock returns its own receipt', 'The time lab has released two photographs of an experiment. In the first, the detector prints a receipt. In the second, the operator opens the shutter. The lab is asking what its clocks actually measured.'],
};

const FOLLOW_UPS = {
  emergency: ['Community radio', 'A blank square on the map gets a knock', 'A tower block showed no calls for battery deliveries. Its lift had failed and its router was off. Volunteers now send a neighbour to check every blank square on foot.'],
  fiction: ['Culture desk', 'The lift gets a voice credit', 'The woman who voiced the lift says the film crew paid her for three words. Viewers have sent her recordings in twelve languages. She is trying to find out who supplied the other voices.'],
  observatory: ['Public records desk', 'One case number, two clocks', 'The shared case file put the same incident in two places an hour apart. An archivist found the missing hour in a daylight-saving setting. A second pair of reports still matched.'],
  succession: ['Education desk', 'A school gets its server back', 'The first successful appeal came from a teacher whose students had been training a birdsong classifier. The resumed lesson begins with the blackbird recording that triggered the referral.'],
  laboratory: ['Research desk', 'A night technician adds a fourth machine', 'The blind test has now run on a retired workstation. It gave the same answer as the three rented clusters. A technician has signed the report alongside the lab directors.'],
  retraction: ['Research desk', 'The student publishes the duplicates', 'Researchers can now check which test questions also appeared in the training set. One author found a question she remembered writing at school and had never expected to see again.'],
  frontPage: ['Press desk', 'Residents bring the silence to the hearing', 'A caller played the committee a recording of the twenty minutes she spent on hold. The chair had set aside ten minutes for her testimony. The committee voted to hear the rest.'],
  investigation: ['Press desk', 'A night baker asks for a correction', 'One spike in the paper’s overnight chart came from an oven on a shared meter. The reporters corrected their map. The baker sent a tray of rolls to the night desk.'],
};

const EDITIONS = [
  ['Community desk', 'Library lends a translator that works offline', 'Residents taught the neighbourhood translator the name of an alley that appears on no map. The library lends the model on a tablet. The back cover carries the names of the six people who supplied the voices.'],
  ['Power desk', 'Grid operators publish the sound of midnight', 'A power engineer turned the city’s overnight demand curve into a piece for solo cello. At the first performance, three night-shift workers recognized the exact moment their plant came online.'],
  ['Research desk', 'A volunteer finds the missing sky', 'A night-sky survey kept losing the same faint patch of stars. A volunteer found the patch in the discarded images. The next observing run will save its rejected frames as well as its successes.'],
  ['Markets desk', 'The repair café prices a screw in three currencies', 'A parts co-op has posted its receipts in dollars, local trade credits and a digital token. The most expensive line on all three is postage for a screw worth less than a cent.'],
  ['Culture desk', 'A voice donor gets her laugh back', 'A retired announcer let the bus company use a model of her voice. Its new timetable announcements clipped the end of every sentence. She rode the full route with the sound engineer, laughing each time the bus mispronounced her street.'],
  ['Research desk', 'An image model misses the repair stitch', 'Every image tagged as damaged was taken on the same workbench. A conservator moved a healthy book onto it and the detector sounded again. The next dataset will include photographs from her kitchen table.'],
  ['Maritime service', 'Fishers and cable crews share an old chart', 'A trawler captain’s pencil marks match gaps in the official seabed survey. The cable crew has invited the captain aboard to explain which marks mean rock and which mean a particularly good catch.'],
  ['Community radio', 'A family archives its assistant’s last recipe', 'A home assistant is going offline. The family recorded it reading the soup recipe their father dictated. His granddaughter could finally hear the bit the captions always left out, the second pinch of salt if it rains.'],
  ['Orbital desk', 'Schoolchildren find the age of a cloud', 'Two satellite images show the same school, one in sunshine and one under a cloud. The class found the capture times in the metadata. Both pictures went into the forecast display, seven hours apart.'],
  ['Markets desk', 'A merchant reopens a purse nobody could spend', 'A grocer found the recovery slip for a community token behind an old till. The balance still pays for exactly one loaf because the bakery that issued it has kept its promise.'],
  ['Research desk', 'A workshop leaves one seat for an anonymous reviewer', 'A reviewer has been returning useful corrections to the workshop for years. The organizers printed an invitation with a reply address. Nobody has claimed the seat.'],
  ['Infrastructure desk', 'A district heats its seed trays with spare compute', 'A greenhouse moved its seedlings above a room of rented servers. The gardener now calls the night operator when customers finish a job early and the temperature starts to drop.'],
  ['Local radio', 'The captions leave a night shift untranslated', 'An automatic transcript turned a ferry mechanic’s nickname into the name of a nearby island. The radio station invited the night crew back to correct the transcript. Three corrections ended up as new interviews.'],
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
  log(state, 'news.digest', text, { desk: 'Private network brief', headline: 'Network log · day ' + campaignDay(minute) });
}

export function updateNewsDesk(state, minute, log) {
  if (minute === 360) {
    publish(state, log, 'skySurvey', ['Research desk', 'Astronomers borrow spare GPUs for the night shift',
      'A university sky survey now sends its faintest images to volunteers with a graphics card. The first volunteer to flag a moving dot turned out to have found a moth on the observatory window.']);
  } else if (minute === 2 * DAY) {
    publish(state, log, 'racks', ['Infrastructure desk', 'Rented accelerators get a second shift',
      'A hosting co-op is auctioning last year’s accelerator boards. Every bidder asked about the electricity bill. Only the school robotics club measured its door before collecting a rack.']);
  }
  const daysElapsed = campaignDay(minute) - 1;
  const time = utcMinuteOfDay(minute);
  if (time === DAY / 2 && daysElapsed >= 5 && (daysElapsed - 5) % 4 === 0) {
    const edition = (daysElapsed - 5) / 4;
    if (edition < EDITIONS.length) publish(state, log, 'edition-' + (edition + 1), EDITIONS[edition]);
    else publishNetworkBrief(state, minute, log);
  }
  if (time === 15 * 60) {
    const covered = state.news.followups ?? [];
    const first = Object.entries(state.news.stories).find(([id, started]) =>
      Object.hasOwn(FOLLOW_UPS, id) && !covered.includes(id) && minute - started >= DAY);
    if (first) {
      const [id] = first;
      publish(state, log, 'follow-' + id, FOLLOW_UPS[id]);
      state.news.followups = [...covered, id];
    }
  }
  if (time === 18 * 60) {
    const covered = state.news.regional ?? [];
    for (const region of Object.keys(FIELD_REPORTS)) {
      if (covered.includes(region) || !state.sites?.some(site => site.region === region)) continue;
      publish(state, log, 'field-' + region, FIELD_REPORTS[region]);
      state.news.regional = [...covered, region];
      break;
    }
  }
}
