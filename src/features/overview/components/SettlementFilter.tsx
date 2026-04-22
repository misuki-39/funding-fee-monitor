import type { SettlementFilter } from "../../../shared/types/market.js";
import { Button } from "../../../shared/ui/Button.js";
import styles from "./SettlementFilter.module.css";

const filters: { value: SettlementFilter; label: string }[] = [
  { value: "1h", label: "Within 1h" },
  { value: "4h", label: "Within 4h" },
  { value: "all", label: "No Filter" }
];

interface SettlementFilterProps {
  value: SettlementFilter;
  disabled?: boolean;
  onChange: (value: SettlementFilter) => void;
}

export function SettlementFilter({ value, disabled = false, onChange }: SettlementFilterProps) {
  return (
    <section className={styles.filters}>
      <span className={styles.label}>Settlement Filter</span>
      <div className={styles.group}>
        {filters.map((filter) => {
          const isActive = filter.value === value;

          return (
            <Button
              key={filter.value}
              variant="secondary"
              className={isActive ? styles.active : ""}
              disabled={disabled}
              onClick={() => onChange(filter.value)}
            >
              {filter.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
