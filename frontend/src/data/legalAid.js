// Static legal aid data for hackathon demo
export const LEGAL_AID_ORGS = [
  {
    name: 'International Rescue Committee',
    phone: '+1-212-551-3000',
    website: 'https://www.rescue.org',
    languages: ['ar', 'so', 'uk', 'es', 'fr', 'sw', 'am'],
    country: 'US',
    city: 'New York',
  },
  {
    name: 'UNHCR USA',
    phone: '+1-202-296-5191',
    website: 'https://www.unhcr.org/en-us',
    languages: ['ar', 'fa', 'ps', 'so', 'ti', 'am', 'uk', 'es', 'fr', 'sw', 'my', 'ku'],
    country: 'US',
    city: 'Washington DC',
  },
  {
    name: 'Immigration Equality',
    phone: '+1-212-714-2904',
    website: 'https://immigrationequality.org',
    languages: ['es', 'fr', 'ar', 'uk'],
    country: 'US',
    city: 'New York',
  },
  {
    name: 'Catholic Legal Immigration Network (CLINIC)',
    phone: '+1-301-655-1800',
    website: 'https://cliniclegal.org',
    languages: ['es', 'fr', 'ar', 'so', 'am'],
    country: 'US',
    city: 'Silver Spring, MD',
  },
  {
    name: 'Refugee Action UK',
    phone: '+44-20-7952-1511',
    website: 'https://www.refugee-action.org.uk',
    languages: ['ar', 'so', 'ti', 'am', 'ku', 'fa'],
    country: 'UK',
    city: 'London',
  },
  {
    name: 'Scottish Refugee Council',
    phone: '+44-141-248-9799',
    website: 'https://scottishrefugeecouncil.org.uk',
    languages: ['ar', 'ti', 'am', 'so'],
    country: 'UK',
    city: 'Glasgow',
  },
]

export function getLegalAidByLanguage(langCode) {
  return LEGAL_AID_ORGS.filter(org => org.languages.includes(langCode))
}

export function getLegalAidByCountry(country, langCode) {
  return LEGAL_AID_ORGS.filter(
    org => org.country === country && (langCode ? org.languages.includes(langCode) : true)
  )
}
