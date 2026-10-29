import { financeMoney } from "./finance-utils";

export default function RateFields({
  items,
  rate,
  change,
}: {
  items: any[];
  rate: number | string | null | undefined;
  change: (rate: number | null) => void;
}) {
  return (
    <div className="fixed-rate-fields">
      <div>
        <b>Fixed rate / piece</b>
        <div>
          {items.map((item) => (
            <span key={item.id}>
              Size {item.size_label}: {financeMoney(item.fixed_rate ?? item.unit_price)}{" "}
            </span>
          ))}
        </div>
      </div>
      <label>
        Given rate / piece (LKR)
        <input
          type="number"
          min="0"
          step="0.01"
          value={rate ?? ""}
          placeholder="Use fixed rates"
          onChange={(e) => change(e.target.value === "" ? null : Number(e.target.value))}
        />
        <small>
          Optional. Applies to the selected sizes and colours in this article. Totals use the given
          rate.
        </small>
      </label>
    </div>
  );
}
