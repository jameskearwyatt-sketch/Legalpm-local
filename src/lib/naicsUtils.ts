/**
 * NAICS Code to Sector Name Mapping Utility
 * 
 * Maps NAICS (North American Industry Classification System) codes to 
 * human-readable sector names for the contacts distribution hub.
 */

// NAICS code prefixes to sector names mapping
// Using 2-6 digit prefixes for hierarchical matching
const NAICS_SECTOR_MAP: Record<string, string> = {
  // Agriculture, Forestry, Fishing and Hunting (11)
  "11": "Agriculture & Forestry",
  "111": "Crop Production",
  "112": "Animal Production & Aquaculture",
  "113": "Forestry & Logging",
  "114": "Fishing, Hunting & Trapping",
  "115": "Agriculture Support Services",

  // Mining, Quarrying, and Oil and Gas Extraction (21)
  "21": "Mining & Extraction",
  "211": "Oil & Gas Extraction",
  "2111": "Oil & Gas Extraction",
  "21111": "Crude Petroleum & Natural Gas",
  "211120": "Crude Petroleum Extraction",
  "211130": "Natural Gas Extraction",
  "212": "Mining (except Oil & Gas)",
  "2121": "Coal Mining",
  "2122": "Metal Ore Mining",
  "2123": "Nonmetallic Mineral Mining",
  "213": "Mining Support Activities",

  // Utilities (22)
  "22": "Utilities",
  "221": "Utilities",
  "2211": "Electric Power Generation",
  "22111": "Electric Power Generation",
  "221111": "Hydroelectric Power Generation",
  "221112": "Fossil Fuel Electric Power Generation",
  "221113": "Nuclear Electric Power Generation",
  "221114": "Solar Electric Power Generation",
  "221115": "Wind Electric Power Generation",
  "221116": "Geothermal Electric Power Generation",
  "221117": "Biomass Electric Power Generation",
  "221118": "Other Electric Power Generation",
  "22112": "Electric Power Transmission",
  "2212": "Natural Gas Distribution",
  "2213": "Water, Sewage & Other Systems",

  // Construction (23)
  "23": "Construction",
  "236": "Building Construction",
  "237": "Heavy & Civil Engineering Construction",
  "238": "Specialty Trade Contractors",

  // Manufacturing (31-33)
  "31": "Manufacturing",
  "32": "Manufacturing",
  "33": "Manufacturing",
  "311": "Food Manufacturing",
  "312": "Beverage & Tobacco Manufacturing",
  "313": "Textile Mills",
  "314": "Textile Product Mills",
  "315": "Apparel Manufacturing",
  "316": "Leather & Allied Products",
  "321": "Wood Product Manufacturing",
  "322": "Paper Manufacturing",
  "323": "Printing & Related Support",
  "324": "Petroleum & Coal Products",
  "325": "Chemical Manufacturing",
  "326": "Plastics & Rubber Products",
  "327": "Nonmetallic Mineral Products",
  "331": "Primary Metal Manufacturing",
  "332": "Fabricated Metal Products",
  "333": "Machinery Manufacturing",
  "334": "Computer & Electronic Products",
  "335": "Electrical Equipment & Appliances",
  "336": "Transportation Equipment",
  "337": "Furniture & Related Products",
  "339": "Miscellaneous Manufacturing",

  // Wholesale Trade (42)
  "42": "Wholesale Trade",
  "423": "Merchant Wholesalers (Durable)",
  "424": "Merchant Wholesalers (Nondurable)",
  "425": "Electronic Markets & Agents",

  // Retail Trade (44-45)
  "44": "Retail Trade",
  "45": "Retail Trade",
  "441": "Motor Vehicle & Parts Dealers",
  "442": "Furniture & Home Furnishings",
  "443": "Electronics & Appliance Stores",
  "444": "Building Material & Garden",
  "445": "Food & Beverage Stores",
  "446": "Health & Personal Care Stores",
  "447": "Gasoline Stations",
  "448": "Clothing & Accessories Stores",
  "449": "Furniture, Home Furnishings & Electronics",
  "451": "Sporting Goods & Hobby Stores",
  "452": "General Merchandise Stores",
  "453": "Miscellaneous Store Retailers",
  "454": "Nonstore Retailers",
  "455": "General Merchandise Retail",
  "456": "Health & Personal Care Retail",
  "457": "Gasoline Stations & Fuel Dealers",
  "458": "Clothing & Accessories Retail",
  "459": "Sporting Goods, Hobby & Book Stores",

  // Transportation and Warehousing (48-49)
  "48": "Transportation & Logistics",
  "49": "Warehousing & Storage",
  "481": "Air Transportation",
  "482": "Rail Transportation",
  "483": "Water Transportation",
  "484": "Truck Transportation",
  "485": "Transit & Ground Passenger",
  "486": "Pipeline Transportation",
  "487": "Scenic & Sightseeing",
  "488": "Transportation Support",
  "491": "Postal Service",
  "492": "Couriers & Messengers",
  "493": "Warehousing & Storage",

  // Information (51)
  "51": "Information & Media",
  "511": "Publishing Industries",
  "512": "Motion Picture & Sound Recording",
  "515": "Broadcasting (except Internet)",
  "516": "Internet Publishing & Broadcasting",
  "517": "Telecommunications",
  "518": "Data Processing & Hosting",
  "519": "Web Search Portals & Information",

  // Finance and Insurance (52)
  "52": "Financial Services",
  "521": "Central Banking",
  "522": "Credit Intermediation",
  "523": "Securities & Investments",
  "524": "Insurance",
  "525": "Funds, Trusts & Other Financial",

  // Real Estate and Rental and Leasing (53)
  "53": "Real Estate",
  "531": "Real Estate",
  "532": "Rental & Leasing Services",
  "533": "Intellectual Property Lessors",

  // Professional, Scientific, and Technical Services (54)
  "54": "Professional Services",
  "541": "Professional & Technical Services",
  "5411": "Legal Services",
  "5412": "Accounting & Tax Preparation",
  "5413": "Architectural & Engineering",
  "5414": "Specialized Design Services",
  "5415": "Computer Systems Design",
  "5416": "Management & Scientific Consulting",
  "5417": "Scientific Research & Development",
  "5418": "Advertising & Public Relations",
  "5419": "Other Professional Services",

  // Management of Companies (55)
  "55": "Management of Companies",
  "551": "Management of Companies & Enterprises",

  // Administrative and Support Services (56)
  "56": "Administrative & Support Services",
  "561": "Administrative & Support Services",
  "562": "Waste Management & Remediation",

  // Educational Services (61)
  "61": "Education",
  "611": "Educational Services",

  // Health Care and Social Assistance (62)
  "62": "Healthcare",
  "621": "Ambulatory Health Care",
  "622": "Hospitals",
  "623": "Nursing & Residential Care",
  "624": "Social Assistance",

  // Arts, Entertainment, and Recreation (71)
  "71": "Arts & Entertainment",
  "711": "Performing Arts & Spectator Sports",
  "712": "Museums & Historical Sites",
  "713": "Amusement & Recreation",

  // Accommodation and Food Services (72)
  "72": "Hospitality",
  "721": "Accommodation",
  "722": "Food Services & Drinking Places",

  // Other Services (81)
  "81": "Other Services",
  "811": "Repair & Maintenance",
  "812": "Personal & Laundry Services",
  "813": "Religious & Civic Organizations",
  "814": "Private Households",

  // Public Administration (92)
  "92": "Government & Public Administration",
  "921": "Executive & Legislative",
  "922": "Justice, Public Order & Safety",
  "923": "Administration of Human Resources",
  "924": "Environmental Quality Administration",
  "925": "Housing & Community Development",
  "926": "Economic Programs Administration",
  "927": "Space Research & Technology",
  "928": "National Security & International",
};

