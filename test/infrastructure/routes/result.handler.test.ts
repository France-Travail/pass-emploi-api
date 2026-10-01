import { BadRequestException, NotFoundException } from '@nestjs/common'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { handleResult } from '../../../src/infrastructure/routes/result.handler'
import { expect } from '../../utils'

describe('handleResult', () => {
  it('renvoie la donnée quand le résultat est un succès', () => {
    // Given
    const result = success({ value: 42 })

    // When
    const data = handleResult(result)

    // Then
    expect(data).to.deep.equal({ value: 42 })
  })

  it('lance NotFoundException quand le résultat est NonTrouveError', () => {
    // Given
    const result = failure(new NonTrouveError('Jeune', 'id-123'))

    // When - Then
    expect(() => handleResult(result)).to.throw(NotFoundException)
  })

  it('lance BadRequestException quand le résultat est MauvaiseCommandeError', () => {
    // Given
    const result = failure(new MauvaiseCommandeError('données invalides'))

    // When - Then
    expect(() => handleResult(result)).to.throw(BadRequestException)
  })
})
