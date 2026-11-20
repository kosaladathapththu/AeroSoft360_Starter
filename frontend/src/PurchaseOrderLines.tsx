import { useState } from "react";
import { Plus } from "lucide-react";
import ItemSearchSelect from "./ItemSearchSelect";
import { displayCode } from "./representative-reference";
import { financeMoney } from "./finance-utils";
export type PurchaseDraftLine = { material_id: number; quantity: string; unit_cost: string };
type MaterialDraft = { code: string; name: string; category: string; unit: string };
type PurchaseMaterial = { id: number; code: string; name: string; category: string; unit: string };
const emptyMaterial: MaterialDraft = { code: "", name: "", category: "raw_material", unit: "" };

export default function PurchaseOrderLines({
  materials,
  lines,
  change,
  createMaterial,
}: {
  materials: any[];
  lines: PurchaseDraftLine[];
  change: (lines: PurchaseDraftLine[]) => void;
  createMaterial: (material: MaterialDraft) => Promise<PurchaseMaterial>;
}) {
  const [creatingFor, setCreatingFor] = useState<number | null>(null);
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(emptyMaterial);
  const [materialError, setMaterialError] = useState("");
  const [materialBusy, setMaterialBusy] = useState(false);
  const update = (index: number, key: keyof PurchaseDraftLine, value: string) =>
    change(
      lines.map((line, i) =>
        i === index ? { ...line, [key]: key === "material_id" ? Number(value) : value } : line,
      ),
    );
  const addMaterial = async (index: number) => {
    setMaterialBusy(true);
    setMaterialError("");
    try {
      const material = await createMaterial({
        code: materialDraft.code.trim(),
        name: materialDraft.name.trim(),
        category: materialDraft.category.trim(),
        unit: materialDraft.unit.trim(),
      });
      update(index, "material_id", String(material.id));
      setMaterialDraft(emptyMaterial);
      setCreatingFor(null);
    } catch (error) {
      setMaterialError((error as Error).message);
    } finally {
      setMaterialBusy(false);
    }
  };
  return (
    <fieldset>
      <legend>Items to order</legend>
      {lines.map((line, index) => (
        <div className="purchase-draft-line" key={index}>
          <div className="purchase-material-field">
            <label>
              Material
              <ItemSearchSelect
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
              </ItemSearchSelect>
            </label>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setMaterialError("");
                setMaterialDraft(emptyMaterial);
                setCreatingFor(creatingFor === index ? null : index);
              }}
            >
              <Plus /> Add new material
            </button>
          </div>
          {creatingFor === index && (
            <div className="purchase-new-material">
              <div className="form-row">
                <label>
                  Material code
                  <input
                    value={materialDraft.code}
                    maxLength={40}
                    onChange={(event) =>
                      setMaterialDraft({ ...materialDraft, code: event.target.value })
                    }
                    autoComplete="off"
                  />
                </label>
                <label>
                  Material name
                  <input
                    value={materialDraft.name}
                    maxLength={160}
                    onChange={(event) =>
                      setMaterialDraft({ ...materialDraft, name: event.target.value })
                    }
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Category
                  <input
                    value={materialDraft.category}
                    maxLength={30}
                    onChange={(event) =>
                      setMaterialDraft({ ...materialDraft, category: event.target.value })
                    }
                    placeholder="raw_material"
                  />
                </label>
                <label>
                  Unit
                  <input
                    value={materialDraft.unit}
                    maxLength={20}
                    onChange={(event) =>
                      setMaterialDraft({ ...materialDraft, unit: event.target.value })
                    }
                    placeholder="PCS, KG, LTR…"
                  />
                </label>
              </div>
              {materialError && <div className="error" role="alert">{materialError}</div>}
              <div className="purchase-new-material-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={
                    materialBusy ||
                    !materialDraft.code.trim() ||
                    !materialDraft.name.trim() ||
                    !materialDraft.category.trim() ||
                    !materialDraft.unit.trim()
                  }
                  onClick={() => addMaterial(index)}
                >
                  {materialBusy ? "Adding…" : "Add and select material"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={materialBusy}
                  onClick={() => setCreatingFor(null)}
                >
                  Cancel
                </button>
              </div>
              <p className="report-note">Stock is added when you receive the goods.</p>
            </div>
          )}
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