/**
 * Get the sector name for a NAICS code
 * Attempts to find the most specific match by trying longest prefix first
 */
export function getNaicsSectorName(code: string): string {
  if (!code) return "";
  
  const cleanCode = code.replace(/[^0-9]/g, "");
  
  // Try from most specific (full code) to least specific (2 digits)
  for (let len = cleanCode.length; len >= 2; len--) {
    const prefix = cleanCode.substring(0, len);
    if (NAICS_SECTOR_MAP[prefix]) {
      return NAICS_SECTOR_MAP[prefix];
    }
  }
  
  return `Industry ${cleanCode}`;
}

/**
 * Get the primary sector name from an array of NAICS codes
 * Returns the first non-empty sector name found
 */
export function getPrimaryNaicsSector(codes: string[] | null | undefined): string | null {
  if (!codes || codes.length === 0) return null;
  
  for (const code of codes) {
    const sector = getNaicsSectorName(code);
    if (sector) return sector;
  }
  
  return null;
}

/**
 * Get all unique sector names from an array of NAICS codes
 */
export function getAllNaicsSectors(codes: string[] | null | undefined): string[] {
  if (!codes || codes.length === 0) return [];
  
  const sectors = new Set<string>();
  for (const code of codes) {
    const sector = getNaicsSectorName(code);
    if (sector) sectors.add(sector);
  }
  
  return Array.from(sectors);
}

/**
 * Format NAICS sector with code for display
 * Returns "Sector Name (CODE)" format
 */
export function formatNaicsSectorWithCode(code: string): string {
  const sectorName = getNaicsSectorName(code);
  return `${sectorName} (${code})`;
}

/**
 * Get display text for assigned sector field
 * Shows primary sector with first NAICS code in parentheses
 */
export function getAssignedSectorDisplay(codes: string[] | null | undefined): string | null {
  if (!codes || codes.length === 0) return null;
  
  const primaryCode = codes[0];
  const sectorName = getNaicsSectorName(primaryCode);
  
  return sectorName || null;
}
