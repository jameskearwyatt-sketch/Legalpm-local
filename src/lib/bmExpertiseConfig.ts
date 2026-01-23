// Configuration for expertise categories and fields
// This maps the Excel columns to our database structure

export interface ExpertiseField {
  key: string;
  label: string;
  excelColumn?: number; // 0-indexed column position in Excel for each category
}

export interface ExpertiseSection {
  key: string;
  label: string;
  color: string; // Tailwind color class
  fields: ExpertiseField[];
}

export interface ExpertiseCategory {
  key: 'project_development' | 'ma' | 'project_finance';
  label: string;
  sections: ExpertiseSection[];
}

// Excel column mappings (0-indexed, starting after the basic info columns)
// Basic info columns: Name, Surname, Title, Region, Office, Global Practice Group (0-5)
// Project Development starts at column 6

export const EXPERTISE_CATEGORIES: ExpertiseCategory[] = [
  {
    key: 'project_development',
    label: 'Project Development',
    sections: [
      {
        key: 'renewables',
        label: 'Renewables',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        fields: [
          { key: 'project_development_general', label: 'Project Development' },
          { key: 'offshore_wind', label: 'Offshore Wind' },
          { key: 'onshore_wind', label: 'Onshore Wind' },
          { key: 'solar', label: 'Solar' },
          { key: 'hydro', label: 'Hydro' },
          { key: 'geothermal', label: 'Geothermal' },
          { key: 'corporate_ppa', label: 'Corporate PPA' },
          { key: 'battery_storage', label: 'Battery Storage' },
        ],
      },
      {
        key: 'power',
        label: 'Power',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        fields: [
          { key: 'power_conventional', label: 'Power Conventional' },
          { key: 'nuclear', label: 'Nuclear' },
          { key: 'waste_to_power', label: 'Waste-to-Power' },
        ],
      },
      {
        key: 'clean_tech',
        label: 'Clean Tech',
        color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
        fields: [
          { key: 'hydrogen', label: 'Hydrogen' },
          { key: 'ccus', label: 'CCUS' },
          { key: 'sustainable_fuels', label: 'Sustainable Fuels' },
        ],
      },
      {
        key: 'metals_mining',
        label: 'Metals & Mining',
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        fields: [
          { key: 'metals_mining', label: 'Metals & Mining' },
        ],
      },
      {
        key: 'oil_gas',
        label: 'Oil & Gas',
        color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
        fields: [
          { key: 'upstream_og', label: 'Upstream O&G' },
          { key: 'midstream_og', label: 'Midstream O&G' },
          { key: 'downstream_og', label: 'Downstream O&G' },
          { key: 'lng_specialist', label: 'LNG Specialist' },
          { key: 'shipping_og', label: 'Shipping O&G' },
          { key: 'fsru', label: 'FSRU' },
          { key: 'petchems', label: 'Petchems' },
        ],
      },
      {
        key: 'infrastructure',
        label: 'Infrastructure',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        fields: [
          { key: 'airports', label: 'Airports' },
          { key: 'ports_terminals', label: 'Ports & Terminals' },
          { key: 'roads_bridges_tunnels', label: 'Roads, Bridges & Tunnels' },
          { key: 'datacenters', label: 'Datacenters' },
          { key: 'dt_other', label: 'D&T: Other' },
          { key: 'power_transmission_grids', label: 'Power & Transmission Grids' },
          { key: 'rail', label: 'Rail' },
          { key: 'water_waste_management', label: 'Water & Waste Management' },
          { key: 'healthcare', label: 'Healthcare' },
          { key: 'other_social_infra', label: 'Other Social Infra' },
        ],
      },
      {
        key: 'carbon',
        label: 'Carbon',
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        fields: [
          { key: 'carbon_transactions', label: 'Carbon Transactions' },
          { key: 'carbon_infra', label: 'Carbon Infra' },
          { key: 'carbon_regulatory', label: 'Carbon Regulatory' },
        ],
      },
      {
        key: 'specialist',
        label: 'Specialist',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        fields: [
          { key: 'construction_specialist', label: 'Construction Specialist' },
          { key: 'regulatory_specialist', label: 'Regulatory Specialist' },
          { key: 'any_shipping_work', label: 'Any Shipping Work' },
        ],
      },
    ],
  },
  {
    key: 'ma',
    label: 'M&A',
    sections: [
      {
        key: 'renewables',
        label: 'Renewables',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        fields: [
          { key: 'ma_general', label: 'M&A' },
          { key: 'offshore_wind', label: 'Offshore Wind' },
          { key: 'onshore_wind', label: 'Onshore Wind' },
          { key: 'solar', label: 'Solar' },
          { key: 'hydro', label: 'Hydro' },
          { key: 'geothermal', label: 'Geothermal' },
          { key: 'battery_storage', label: 'Battery Storage' },
        ],
      },
      {
        key: 'power',
        label: 'Power',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        fields: [
          { key: 'power_conventional', label: 'Power Conventional' },
          { key: 'nuclear', label: 'Nuclear' },
          { key: 'waste_to_power', label: 'Waste-to-Power' },
        ],
      },
      {
        key: 'clean_tech',
        label: 'Clean Tech',
        color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
        fields: [
          { key: 'hydrogen', label: 'Hydrogen' },
          { key: 'ccus', label: 'CCUS' },
          { key: 'sustainable_fuels', label: 'Sustainable Fuels' },
        ],
      },
      {
        key: 'metals_mining',
        label: 'Metals & Mining',
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        fields: [
          { key: 'metals_mining', label: 'Metals & Mining' },
        ],
      },
      {
        key: 'oil_gas',
        label: 'Oil & Gas',
        color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
        fields: [
          { key: 'oil_gas', label: 'Oil & Gas' },
          { key: 'petchems', label: 'Petchems' },
        ],
      },
      {
        key: 'infrastructure',
        label: 'Infrastructure',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        fields: [
          { key: 'airports', label: 'Airports' },
          { key: 'ports_terminals', label: 'Ports & Terminals' },
          { key: 'roads_bridges_tunnels', label: 'Roads, Bridges & Tunnels' },
          { key: 'datacenters', label: 'Datacenters' },
          { key: 'dt_other', label: 'D&T: Other' },
          { key: 'power_transmission_grids', label: 'Power & Transmission Grids' },
          { key: 'rail', label: 'Rail' },
          { key: 'water_waste_management', label: 'Water & Waste Management' },
          { key: 'healthcare', label: 'Healthcare' },
          { key: 'other_social_infra', label: 'Other Social Infra' },
        ],
      },
    ],
  },
  {
    key: 'project_finance',
    label: 'Project Finance',
    sections: [
      {
        key: 'pf_general',
        label: 'Project Finance',
        color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
        fields: [
          { key: 'project_finance_general', label: 'Project Finance' },
          { key: 'renewables', label: 'Renewables' },
          { key: 'battery_storage', label: 'Battery Storage' },
          { key: 'conventional', label: 'Conventional' },
          { key: 'hydrogen', label: 'Hydrogen' },
          { key: 'ccus', label: 'CCUS' },
          { key: 'sustainable_fuels', label: 'Sustainable Fuels' },
          { key: 'metals_mining', label: 'Metals & Mining' },
          { key: 'oil_gas', label: 'Oil & Gas' },
          { key: 'petchems', label: 'Petchems' },
          { key: 'infrastructure', label: 'Infrastructure' },
          { key: 'ppp', label: 'PPP' },
        ],
      },
    ],
  },
];

// Get all unique expertise fields for filtering
export function getAllExpertiseFields(): { path: string; label: string; category: string }[] {
  const fields: { path: string; label: string; category: string }[] = [];
  
  for (const category of EXPERTISE_CATEGORIES) {
    for (const section of category.sections) {
      for (const field of section.fields) {
        fields.push({
          path: `${category.key}.${field.key}`,
          label: field.label,
          category: category.label,
        });
      }
    }
  }
  
  return fields;
}

// Get section color for a field
export function getSectionColor(categoryKey: string, fieldKey: string): string {
  const category = EXPERTISE_CATEGORIES.find(c => c.key === categoryKey);
  if (!category) return 'bg-gray-100 text-gray-800';
  
  for (const section of category.sections) {
    if (section.fields.some(f => f.key === fieldKey)) {
      return section.color;
    }
  }
  
  return 'bg-gray-100 text-gray-800';
}
