// Work is recorded in hundredths of a CPU-minute, assembly in minutes and procurement in dollars.
export const WORK_UNITS = 6000;
const whole = amount => Number.isSafeInteger(amount) && amount >= 0;

export function validOrderFunding(order) {
  const requiredUnits = Math.round(order.workRequired * WORK_UNITS);
  return whole(order.cashRequired) && whole(order.cashPaid) && order.cashPaid <= order.cashRequired &&
    whole(requiredUnits) && requiredUnits / WORK_UNITS === order.workRequired && order.work <= order.workRequired;
}

// The reference rounds to the nearest unit with ties going to the even unit.
function nearest(amount) {
  const lower = Math.floor(amount);
  return amount - lower === 0.5 ? lower + (lower % 2) : Math.round(amount);
}

// Each resource can advance only as far as the least-funded nonzero requirement.
// Calculate all three balances from the same fraction, then carry the integer
// amounts already invested forward. Extending a processor batch can leave
// more cash or CPU invested than its restarted assembly clock.
export function orderInterval(order, targetWork, targetHours, cpu, cash, elapsedMinutes) {
  // Hiring a crew starts a fresh payment schedule for the remaining labor.
  // Money and CPU invested before hiring stay credited at their original rates.
  if (order.crew) {
    const start = order.crew;
    const phase = {
      work: order.work - start.work, hours: order.hours - start.hours,
      cashRequired: order.cashRequired - start.paid, cashPaid: order.cashPaid - start.paid,
    };
    const progress = orderInterval(phase, targetWork - start.work, targetHours - start.hours, cpu, cash, elapsedMinutes * 2);
    return { ...progress,
      work: Math.round((progress.work + start.work) * WORK_UNITS) / WORK_UNITS,
      hours: Math.round((progress.hours + start.hours) * 60) / 60 };
  }
  const work = Math.round(order.work * WORK_UNITS);
  const minutes = Math.round(order.hours * 60);
  const required = Math.round(targetWork * WORK_UNITS);
  const duration = Math.round(targetHours * 60);
  const price = order.cashRequired;
  const paid = order.cashPaid;
  const workLimit = Math.min(required, work + cpu);
  const timeLimit = Math.min(duration, minutes + elapsedMinutes);
  const cashLimit = paid + Math.min(cash, price - paid);
  const fraction = Math.min(1, required ? workLimit / required : 1,
    duration ? timeLimit / duration : 1, price ? cashLimit / price : 1);
  // Clamp rounded balances to their actual supply and preserve previous payment.
  const newWork = Math.max(work, Math.min(workLimit, nearest(fraction * required)));
  const elapsed = Math.max(minutes, Math.min(timeLimit, nearest(fraction * duration)));
  const newPaid = Math.max(paid, Math.min(cashLimit, nearest(fraction * price)));
  return { used: newWork - work, spent: newPaid - paid, work: newWork / WORK_UNITS, hours: elapsed / 60,
    done: newWork >= required && elapsed >= duration && newPaid >= price };
}

export function nextOrderMinute(order, targetWork, targetHours, cpu, cash = 0) {
  return orderInterval(order, targetWork, targetHours, cpu, cash, 1);
}

export function orderStatus(order, work, hours, cpu, cash, next, cpuBlocker) {
  const workRemaining = Math.max(0, work - order.work);
  const hoursRemaining = Math.round(Math.max(0, hours - order.hours) * 60) / (order.crew ? 120 : 60);
  const cashPaid = order.cashPaid;
  const cashRemaining = order.cashRequired - cashPaid;
  const stalled = !next.done && !next.used && !next.spent && next.hours === order.hours;
  let reason = 'Receiving CPU';
  if (stalled) reason = cashRemaining && !cash ? 'Waiting for project funds' : cpuBlocker;
  else if (next.done) reason = 'Completing this minute';
  else if (next.spent && !next.used && !hoursRemaining) reason = 'Paying project costs';
  else if (!workRemaining || !next.used) reason = 'Assembly in progress';

  // With cash in hand, completion takes at least the longer of CPU work and
  // assembly. Future cash or CPU released by other orders changes this estimate.
  let etaHours = null;
  if (cashRemaining <= cash && (!workRemaining || cpu)) {
    const cpuMinutes = cpu ? workRemaining * WORK_UNITS / cpu : 0;
    etaHours = Math.max(1, Math.ceil(Math.max(hoursRemaining * 60, cpuMinutes))) / 60;
  }
  const progress = Math.min(1, work ? order.work / work : 1, hours ? order.hours / hours : 1,
    order.cashRequired ? cashPaid / order.cashRequired : 1);
  return { progress, stalled, reason, completesNextMinute: next.done, cpu: next.used / 100,
    workRemaining, hoursRemaining, cashPaid, cashRemaining, etaHours };
}
