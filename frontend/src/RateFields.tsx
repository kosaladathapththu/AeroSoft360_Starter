import { financeMoney } from "./finance-utils";

export default function RateFields({
  items,
  rate,
  change,
  articlePrice,
  givenRates,
  changeItem,
}: {
  items: any[];
  rate: number | string | null | undefined;
  change: (rate: number | null) => void;
  articlePrice?: number | string | null;
  givenRates?: Record<string, number>;
  changeItem?: (id: number, rate: number | null) => void;
}) {
  return (
    <div className="fixed-rate-fields">
      <div>
        <b>Fixed rate / piece</b>
        <div>
          {!items.length && (
            <div className="fixed-rate-empty" role="status">
              <strong>{articlePrice != null ? financeMoney(articlePrice) : "Fixed price not configured"}</strong>
              <small>
                {articlePrice != null ? "Saved article price. " : ""}
                No active sizes or set template are configured. Add them in Pricing List before ordering this article.
              </small>
            </div>
          )}
          {items.map((item) => (
            <span key={item.id}>
              Size {item.size_label}: {financeMoney(item.fixed_rate ?? item.unit_price)}{" "}
              {changeItem && <label className="size-given-rate">Given rate for size {item.size_label} (LKR)
                <input type="number" min="0" step="0.01" value={givenRates?.[item.id] ?? ""}
                  placeholder="Use fixed rate" onChange={(e) => changeItem(item.id, e.target.value === "" ? null : Number(e.target.value))} />
              </label>}
            </span>
          ))}
        </div>
      </div>
      {!changeItem && <label>
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
      </label>}
    </div>
  );
}
