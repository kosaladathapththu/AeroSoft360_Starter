import { displayCode } from "./representative-reference";
import { financeMoney } from "./finance-utils";
export type PurchaseDraftLine = { material_id: number; quantity: string; unit_cost: string };
export default function PurchaseOrderLines({
  materials,
  lines,
  change,
}: {
  materials: any[];
  lines: PurchaseDraftLine[];
  change: (lines: PurchaseDraftLine[]) => void;
}) {
  const update = (index: number, key: keyof PurchaseDraftLine, value: string) =>
    change(
      lines.map((line, i) =>
        i === index ? { ...line, [key]: key === "material_id" ? Number(value) : value } : line,
      ),
    );
  return (
    <fieldset>
      <legend>Items to order</legend>
      {lines.map((line, index) => (
        <div className="purchase-draft-line" key={index}>
          <label>
            Material
            <select
              value={line.material_id || ""}
              onChange={(e) => update(index, "material_id", e.target.value)}
              required
            >
              <option value="">Choose material</option>
              {materials.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  disabled={lines.some((other, i) => i !== index && other.material_id === m.id)}
                >
                  {displayCode(m)} — {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Quantity
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={line.quantity}
                onChange={(e) => update(index, "quantity", e.target.value)}
                required
              />
            </label>
            <label>
              Unit cost (LKR)
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.unit_cost}
                onChange={(e) => update(index, "unit_cost", e.target.value)}
                required
              />
            </label>
          </div>
          <p>
            Line amount:{" "}
            <b>{financeMoney(Number(line.quantity || 0) * Number(line.unit_cost || 0))}</b>
          </p>
          <button
            type="button"
            disabled={lines.length === 1}
            onClick={() => change(lines.filter((_, i) => i !== index))}
          >
            Remove item
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => change([...lines, { material_id: 0, quantity: "", unit_cost: "" }])}
      >
        + Add material
      </button>
      <p>
        Purchase order total:{" "}
        <strong>
          {financeMoney(
            lines.reduce(
              (sum, line) =>
                sum +
                Math.round(Number(line.quantity || 0) * Number(line.unit_cost || 0) * 100) / 100,
              0,
            ),
          )}
        </strong>
      </p>
      <p className="report-note">
        Save this order as a draft, review it, then approve it before receiving goods.
      </p>
    </fieldset>
  );
}
