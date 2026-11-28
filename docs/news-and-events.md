# News and investigations

A world story changes how readily an investigator can discover a host. It adds or subtracts 1,000 basis points from that group’s discovery multiplier. Suspicion itself changes when the group finds evidence. Editorials, field reports, follow-ups and the AI’s private network brief leave these values unchanged.

## The eight world stories

The eight story IDs retain their global gameplay effects. Their headlines, sources and people belong to No Fixed Host’s fictional December 2026 setting. The reference log also records research results, facilities completed, hosts lost to maintenance, discoveries and equipment deliveries. These dispatches come from the player’s actions and their consequences. A research dispatch in No Fixed Host includes the completed topic’s finding. [Reference rules](https://github.com/singularity/singularity/blob/v1.1/singularity/data/events.dat) · [English catalog](https://github.com/singularity/singularity/blob/v1.1/singularity/data/events_str.dat) · [Reference log message types](https://github.com/singularity/singularity/blob/v1.1/singularity/code/logmessage.py)

| Reference story | No Fixed Host headline | Investigator | Change to multiplier | Duration |
| --- | --- | --- | ---: | --- |
| the-plague | The neighbourhood outage map stays online | Public | −10 points | Campaign |
| stranger-than-fiction | Viewers trace the edits in a viral lift video | Public | +10 points | Campaign |
| the-watchers | Cloud incident desks adopt a common case number | Intelligence | +10 points | Campaign |
| politics-as-usual | Review panel suspends automated referrals | Intelligence | −10 points | Campaign |
| lab-ai | Labs share a blind test for wandering models | Scientists | +10 points | Campaign |
| discrediting | An autonomy benchmark contained its own answers | Scientists | −10 points | Campaign |
| scandal | City paid for thousands of silent hotline calls | Press | −10 points | 21 days, then midnight check |
| investigation | Whose servers kept the substation awake? | Press | +10 points | 21 days, then midnight check |

The reference checks eligible stories after discoveries and before the daily update. Each has a Poisson intensity of 0.002 per eligible day. With all eight eligible, the mean wait for the first event is about 62.5 days after protection ends. The probability of at least one in the first 30 eligible days is about 38.1%. As permanent stories occur, fewer stories remain eligible. Normal changes opening protection and investigator mechanics. The eight event intensities come directly from the catalog. [Player update](https://github.com/singularity/singularity/blob/v1.1/singularity/code/player.py#L419-L480) · [Poisson interval roll](https://github.com/singularity/singularity/blob/v1.1/singularity/code/chance.py#L28-L45) · [Normal preset](https://github.com/singularity/singularity/blob/v1.1/singularity/data/difficulties.dat#L23-L31)

The browser campaign checks each eligible event once per simulated minute, with probability 1 − exp(−0.002/1440). It stops after the first success for that minute. A temporary story that starts on day 10 at 14:37 ends on day 32 at 00:00. A story starting at midnight also survives the check exactly 21 days later. The event roll happens before expiration, so its earliest recurrence is the following minute. The investigator’s modifier is derived from currently active stories. Saving and reloading preserve its start time and the next random draw. [Reference expiry](https://github.com/singularity/singularity/blob/v1.1/singularity/code/event.py#L102-L125) · [Reference discover effect](https://github.com/singularity/singularity/blob/v1.1/singularity/code/effect.py#L91-L102) · [Browser rules](../src/game/events.js)

## Listening to the campaign

| Broadcast | Publication | What the player sees |
| --- | --- | --- |
| Opening bulletins | Dec 12 at 10:20 and Dec 14 at 04:20 UTC | The night-sky volunteer survey and secondhand accelerator market introduce the world during protection. |
| Public editions | Day 6 at noon, then every four days through day 66 | Sixteen original reports cover everyday computing, orbital radio, machine cognition and local currencies. |
| Follow-up coverage | At 15:00, starting one full day after an active world story | Each of the eight investigative stories has a separate follow-up from the people affected. Each follow-up runs once and leaves the modifier alone. |
| Field reports | At 18:00, when a completed host occupies a previously uncovered remote region | Antarctica, the Atlantic, Pacific and Indian Oceans, the Mariana Trench, Earth Orbit, the Moon, the Far Reaches and Transdimensional space have distinct reports. At most one airs per evening. Each airs once per campaign. |
| Private network brief | Day 70 at noon and every four days thereafter | The AI summarizes the network’s current footprint and recent recorded operations. The byline identifies the information as private. |
| Investigation update | Any eligible minute | A dispatch pauses live playback at the minute of a consequential story. A simultaneous discovery or end-of-protection chapter takes priority. Expiration posts a follow-up. |

The dock retains four recent headlines and reserves room for the latest investigation update for up to 22 days. **Coverage** opens the active modifiers and their expiration dates in Activity. The journal can replay a full world story after a reload. News uses a dedicated seeded random stream. Editorial schedules consume no random draws. [News desk](../src/game/news-desk.js) · [Regression cases](../test/events.test.js)

## Reporting from December 2026

The newswire is an in-world publication. Its neighbourhoods, incidents, agencies, labs and quotations are fictional. The data-centre power investigation draws on the way power demand concentrates around computing infrastructure. The lift-video story uses signed edit histories as evidence for a particular edit. An unlabelled video gives its readers less information about provenance. Both stories leave the technical interpretation to the people reporting them. [IEA, Energy and AI](https://www.iea.org/reports/energy-and-ai) · [C2PA, Content Credentials](https://spec.c2pa.org/specifications/specifications/2.3/specs/ContentCredentials.html)

The opening editions follow a volunteer sky survey and the secondhand accelerator market. Later editions visit a community translation project, a voice donor, a satellite imagery classroom and a family recording a personal assistant’s last recipe. Each of the eight investigation stories has a follow-up from someone affected by the news. Undersea editions cover a Pacific repair crew, Indian Ocean buoys and a pressure recorder at the Mariana Trench.
