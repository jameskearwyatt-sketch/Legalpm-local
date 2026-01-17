import { useState, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COUNTRIES } from '@/lib/countries';
import { cn } from '@/lib/utils';

interface JurisdictionsMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function JurisdictionsMultiSelect({
  value = [],
  onChange,
  placeholder = 'Select jurisdictions...',
  disabled = false,
  className,
}: JurisdictionsMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const searchLower = search.toLowerCase();
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(searchLower) ||
        country.code.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const handleSelect = useCallback(
    (countryName: string) => {
      if (!value.includes(countryName)) {
        onChange([...value, countryName]);
      }
      setSearch('');
    },
    [value, onChange]
  );

  const handleRemove = useCallback(
    (countryName: string) => {
      onChange(value.filter((c) => c !== countryName));
    },
    [value, onChange]
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal h-auto min-h-10',
              !value.length && 'text-muted-foreground'
            )}
          >
            {value.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {value.map((country) => (
                  <Badge
                    key={country}
                    variant="secondary"
                    className="mr-1 mb-1"
                  >
                    {country}
                    <button
                      type="button"
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove(country);
                      }}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove {country}</span>
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              placeholder
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
          <ScrollArea className="h-[200px]">
            <div className="p-2 pt-0">
              {filteredCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No countries found
                </p>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected = value.includes(country.name);
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleSelect(country.name)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors',
                        isSelected && 'bg-primary/10 text-primary font-medium'
                      )}
                    >
                      <span className="mr-2 text-muted-foreground">
                        {country.code}
                      </span>
                      {country.name}
                      {isSelected && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (selected)
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
