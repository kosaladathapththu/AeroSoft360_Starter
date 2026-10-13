<?php

namespace App\Services\Payroll;

class PayrollExcelExporter
{
    public function attendance(object $import, iterable $rows): string
    {
        $data = $this->heading('Attendance Validation Report', $import->period_start, $import->period_end);
        $data[] = ['Employee No', 'Employee', 'Department', 'Paid Days', 'No-Pay Days', 'OT Hours'];
        $paid = $noPay = $overtime = 0;
        foreach ($rows as $row) {
            $data[] = [$row->employee_no, $row->name, $row->department, $row->paid_days, $row->no_pay_days, $row->overtime_hours];
            $paid += $row->paid_days;
            $noPay += $row->no_pay_days;
            $overtime += $row->overtime_hours;
        }
        $data[] = ['TOTAL', '', '', $paid, $noPay, $overtime];
        return $this->workbook('Attendance', $data, $import->period_start, $import->period_end);
    }

    public function payroll(object $run, iterable $rows): string
    {
        $data = $this->heading('Payroll Register - '.$run->number, $run->period_start, $run->period_end);
        $data[] = ['Employee No', 'Employee', 'Department', 'Paid Days', 'No-Pay Days', 'Basic Salary', 'OT Hours', 'OT Amount', 'No-Pay Deduction', 'EPF Employee', 'Other Deductions', 'Net Salary'];
        foreach ($rows as $row) {
            $data[] = [$row->employee_no, $row->name, $row->department, $row->paid_days, $row->no_pay_days, $row->basic_salary, $row->overtime_hours, $row->overtime, $row->no_pay_amount, $row->epf_employee, $row->other_deductions, $row->net_salary];
        }
        $data[] = ['TOTAL', '', '', '', '', $run->gross_total, '', '', '', '', $run->deduction_total, $run->net_total];
        return $this->workbook('Payroll Register', $data, $run->period_start, $run->period_end);
    }

    private function heading(string $title, string $from, string $to): array
    {
        return [
            ['SUPUN AEROSOFT (PVT) LTD'],
            ['318, K. Cyril C. Perera Mawatha, Colombo 13'],
            [$title],
            ['Reporting period', $from.' to '.$to],
            ['Generated', date('Y-m-d H:i')],
            [],
        ];
    }

    private function workbook(string $sheetName, array $rows, string $from, string $to): string
    {
        $xml = '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles>';
        $xml .= '<Style ss:ID="Default"><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#17365D"/></Style><Style ss:ID="Sub"><Font ss:Italic="1" ss:Color="#666666"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#17365D" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="Number"><NumberFormat ss:Format="#,##0.00;[Red](#,##0.00);-"/></Style><Style ss:ID="Total"><Font ss:Bold="1"/><Interior ss:Color="#DCEBED" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00;[Red](#,##0.00);-"/></Style></Styles>';
        $xml .= '<Worksheet ss:Name="'.$this->escape($sheetName).'"><Table>';
        for ($column = 0; $column < 12; $column++) {
            $xml .= '<Column ss:Width="'.($column < 3 ? 120 : 92).'"/>';
        }
        $last = count($rows) - 1;
        foreach ($rows as $index => $row) {
            $xml .= '<Row>';
            foreach ($row as $value) {
                $style = in_array($index, [0, 2], true) ? 'Title' : (in_array($index, [1, 3, 4], true) ? 'Sub' : ($index === 6 ? 'Header' : ($index === $last ? 'Total' : (is_numeric($value) ? 'Number' : 'Default'))));
                $type = is_numeric($value) ? 'Number' : 'String';
                $xml .= '<Cell ss:StyleID="'.$style.'"><Data ss:Type="'.$type.'">'.$this->escape((string) $value).'</Data></Cell>';
            }
            $xml .= '</Row>';
        }
        $xml .= '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Header x:Data="&amp;CSupun AeroSoft (Pvt) Ltd" xmlns:x="urn:schemas-microsoft-com:office:excel"/><Footer x:Data="&amp;L'.$this->escape($sheetName).'&amp;CPage &amp;P of &amp;N&amp;R'.$this->escape($from.' to '.$to).'" xmlns:x="urn:schemas-microsoft-com:office:excel"/></PageSetup><FreezePanes/><FrozenNoSplit/><SplitHorizontal>7</SplitHorizontal><TopRowBottomPane>7</TopRowBottomPane></WorksheetOptions></Worksheet></Workbook>';
        return $xml;
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
