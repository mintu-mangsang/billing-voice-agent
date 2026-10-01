import { RANGE_LABELS, type RangeKey } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RangeKey)}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
          <SelectItem key={k} value={k}>
            {RANGE_LABELS[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
