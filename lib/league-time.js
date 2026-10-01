/*
   Dates and times in the league's time zone (config.LEAGUE_TIME_ZONE), so results
   don't depend on the server's clock zone (often UTC).
*/

// Milliseconds the time zone is ahead of UTC at the given instant (negative for
// zones west of UTC), including daylight saving time.
function zoneOffsetMs(instant, timeZone) {
   const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
         timeZone,
         hourCycle: 'h23',
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit'
      }).formatToParts(instant).map(p => [p.type, p.value])
   )
   const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
   const wholeSeconds = instant.getTime() - instant.getUTCMilliseconds()

   return wallClockAsUtc - wholeSeconds
}

// The instant when it is `hour`:00 on `date` (MM/DD/YYYY, as in season.json) in timeZone.
function zonedTime(date, hour, timeZone) {
   const [month, day, year] = date.split('/').map(Number)
   const wallClockAsUtc = Date.UTC(year, month - 1, day, hour)
   // Second pass corrects the offset when the first guess lands across a DST change.
   const firstGuess = wallClockAsUtc - zoneOffsetMs(new Date(wallClockAsUtc), timeZone)

   return new Date(wallClockAsUtc - zoneOffsetMs(new Date(firstGuess), timeZone))
}

// The first week (in season order) whose match day hasn't reached cutoffHour yet.
function findCurrentWeek(weeks, now, timeZone, cutoffHour) {
   return weeks.find(week => zonedTime(week.date, cutoffHour, timeZone) >= now)
}

module.exports = {
   zoneOffsetMs,
   zonedTime,
   findCurrentWeek
}
