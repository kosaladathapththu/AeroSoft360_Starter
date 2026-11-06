import { financeMoney } from "./finance-utils";
import { setPricing, fixedItemRate } from "./rates";

export default function RateFields({
  items,
  rate,
  change,
  articlePrice,
  givenRates,
  changeItem,
  readOnly = false,
}: {
  items: any[];
  rate: number | string | null | undefined;
  change: (rate: number | null) => void;
  articlePrice?: number | string | null;
  givenRates?: Record<string, number>;
  changeItem?: (id: number, rate: number | null) => void;
  readOnly?: boolean;
}) {
  const summary = setPricing(
    {
      custom_rate: readOnly ? null : rate,
      given_rates: readOnly ? undefined : givenRates,
    },
    items,
  );
  const prices = [...new Set(items.map((item) => fixedItemRate({}, item)))];
  return (
    <div
      className={`fixed-rate-fields ${changeItem ? "custom-pricing" : "set-pricing"}`}
    >
      <div className="pricing-section-title">
        <b>{changeItem ? "Customized size pricing" : "Complete-set pricing"}</b>
        <small>
          Fixed prices come from the price list. All rates below are per piece.
        </small>
      </div>
      {!items.length ? (
        <div className="fixed-rate-empty" role="status">
          <strong>
            {articlePrice != null
              ? `${financeMoney(articlePrice)} / piece`
              : "Fixed price not configured"}
          </strong>
          <small>
            No active size template is configured. Add the original sizes and
            pack quantities in Pricing List before ordering.
          </small>
        </div>
      ) : changeItem ? (
        <div className="size-rate-table">
          <table>
            <thead>
              <tr>
                <th>Size / template</th>
                <th>Fixed price / piece</th>
                <th>Given price / piece (LKR)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>Size {item.size_label}</b>
                    {item.set_name && <small>{item.set_name}</small>}
                  </td>
                  <td>
                    <b>{financeMoney(fixedItemRate({}, item))}</b>
                  </td>
                  <td>
                    <input
                      aria-label={`Given price for size ${item.size_label}${item.set_name ? ` / ${item.set_name}` : ""}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={givenRates?.[item.id] ?? ""}
                      placeholder="Use fixed price"
                      onChange={(event) =>
                        changeItem(
                          item.id,
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                    <small>
                      Blank uses {financeMoney(fixedItemRate({}, item))} per
                      piece.
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="set-price-summary">
            <div>
              <small>Fixed price / piece</small>
              <strong>
                {prices.length === 1
                  ? financeMoney(prices[0])
                  : "Varies by size"}
              </strong>
            </div>
            <div>
              <small>Pieces per set</small>
              <strong>{summary.pieces}</strong>
            </div>
            <div className="set-price-total">
              <small>Fixed total / set</small>
              <strong>{financeMoney(summary.fixed)}</strong>
            </div>
          </div>
          <p className="set-price-formula">
            {prices.length === 1
              ? `${financeMoney(prices[0])} per piece x ${summary.pieces} pieces = ${financeMoney(summary.fixed)} per set.`
              : "Set total is the sum of each size's fixed price multiplied by its pack quantity."}
          </p>
          {readOnly ? (
            <details className="set-price-guidance">
              <summary>Pricing rules</summary>
              <p className="set-price-help">
              Complete sets use fixed size prices here. You can enter a
              customer-specific price when making the invoice. Use Customize to
              change prices for individual sizes.
              </p>
            </details>
          ) : (
            <div className="set-given-price">
              <label>
                Given price / piece for this invoice (LKR)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate ?? ""}
                  placeholder="Use fixed prices"
                  onChange={(event) =>
                    change(
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
                <small>
                  Applies to every piece in this complete set for this invoice
                  only.
                </small>
              </label>
              <div>
                <small>Invoice price / set</small>
                <strong>{financeMoney(summary.given)}</strong>
              </div>
            </div>
          )}
        </>
      )}
      {changeItem && (
        <p className="set-price-help">
          Each size keeps its fixed price visible. A given price affects only
          that size in this order or invoice; the price list is unchanged.
        </p>
      )}
    </div>
  );
}
