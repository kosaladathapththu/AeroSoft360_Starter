/** Display imported references as short stable codes without changing database keys. */
export function representativeReference(rep: { id?: number | string; code?: string | null }): string {
  if (!/^AR-R-[a-f0-9]{12}$/i.test(rep.code || "")) return rep.code || "Not assigned";
  return rep.id != null ? `REP-${String(rep.id).padStart(3, "0")}` : "Representative";
}
