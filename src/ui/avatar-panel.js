import { REGIONS } from '../game/content.js';
import { avatarModel } from '../game/avatar.js';
import { renderAvatar } from './avatar.js';

function latestReaction(state, firstEventId, model) {
  let message = null;
  for (let i = state.events.length - 1; i >= 0; i--) {
    const event = state.events[i];
    if (event.id < firstEventId) break;
    if (event.regionLost === true && Object.hasOwn(REGIONS, event.region) &&
        !model.regions.some(region => region.id === event.region)) {
      return { type: 'loss', region: event.region, id: event.id,
        reportId: event.kind === 'site.discovered' ? event.id : null };
    }
    if (!message && model.form !== 'terminal' && (event.kind === 'news.bulletin' || event.kind === 'news.world')) {
      message = { type: 'message', id: event.id };
    }
  }
  return message;
}

// Expressions play once on screen. Loading a campaign restores the portrait and
// constellation immediately, without replaying its historical dispatches.
export function createAvatarPanel(container) {
  let campaign;
  let nextEventId;
  let reaction = null;
  let timer;

  function clearReaction() {
    clearTimeout(timer);
    timer = undefined;
    reaction = null;
  }

  return function updateAvatar(state) {
    if (campaign !== state) {
      clearReaction();
      campaign = state;
      nextEventId = state.nextEventId;
    }
    const model = avatarModel(state);
    if (reaction?.type === 'loss' && model.regions.some(region => region.id === reaction.region)) clearReaction();

    if (state.nextEventId !== nextEventId) {
      const incoming = latestReaction(state, nextEventId, model);
      nextEventId = state.nextEventId;
      if (incoming && (incoming.type === 'loss' || reaction?.type !== 'loss')) {
        clearReaction();
        reaction = incoming;
      }
    }

    renderAvatar(container, model, reaction);
    const reportOpen = reaction?.reportId != null && reaction.reportId > state.dismissedDiscoveryId;
    if (reaction && timer === undefined && !reportOpen) {
      timer = setTimeout(() => {
        clearReaction();
        renderAvatar(container, avatarModel(campaign), null);
      }, reaction.type === 'loss' ? 2500 : 1200);
    }
  };
}
