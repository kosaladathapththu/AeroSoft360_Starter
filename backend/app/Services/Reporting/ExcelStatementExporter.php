<?php
namespace App\Services\Reporting;
class ExcelStatementExporter
{
    public function make(array $r, string $only = "all"): string
    {
        $sets = [
            "summary" => ["Summary", $this->summary($r)],
            "profit_loss" => ["Profit and Loss", $this->profitLoss($r)],
            "balance_sheet" => ["Balance Sheet", $this->balanceSheet($r)],
            "cash_flow" => ["Cash Flow", $this->cashFlow($r)],
            "trial_balance" => ["Trial Balance", $this->trialBalance($r)],
        ];
        $s = [];
        foreach ($sets as $key => [$name, $rows]) {
            if ($only === "all" || $only === $key) {
                $s[] = $this->sheet($name, $rows, $r["period"]);
            }
        }
        return '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default"><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#17365D"/></Style><Style ss:ID="Sub"><Font ss:Italic="1" ss:Color="#666666"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#17365D" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="Money"><NumberFormat ss:Format="#,##0.00;[Red](#,##0.00);-"/></Style></Styles>' .
            implode("", $s) .
            "</Workbook>";
    }
    private function base(string $title, array $period): array
    {
        return [
            ["SUPUN AEROSOFT (PVT) LTD"],
            ["318, K. Cyril C. Perera Mawatha, Colombo 13"],
            [$title],
            ["Reporting period", $period["from"] . " to " . $period["to"]],
            ["Prepared", date("Y-m-d H:i")],
            [],
        ];
    }
    private function summary($r): array
    {
        return [
            ...$this->base("Financial Statements Summary", $r["period"]),
            ["Metric", "LKR"],
            ["Revenue", $r["profit_loss"]["revenue"]],
            ["Expenses", $r["profit_loss"]["expenses_total"]],
            ["Net profit", $r["profit_loss"]["net_profit"]],
            ["Total assets", $r["balance_sheet"]["assets_total"]],
            ["Total liabilities", $r["balance_sheet"]["liabilities_total"]],
            ["Total equity", $r["balance_sheet"]["equity_total"]],
            ["Liabilities and equity", $r["balance_sheet"]["liabilities_equity_total"]],
            ["Balance check", $r["balance_sheet"]["difference"]],
            ["Net cash change", $r["cash_flow"]["net_change"]],
        ];
    }
    private function profitLoss($r): array
    {
        $x = [...$this->base("Profit and Loss Statement", $r["period"]), ["Account", "LKR"]];
        foreach ($r["profit_loss"]["income"] as $v) {
            $x[] = [$v["code"] . " " . $v["account"], $v["amount"]];
        }
        $x[] = ["Total revenue", $r["profit_loss"]["revenue"]];
        foreach ($r["profit_loss"]["expenses"] as $v) {
            $x[] = [$v["code"] . " " . $v["account"], $v["amount"]];
        }
        $x[] = ["Total expenses", $r["profit_loss"]["expenses_total"]];
        $x[] = ["Net profit", $r["profit_loss"]["net_profit"]];
        return $x;
    }
    private function balanceSheet($r): array
    {
        $x = [...$this->base("Balance Sheet", $r["period"]), ["ASSETS", "LKR"]];
        foreach ($r["balance_sheet"]["assets"] as $v) {
            $x[] = [$v["code"] . " " . $v["account"], $v["amount"]];
        }
        $x[] = ["Total assets", $r["balance_sheet"]["assets_total"]];
        $x[] = [];
        $x[] = ["LIABILITIES", "LKR"];
        foreach ($r["balance_sheet"]["liabilities"] as $v) {
            $x[] = [$v["code"] . " " . $v["account"], $v["amount"]];
        }
        $x[] = ["Total liabilities", $r["balance_sheet"]["liabilities_total"]];
        $x[] = [];
        $x[] = ["EQUITY", "LKR"];
        foreach ($r["balance_sheet"]["equity"] as $v) {
            $x[] = [$v["code"] . " " . $v["account"], $v["amount"]];
        }
        $x[] = ["Current-period profit", $r["balance_sheet"]["current_profit"]];
        $x[] = ["Total equity", $r["balance_sheet"]["equity_total"]];
        $x[] = ["Total liabilities and equity", $r["balance_sheet"]["liabilities_equity_total"]];
        $x[] = ["Balance difference", $r["balance_sheet"]["difference"]];
        return $x;
    }
    private function cashFlow($r): array
    {
        return [
            ...$this->base("Cash Flow Statement", $r["period"]),
            ["Activity", "LKR"],
            ["Opening cash and bank", $r["cash_flow"]["opening_balance"] ?? 0],
            ["Operating activities", $r["cash_flow"]["operating"]],
            ["Investing activities", $r["cash_flow"]["investing"]],
            ["Financing activities", $r["cash_flow"]["financing"]],
            ["Unclassified activities", $r["cash_flow"]["unclassified"] ?? 0],
            ["Net change in cash", $r["cash_flow"]["net_change"]],
            ["Closing cash and bank", $r["cash_flow"]["closing_balance"] ?? 0],
            ["Reconciliation difference", $r["cash_flow"]["reconciliation_difference"] ?? 0],
        ];
    }
    private function trialBalance($r): array
    {
        $x = [
            ...$this->base("Trial Balance", $r["period"]),
            ["Code", "Account", "Type", "Debit", "Credit", "Balance"],
        ];
        foreach ($r["trial_balance"] as $v) {
            $x[] = [
                $v["code"],
                $v["account"],
                $v["type"],
                $v["debit"],
                $v["credit"],
                $v["balance"],
            ];
        }
        return $x;
    }
    private function sheet(string $name, array $rows, array $period): string
    {
        $xml =
            '<Worksheet ss:Name="' .
            $this->e($name) .
            '"><Table><Column ss:Width="230"/><Column ss:Width="130"/><Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="100"/>';
        foreach ($rows as $i => $row) {
            $xml .= "<Row>";
            foreach ($row as $v) {
                $style = in_array($i, [0, 2], true)
                    ? "Title"
                    : ($i === 1 || in_array($i, [3, 4], true)
                        ? "Sub"
                        : ($i === 6
                            ? "Header"
                            : (is_numeric($v)
                                ? "Money"
                                : "Default")));
                $type = is_numeric($v) ? "Number" : "String";
                $xml .=
                    '<Cell ss:StyleID="' .
                    $style .
                    '"><Data ss:Type="' .
                    $type .
                    '">' .
                    $this->e((string) $v) .
                    "</Data></Cell>";
            }
            $xml .= "</Row>";
        }
        $xml .=
            '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Header x:Data="&amp;CSupun AeroSoft (Pvt) Ltd" xmlns:x="urn:schemas-microsoft-com:office:excel"/><Footer x:Data="&amp;L' .
            $this->e($name) .
            "&amp;CPage &amp;P of &amp;N&amp;R" .
            $this->e($period["from"] . " to " . $period["to"]) .
            '" xmlns:x="urn:schemas-microsoft-com:office:excel"/></PageSetup><FreezePanes/><FrozenNoSplit/><SplitHorizontal>7</SplitHorizontal><TopRowBottomPane>7</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>';
        return $xml;
    }
    private function e(string $v): string
    {
        return htmlspecialchars($v, ENT_XML1 | ENT_QUOTES, "UTF-8");
    }
}
