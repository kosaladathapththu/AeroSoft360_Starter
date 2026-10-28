export const financeToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
export const financeMoney = (value: unknown) =>
  `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const activityLabel = (activity: string) =>
  ({
    operating: "Operating",
    investing: "Investing",
    financing: "Financing",
    unclassified: "Needs classification",
  })[activity] || activity;
export function financeCsv(filename: string, rows: unknown[][]) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const url = URL.createObjectURL(
    new Blob(["\ufeff", rows.map((row) => row.map(cell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function financeRequest(
  api: string,
  token: string,
  path: string,
  body?: any,
  method = "GET",
) {
  const response = await fetch(`${api}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      Object.values(result.errors || {})
        .flat()
        .join(" ") ||
        result.message ||
        "Unable to load finance data.",
    );
  return result;
}
