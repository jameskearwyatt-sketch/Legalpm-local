import { useState, useEffect, useCallback } from 'react';
import { ColumnConfig } from '@/components/matters/ColumnSettingsPopover';

type CategoryType = 'Live' | 'Pipeline' | 'Closed' | 'Lost';

// Default column configurations per category
const getDefaultColumns = (category: CategoryType): ColumnConfig[] => {
  const baseColumns: ColumnConfig[] = [
    { id: 'client_matter', label: 'Client / Matter', visible: true, locked: true },
  ];

  switch (category) {
    case 'Live':
      return [
        ...baseColumns,
        { id: 'financials', label: 'Financials (WIP/AR/Paid)', visible: true },
        { id: 'bm_burn', label: 'BM Burn %', visible: true },
        { id: 'local_burn', label: 'Local Burn %', visible: true },
        { id: 'burn_rate', label: 'BM Burn Rate', visible: true },
        { id: 'bm_headroom', label: 'BM Headroom', visible: true },
        { id: 'budget', label: 'Budget', visible: true },
        { id: 'bm_budget', label: 'BM Budget', visible: true },
        { id: 'local_budget', label: 'Local Budget', visible: true },
        { id: 'progress', label: 'Progress', visible: true },
        { id: 'practice', label: 'Practice Area', visible: true },
        { id: 'status', label: 'Status', visible: true },
        { id: 'actions', label: 'Actions', visible: true },
      ];
    case 'Pipeline':
      return [
        ...baseColumns,
        { id: 'budget', label: 'Budget', visible: true },
        { id: 'usd_value', label: 'USD Value', visible: true },
        { id: 'source', label: 'Source', visible: true },
        { id: 'clarif_date', label: 'Clarif. Date', visible: true },
        { id: 'submit_date', label: 'Submit Date', visible: true },
        { id: 'decision_date', label: 'Decision Date', visible: true },
        { id: 'submitted', label: 'Sent', visible: true },
        { id: 'outcome', label: 'Outcome', visible: true },
        { id: 'practice', label: 'Practice Area', visible: true },
        { id: 'actions', label: 'Actions', visible: true },
      ];
    case 'Closed':
      return [
        ...baseColumns,
        { id: 'budget', label: 'Budget', visible: true },
        { id: 'practice', label: 'Practice Area', visible: true },
        { id: 'status', label: 'Status', visible: true },
        { id: 'actions', label: 'Actions', visible: true },
      ];
    case 'Lost':
      return [
        ...baseColumns,
        { id: 'budget', label: 'Budget', visible: true },
        { id: 'usd_value', label: 'USD Value', visible: true },
        { id: 'source', label: 'Source', visible: true },
        { id: 'clarif_date', label: 'Clarif. Date', visible: true },
        { id: 'submit_date', label: 'Submit Date', visible: true },
        { id: 'decision_date', label: 'Decision Date', visible: true },
        { id: 'submitted', label: 'Sent', visible: true },
        { id: 'outcome', label: 'Outcome', visible: true },
        { id: 'practice', label: 'Practice Area', visible: true },
        { id: 'actions', label: 'Actions', visible: true },
      ];
    default:
      return baseColumns;
  }
};

const STORAGE_KEY = 'matters-column-settings';

interface StoredSettings {
  [key: string]: ColumnConfig[];
}

export function useColumnSettings(category: CategoryType) {
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredSettings = JSON.parse(stored);
        if (parsed[category]) {
          // Merge with defaults to ensure new columns are added
          const defaults = getDefaultColumns(category);
          const storedCols = parsed[category];
          
          // Keep order from stored, but ensure all default columns exist
          const storedIds = new Set(storedCols.map(c => c.id));
          const mergedColumns = [...storedCols];
          
          // Add any new columns that weren't in storage
          defaults.forEach(defaultCol => {
            if (!storedIds.has(defaultCol.id)) {
              mergedColumns.push(defaultCol);
            }
          });
          
          // Remove columns that no longer exist in defaults
          const defaultIds = new Set(defaults.map(c => c.id));
          const filteredColumns = mergedColumns.filter(c => defaultIds.has(c.id));
          
          // Ensure locked status is preserved from defaults
          return filteredColumns.map(col => ({
            ...col,
            locked: defaults.find(d => d.id === col.id)?.locked ?? false,
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load column settings:', e);
    }
    return getDefaultColumns(category);
  });

  // Persist to localStorage whenever columns change
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: StoredSettings = stored ? JSON.parse(stored) : {};
      parsed[category] = columns;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (e) {
      console.error('Failed to save column settings:', e);
    }
  }, [columns, category]);

  // Reset to default columns for this category
  const resetColumns = useCallback(() => {
    setColumns(getDefaultColumns(category));
  }, [category]);

  // Get visible columns in order
  const visibleColumns = columns.filter(c => c.visible);

  // Check if a column is visible
  const isColumnVisible = useCallback((columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    return col?.visible ?? false;
  }, [columns]);

  return {
    columns,
    setColumns,
    resetColumns,
    visibleColumns,
    isColumnVisible,
  };
}
