export const RESEARCH_SOURCE_BANK = {
  money: [
    {name:'MoneySavingExpert',domain:'moneysavingexpert.com',role:'RADAR',best_for:'consumer money, deals, bills, savings, benefits, travel money'},
    {name:'This is Money / Daily Mail Money',domain:'thisismoney.co.uk',role:'RADAR',best_for:'personal finance, consumer issues, property, pensions, household money'},
    {name:'MoneyHelper',domain:'moneyhelper.org.uk',role:'AUTHORITY',best_for:'consumer finance guidance'}
  ],
  lettings: [
    {name:'LandlordZONE',domain:'landlordzone.co.uk',role:'RADAR',best_for:'lettings, landlord regulation, rental-market issues'},
    {name:'Propertymark',domain:'propertymark.co.uk',role:'INDUSTRY',best_for:'lettings and estate-agency industry signals'},
    {name:'Shelter',domain:'england.shelter.org.uk',role:'AUTHORITY',best_for:'tenant rights and housing guidance'}
  ],
  property: [
    {name:'Rightmove',domain:'rightmove.co.uk',role:'MARKET',best_for:'asking prices, listings and market behaviour'},
    {name:'Zoopla',domain:'zoopla.co.uk',role:'MARKET',best_for:'property listings, market data and consumer property angles'},
    {name:'HomeOwners Alliance',domain:'hoa.org.uk',role:'RADAR',best_for:'buying, selling, surveys, conveyancing and homeownership questions'}
  ],
  home: [
    {name:'Which?',domain:'which.co.uk',role:'RADAR',best_for:'consumer products, home, energy and household costs'},
    {name:'Energy Saving Trust',domain:'energysavingtrust.org.uk',role:'AUTHORITY',best_for:'home energy and efficiency'},
    {name:'Citizens Advice',domain:'citizensadvice.org.uk',role:'AUTHORITY',best_for:'consumer rights, bills and household problems'}
  ],
  health: [
    {name:'Patient.info',domain:'patient.info',role:'RADAR',best_for:'plain-language health topics and common reader questions'},
    {name:'NHS',domain:'nhs.uk',role:'AUTHORITY',best_for:'health guidance and service information'},
    {name:'NICE',domain:'nice.org.uk',role:'AUTHORITY',best_for:'clinical guidance'}
  ],
  pets: [
    {name:'PDSA',domain:'pdsa.org.uk',role:'AUTHORITY',best_for:'pet health, costs and seasonal advice'},
    {name:'Dogs Trust',domain:'dogstrust.org.uk',role:'AUTHORITY',best_for:'dog behaviour, welfare and ownership'},
    {name:'Blue Cross',domain:'bluecross.org.uk',role:'AUTHORITY',best_for:'pet welfare and ownership guidance'}
  ],
  motoring: [
    {name:'RAC',domain:'rac.co.uk',role:'RADAR',best_for:'motoring costs, roads, fuel and driver advice'},
    {name:'AA',domain:'theaa.com',role:'RADAR',best_for:'motoring, breakdown, travel and driver advice'},
    {name:'GOV.UK Motoring',domain:'gov.uk',role:'AUTHORITY',best_for:'DVLA, driving rules and official transport information'}
  ],

  local: [
    {name:'BBC Local',domain:'bbc.co.uk',role:'RADAR',best_for:'current local reporting and story discovery'},
    {name:'Cambridge Independent',domain:'cambridgeindependent.co.uk',role:'RADAR',best_for:'Cambridge and Cambridgeshire local reporting'},
    {name:'Cambridge News',domain:'cambridge-news.co.uk',role:'RADAR',best_for:'Cambridgeshire local news and current events'},
    {name:'Hunts Post',domain:'huntspost.co.uk',role:'RADAR',best_for:'Huntingdonshire local reporting'}
  ],
  food: [
    {name:'MICHELIN Guide',domain:'guide.michelin.com',role:'RADAR',best_for:'named restaurants and current recognition'},
    {name:'OpenTable',domain:'opentable.co.uk',role:'RADAR',best_for:'named restaurants, booking and current venue discovery'},
    {name:'Visit Cambridge Food & Drink',domain:'visitcambridge.org',role:'LOCAL',best_for:'Cambridge and Cambridgeshire food and drink discovery'}
  ],
  events: [
    {name:'Visit Cambridge',domain:'visitcambridge.org',role:'LOCAL',best_for:'current attractions, events and visitor ideas'},
    {name:'Eventbrite UK',domain:'eventbrite.co.uk',role:'RADAR',best_for:'dated local events and ticket prices'},
    {name:'Cambridgeshire Libraries',domain:'cambridgeshire.gov.uk',role:'OFFICIAL',best_for:'local library and community events'}
  ],
  telecoms: [
    {name:'Ofcom',domain:'ofcom.org.uk',role:'AUTHORITY',best_for:'phone, broadband and telecoms changes'},
    {name:'BT',domain:'bt.com',role:'PRIMARY',best_for:'Digital Voice and landline migration information'}
  ],
  safety: [
    {name:'Cambridgeshire Constabulary',domain:'cambs.police.uk',role:'OFFICIAL',best_for:'crime, road incidents and prevention advice'},
    {name:'National Highways',domain:'nationalhighways.co.uk',role:'OFFICIAL',best_for:'strategic roads and road safety'},
    {name:'Cambridgeshire Highways',domain:'cambridgeshire.gov.uk',role:'OFFICIAL',best_for:'local roads, highways and transport'}
  ],
  community: [
    {name:'MAGPAS Air Ambulance',domain:'magpas.org.uk',role:'PRIMARY',best_for:'Cambridgeshire air ambulance services and fundraising'},
    {name:'East of England Ambulance Service',domain:'eastamb.nhs.uk',role:'OFFICIAL',best_for:'ambulance services and emergency response'}
  ],
  planning: [
    {name:'Cambridgeshire County Council',domain:'cambridgeshire.gov.uk',role:'OFFICIAL',best_for:'county policy, transport and services'},
    {name:'Cambridge City Council',domain:'cambridge.gov.uk',role:'OFFICIAL',best_for:'Cambridge planning, services and local decisions'},
    {name:'South Cambridgeshire District Council',domain:'scambs.gov.uk',role:'OFFICIAL',best_for:'South Cambridgeshire planning and local decisions'},
    {name:'Huntingdonshire District Council',domain:'huntingdonshire.gov.uk',role:'OFFICIAL',best_for:'Huntingdonshire planning and local decisions'},
    {name:'East Cambridgeshire District Council',domain:'eastcambs.gov.uk',role:'OFFICIAL',best_for:'East Cambridgeshire planning and local decisions'},
    {name:'Fenland District Council',domain:'fenland.gov.uk',role:'OFFICIAL',best_for:'Fenland planning and local decisions'}
  ],
  business: [
    {name:'FSB',domain:'fsb.org.uk',role:'INDUSTRY',best_for:'small-business issues and policy'},
    {name:'British Business Bank',domain:'british-business-bank.co.uk',role:'AUTHORITY',best_for:'small-business finance and growth'},
    {name:'Companies House',domain:'gov.uk',role:'AUTHORITY',best_for:'company records and filings'}
  ]
};
export function radarDomains(){
  return [...new Set(Object.values(RESEARCH_SOURCE_BANK).flat().filter(x=>['RADAR','INDUSTRY','MARKET'].includes(x.role)).map(x=>x.domain))];
}
