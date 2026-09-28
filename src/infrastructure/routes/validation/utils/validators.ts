import {
  buildMessage,
  isPhoneNumber,
  ValidateBy,
  ValidationOptions
} from 'class-validator'

// Régions libphonenumber de la France : métropole puis DROM-COM. Un numéro
// national saisi sans indicatif (0692…) n'est valide que dans sa région, un
// contrôle limité à 'FR' rejette donc tous les numéros d'outre-mer.
const REGIONS_FRANCE = [
  'FR',
  'RE',
  'GP',
  'MQ',
  'GF',
  'YT',
  'PM',
  'BL',
  'MF',
  'NC',
  'PF',
  'WF'
] as const

export const IS_NUMERO_TELEPHONE_FRANCAIS = 'isNumeroTelephoneFrancais'

export function isNumeroTelephoneFrancais(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    REGIONS_FRANCE.some(region => isPhoneNumber(value, region))
  )
}

export function IsNumeroTelephoneFrancais(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_NUMERO_TELEPHONE_FRANCAIS,
      validator: {
        validate: (value): boolean => isNumeroTelephoneFrancais(value),
        defaultMessage: buildMessage(
          eachPrefix =>
            eachPrefix +
            '$property must be a valid phone number (France métropolitaine ou outre-mer)',
          validationOptions
        )
      }
    },
    validationOptions
  )
}
