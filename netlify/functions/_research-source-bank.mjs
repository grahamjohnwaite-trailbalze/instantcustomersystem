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
  business: [
    {name:'FSB',domain:'fsb.org.uk',role:'INDUSTRY',best_for:'small-business issues and policy'},
    {name:'British Business Bank',domain:'british-business-bank.co.uk',role:'AUTHORITY',best_for:'small-business finance and growth'},
    {name:'Companies House',domain:'gov.uk',role:'AUTHORITY',best_for:'company records and filings'}
  ]
};
export function radarDomains(){
  return [...new Set(Object.values(RESEARCH_SOURCE_BANK).flat().filter(x=>['RADAR','INDUSTRY','MARKET'].includes(x.role)).map(x=>x.domain))];
}
