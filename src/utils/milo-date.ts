import { DateTime } from 'luxon'

export const MILO_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss'

export function resoudreDateMilo(
  dateNaive: string,
  timezoneStructure: string
): DateTime {
  return DateTime.fromFormat(dateNaive, MILO_DATE_FORMAT, {
    zone: timezoneStructure
  })
}
