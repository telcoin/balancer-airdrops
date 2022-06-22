const WEEK_1_START_TIMESTAMP = 1590969600;
const SECONDS_PER_WEEK = 604800;

function now() {
    return Math.floor(new Date().getTime()/1000);
}

export function getCurrentWeekNumber() {
    return Math.floor(1 + (now() - WEEK_1_START_TIMESTAMP) / SECONDS_PER_WEEK);
}

export function getWeekStartTimestamp(week: number) {
    return WEEK_1_START_TIMESTAMP + (week - 1) * 7 * 24 * 60 * 60;
}

export function getWeekEndTimestamp(week: number) {
    return getWeekStartTimestamp(week) + SECONDS_PER_WEEK;
}