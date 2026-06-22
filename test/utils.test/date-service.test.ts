import { expect } from 'chai'
import { DateTime } from 'luxon'
import { DateService } from 'src/utils/date-service'

const dateService = new DateService()

describe('DateService', () => {
  describe('isSameDateDay', () => {
    it('retourne true si la date est au meme jour, meme mois et meme année', () => {
      const date1 = DateTime.fromISO('2020-04-06T12:00:00.000Z')
      const date2 = DateTime.fromISO('2020-04-06T17:03:12.000Z')

      expect(DateService.isSameDateDay(date1, date2)).to.equal(true)
    })
  })

  describe('fromISOStringToJSDate', () => {
    it('retourne une date JS', () => {
      const dateString = '2020-04-06T12:00:00+02:00'
      const dateUTC = dateService.fromISOStringToJSDate(dateString)
      const expectedDateUTC = new Date('2020-04-06T10:00:00.000Z')

      expect(dateUTC).to.deep.equal(expectedDateUTC)
    })
  })

  describe('estDansLaSemaine', () => {
    const semaine = {
      debut: DateTime.fromISO('2023-03-27T00:00:00.000+02:00'), // lundi
      fin: DateTime.fromISO('2023-04-02T23:59:59.999+02:00') // dimanche
    }

    it('retourne true pour une date dans la semaine', () => {
      const mercredi = DateTime.fromISO('2023-03-29T10:00:00.000+02:00')

      expect(DateService.estDansLaSemaine(mercredi, semaine)).to.equal(true)
    })

    it('retourne true pour une date passée du début de semaine (lundi)', () => {
      const lundiMatin = DateTime.fromISO('2023-03-27T08:00:00.000+02:00')

      expect(DateService.estDansLaSemaine(lundiMatin, semaine)).to.equal(true)
    })

    it('retourne false pour une date avant le début de semaine', () => {
      const dimancheDavant = DateTime.fromISO('2023-03-26T23:00:00.000+02:00')

      expect(DateService.estDansLaSemaine(dimancheDavant, semaine)).to.equal(
        false
      )
    })

    it('retourne false pour une date après la fin de semaine', () => {
      const lundiSuivant = DateTime.fromISO('2023-04-03T08:00:00.000+02:00')

      expect(DateService.estDansLaSemaine(lundiSuivant, semaine)).to.equal(
        false
      )
    })
  })
})
