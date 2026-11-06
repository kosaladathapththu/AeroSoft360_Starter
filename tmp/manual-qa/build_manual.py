from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from pathlib import Path

ROOT=Path('D:/Local Repository/AeroSoft360_Starter')
OUT=ROOT/'output/system-manual/AeroSoft360_System_and_Operating_Manual.docx'
doc=Document()
s=doc.sections[0]
s.page_width=Inches(8.27); s.page_height=Inches(11.69)
s.top_margin=Inches(.7); s.bottom_margin=Inches(.7)
s.left_margin=Inches(.8); s.right_margin=Inches(.8)
s.header_distance=Inches(.3); s.footer_distance=Inches(.3)
for name,size in [('Normal',11),('Title',28),('Subtitle',13),('Heading 1',19),('Heading 2',13),('Heading 3',11)]:
 st=doc.styles[name]; st.font.name='Calibri'; st.font.size=Pt(size); st.font.color.rgb=RGBColor(0,0,0)
 st.paragraph_format.space_after=Pt(7)
 st.paragraph_format.line_spacing=1.12
 if name.startswith('Heading'): st.paragraph_format.space_before=Pt(12)
doc.styles['Normal'].paragraph_format.widow_control=True
for name in ['List Number','List Bullet']:
 doc.styles[name].font.name='Calibri'; doc.styles[name].font.size=Pt(11)
 doc.styles[name].font.color.rgb=RGBColor(0,0,0)
 doc.styles[name].paragraph_format.space_after=Pt(6)
 doc.styles[name].paragraph_format.line_spacing=1.1
h=s.header.paragraphs[0]; h.text='AEROSOFT360  |  SYSTEM AND OPERATING MANUAL'
h.runs[0].font.size=Pt(8); h.runs[0].font.color.rgb=RGBColor(0,0,0)
f=s.footer.paragraphs[0]; f.alignment=WD_ALIGN_PARAGRAPH.RIGHT
f.add_run('Version 1.0  |  3 November 2026  |  Page ').font.size=Pt(8)
fld=OxmlElement('w:fldSimple'); fld.set(qn('w:instr'),'PAGE'); f._p.append(fld)
f.add_run(' of ').font.size=Pt(8)
fld=OxmlElement('w:fldSimple'); fld.set(qn('w:instr'),'NUMPAGES'); f._p.append(fld)
COLORS=['19765B','8A354A','A56B16','426D52']
def p(t,style=None): return doc.add_paragraph(t,style)
def lead(label,t):
 z=p(''); z.add_run(label+' ').bold=True; z.add_run(t); return z
def heading(t): doc.add_heading(t,2)
def steps(items):
 for i,t in enumerate(items,1):
  z=p(''); z.paragraph_format.left_indent=Inches(.18); z.paragraph_format.first_line_indent=Inches(-.18)
  z.add_run(str(i)+'. ').bold=True; z.add_run(t)
def bullets(items):
 for t in items:p(t,'List Bullet')
def table(headers,rows,widths):
 t=doc.add_table(rows=1,cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
 for i,w in enumerate(widths): t.columns[i].width=Inches(w)
 for c,v in zip(t.rows[0].cells,headers): c.text=v
 repeat=OxmlElement('w:tblHeader'); t.rows[0]._tr.get_or_add_trPr().append(repeat)
 for row in rows:
  for c,v in zip(t.add_row().cells,row): c.text=str(v)
 for ri,row in enumerate(t.rows):
  for ci,c in enumerate(row.cells):
   c.width=Inches(widths[ci]); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   pr=c._tc.get_or_add_tcPr(); shade=OxmlElement('w:shd'); shade.set(qn('w:fill'),'333333' if ri==0 else ('F4F2EE' if ri%2 else 'FFFFFF')); pr.append(shade)
   borders=OxmlElement('w:tcBorders')
   for edge in ['top','left','bottom','right']:
    e=OxmlElement('w:'+edge); e.set(qn('w:val'),'single'); e.set(qn('w:sz'),'4'); e.set(qn('w:color'),'D9D9D9'); borders.append(e)
   pr.append(borders); margins=OxmlElement('w:tcMar')
   for edge in ['top','left','bottom','right']:
    e=OxmlElement('w:'+edge); e.set(qn('w:w'),'100'); e.set(qn('w:type'),'dxa'); margins.append(e)
   pr.append(margins)
   for z in c.paragraphs:
    z.paragraph_format.space_after=Pt(2); z.paragraph_format.line_spacing=1.05
    for r in z.runs:r.font.size=Pt(10); r.font.bold=ri==0; r.font.color.rgb=RGBColor.from_string('FFFFFF' if ri==0 else '000000')
 p('')
def page(n,title,area):
 doc.add_page_break()
 z=p(area.upper()); z.runs[0].font.color.rgb=RGBColor.from_string(COLORS[(n-1)%4]); z.runs[0].bold=True; z.runs[0].font.size=Pt(9)
 doc.add_heading(str(n)+'  '+title,1)

p('AeroSoft360 System and Operating Manual','Title')
p('Implemented features and step by step working procedures','Subtitle')
p('Prepared for the AeroSoft360 business and system administration team')
lead('Document date','3 November 2026 | Version 1.0 | Currency LKR')
p('This manual explains the features present in the current application and how users move from setup to orders, stock movements, invoices, payments and financial reporting. It is intended for operators, accounts staff, managers and administrators. It also identifies limits that affect how the system should be used.')
p('The normal sales route is Sales Order → Dispatch and Invoice → Customer Collection. Quotations and customer purchase orders are optional starting documents. The normal purchasing route is Purchase Order → Goods Received Note → Purchase Invoice → Supplier Payment. Posted transactions feed the related stock records, subledgers and general ledger where accounting integration is implemented.')
heading('How to use this manual')
p('Read sections 1 to 4 before entering transactions. Follow the numbered procedures for the relevant activity. Check the expected result before repeating a submission. Use sections 17 to 20 for reconciliations, exceptions and implementation boundaries.')
table(['Part','Sections','Purpose'],[
 ('System and preparation','1–4','Scope, navigation, master records and opening balances'),
 ('Sales and customer service','5–10','Orders, invoices, collections, profiles, returns and serials'),
 ('Purchasing and inventory','11–12','Supplier workflow, stock imports and movements'),
 ('Finance and people','13–16','Account hierarchy, payments, journals and payroll'),
 ('Control and reference','17–20','Reports, daily controls, limitations and evidence')],[1.65,.8,4.22])
lead('Evidence basis','Current repository routes, screens, business services and workflow notes were reviewed. The data figures in section 2 are the verified cleanup snapshot from 2 November 2026, not a claim that no transactions have been entered since then. This document does not certify statutory compliance or production readiness.')

page(1,'System scope and implemented modules','System overview')
p('AeroSoft360 combines customer sales and receivables with procurement, inventory and financial records. Its current screens form a connected business application; a record entered at an earlier stage is reused by later stages instead of being typed again.')
table(['Area','Implemented facilities'],[
 ('Sales','Quotations, customer POs, sales orders, itemized invoicing, POS, collections, aging, commissions and sales returns'),
 ('People and products','Customers, salespersons, pricing lists, categories, brands, units, employees and payroll'),
 ('Purchasing','Purchase orders, approval, partial GRNs, receipt-linked supplier invoices, supplier payments and supported purchase returns'),
 ('Inventory','Raw material batches, finished article and size quantities, imports, adjustments, movement ledgers, serials and warranties'),
 ('Finance','Chart of Accounts and subaccounts, opening balances, payment vouchers, cash flow, party ledgers, journals and recurring entries'),
 ('Management','Report centre, print and export facilities, cashier closing, account access and transaction audit controls')],[1.25,5.42])
heading('How the records connect')
p('Customer documents retain customer and salesperson links. Article details and fixed price snapshots pass from new orders into subsequent invoices. Dispatch and returns affect finished stock. Customer collections and credit notes affect the outstanding invoice balance and customer ledger. Supplier receipts affect raw material stock and the receipt liability; the supplier invoice registers the bill against that receipt.')
lead('Accounting foundation','The posting service checks balanced debit and credit totals, permitted posting accounts and open accounting periods. Duplicate source protection helps prevent the same transaction from posting twice. A saved draft is not equivalent to a posted financial transaction.')
lead('Scope boundary','The current application is not a complete manufacturing planning or product costing suite. Do not assume that catalogue prices calculate production cost, that every report has a complete source module, or that a screen label alone proves an end-to-end process exists.')

page(2,'Current data and readiness','Operational baseline')
p('The following figures describe the reconciled state after the authorized cleanup on 2 November 2026. They provide a baseline for reviewing the application; later legitimate business transactions may change them.')
table(['Retained record','Verified baseline'],[
 ('Real imported customers','159'),('Imported opening receivables','343'),('Opening receivables value','LKR 23,120,293.00'),('Non-demo catalogue articles','223'),('Real salesperson names','5'),('Login accounts retained','4'),('AR general ledger control','LKR 23,120,293.00'),('Trial balance totals','Debits and credits each LKR 23,120,293.00')],[3.1,3.57])
heading('Imported receivables')
p('The source was AR ( AMOUNTS RECEIVBLE).xlsx. Original invoice dates range from 28 March 2024 to 17 October 2026. Credit-day fields were blank and were left blank as instructed. The import retained the original invoice references and created unique internal references where a source invoice number appeared against different customers.')
p('These records are opening receivables, not newly generated itemized sales. Their opening journals were posted on 2 November 2026 against Opening Balance Equity. Original invoice dates and the accounting posting date serve different purposes. Historical reports must be read using their stated date basis.')
heading('What was removed and what is still needed')
p('Demo and tested customers, orders, invoices, collections, suppliers, purchasing records, employees, payroll fixtures and their related test journals were removed. Real customers, receivables, product prices, classifications, account setup and login accounts were preserved. The cleanup retained audit history and a private backup.')
lead('Stock preparation required','Artificial finished-stock quantities were cleared. Real opening stock must be loaded from an actual count before dispatching goods. The preserved price list describes selling prices and set templates; it does not establish available inventory.')
lead('Credit terms required','Review customer terms and original due dates before relying on overdue classifications. A balance with no due date must remain identifiable as Terms not set rather than being assigned invented credit days.')

page(3,'Navigation search and common controls','Getting started')
steps(['Sign in using your assigned account. The available actions depend on its permissions; viewing a page does not necessarily grant permission to post or delete.', 'Use the left navigation groups to open Sales, People and Products, Purchasing, Inventory, Finance and Reports, or Administration. The workspace label identifies the current page.', 'Use the top search box to find pages, report names and supported business records. Enter a meaningful customer name, document number, article code or descriptive words. Search normalizes case and punctuation and matches words across supported indexed fields.', 'Select the appropriate search result to open its module or record context. If a result is missing, try its document number or the relevant module filters and refresh the data.', 'In forms, complete required fields and review dates, quantities, prices and accounts. Scroll the dialog body to see all fields; the header and action footer stay separate from the scrolling form.', 'Submit once and wait for completion. Check the confirmation and generated document reference, then verify the new row or detail view before retrying. A validation message means a required business rule was not met.'])
heading('Common action meanings')
table(['Action','Meaning'],[('View','Inspect the record and its linked details without changing it'),('Edit','Change permitted fields; provide a reason where required'),('Delete or cancel','Use the supported guarded action and supply a reason; linked or posted records may be protected'),('Post','Create the final accounting or stock effect for that workflow'),('Print or PDF','Open the formatted print view and choose a printer or Save as PDF'),('Download','Save the format offered by that screen; export formats differ between modules')],[1.35,5.32])
lead('Reasons and audit trail','Give a specific reason such as “Customer reduced size 42 quantity from 4 to 2” rather than “changed”. Reasons explain the business event; they do not override validation or permit changes to protected history.')

page(4,'Master records and opening balances','Initial setup')
heading('Create a customer')
steps(['Open People and Products → Customers and select Add Customer. Enter a recognizable customer name, code and contact information.', 'Enter the agreed credit limit and credit terms when known. Leave unknown credit days blank; do not invent a due date. Check for an existing customer before creating a duplicate.', 'If there is a brought-forward balance, enter its amount, balance date and balance type. Select receivable when the customer owes the business or customer credit when the business holds credit for the customer.', 'Provide the original due date when available and select the opening equity account, normally 3990. Review the balance separately from the contact fields before saving.', 'Open the customer profile and ledger. Confirm that the brought-forward balance appears once, at the correct date, and that it reconciles to Accounts Receivable.'])
lead('Opening accounting','A receivable opening debits 1100 Accounts Receivable and credits the selected equity account. A customer credit reverses those sides. These entries are excluded from new sales and cash receipt turnover. Collection of an opening receivable does not generate a sales commission.')
heading('Prepare products and other masters')
p('Maintain article codes, full names, sizes, colours, fixed prices and set templates in Pricing List. Categories, brands and units classify those articles. Preview price-list imports and review the resulting definitions. Record salespersons and use Access Control for their permitted login access. Create suppliers and material definitions before using purchasing or raw stock imports.')
heading('Update missing terms later')
p('When valid customer credit days are added later, the application can fill previously missing opening-invoice due dates from the original invoice date. Existing due dates are preserved and the change is audited. Recheck Terms not set balances and aging after the update.')
lead('Avoid duplicate openings','Do not enter the same receivable as both a customer opening and a manual control-account journal. Posted openings are protected from normal invoice or contact edits. Corrections require accountant review and an appropriate correcting entry.')

page(5,'Create and review a sales order','Sales procedure')
p('Start with a direct sales order when the customer is ready to order. Use a quotation for an offer and record a customer PO when one has been supplied. These optional documents are separate from supplier purchase orders.')
steps(['Open Dashboard → Create sales order or Sales → Sales Orders. Choose an existing customer or create a new customer within the entry process.', 'Confirm the salesperson, order date, credit or cash sale type and customer PO reference where applicable. Review the customer details before continuing.', 'Add an article. Search by code or name and confirm the full article name shown with the selection. Use the details control when further article information is needed.', 'Choose Complete set to use the selected set template and number of sets, or Customize to enter the required sizes and colours. Review the resulting total pieces.', 'Compare Fixed rate per piece with Given rate per piece. Leave the given rate blank to use the size fixed rates, or enter the agreed selling rate. Review line totals after any change.', 'Continue to review the order. Check every article, size, colour, quantity and amount. Enter a clear reason when changing reviewed quantities or removing a size line.', 'Create the order and wait for the confirmation. Record its generated reference. Open the saved sales order and verify the customer, pieces and total before arranging dispatch.'])
heading('Expected result')
p('The saved order provides a traceable instruction for supply. Creating an order does not itself establish that stock was delivered or that money was received. Dispatch and invoicing record the supplied quantities; Collections records later customer payment.')
lead('Optional quotation route','Create the offer, check validity and convert an accepted quotation using its available action. Conversion carries the items into linked customer PO and sales-order records. Expired quotations cannot be converted, and converted quotations are protected from ordinary editing.')
lead('Optional customer PO route','Review a draft customer PO and create its sales order. Download an individual PO from its row or use Download full PO report for the register. The displayed download action belongs to customer POs; supplier purchasing is a separate workflow.')

page(6,'Fixed rates invoicing and bills','Sales procedure')
heading('Understand the two prices')
p('Fixed rate is the saved catalogue reference price. Given rate is the actual agreed selling price used to calculate the transaction. The fixed rate is not added to the selling price. New order price snapshots are carried forward so later catalogue changes do not rewrite historical reference prices.')
lead('Example','For 3 pieces with a fixed rate of LKR 1,450 and a given rate of LKR 1,400, the line selling value is LKR 4,200 before invoice adjustments. The reference value is not an additional charge. This is a worked example, not an existing business transaction.')
heading('Dispatch and invoice')
steps(['Open the confirmed sales order and select Dispatch and invoice. Check the customer and original order reference.', 'Enter only the quantities actually supplied for each line. For a partial delivery, leave the undispatched balance open. Do not use the ordered quantity when fewer pieces were handed over.', 'Check available article and size stock. Provide exact serial numbers when the article is serial tracked. Resolve stock or serial validation errors before posting.', 'Review fixed and given rates and any permitted discount, charges or tax. Confirm the invoice date and totals.', 'Post the dispatch invoice. The system creates the invoice, reduces the dispatched stock and posts its accounting effects together. Confirm the invoice reference and remaining order balance.', 'Open the invoice bill, check its customer, items, quantities, rates, totals and payment or credit references, then print it or choose Save as PDF.'])
heading('Financial result and historical protection')
p('The invoice creates the customer receivable and sales-related journal entries, with tax where applicable. Subsequent collections reduce that receivable; returns create separate credits. The original invoice remains the sales document rather than being overwritten by later returns.')
lead('Older records','Where a historical fixed-price snapshot was never recorded, the screen shows Not recorded. Imported opening AR has no item lines and cannot produce the same item detail as a new itemized invoice. Do not infer missing products from its monetary amount.')
lead('Other entry routes','Manual invoicing is available for supported direct entries, and Point of Sale combines invoicing and payment for immediate counter sales. Use the order route when tracking ordered versus supplied quantities is important.')

page(7,'Collections commissions and counter sales','Customer payment')
heading('Record a customer collection')
steps(['Open Sales → Collections and choose the outstanding invoice. Confirm the customer, invoice reference and remaining amount.', 'Enter the cash collector, receipt date and collection type. Choose the payment method and an active posting cash or bank account.', 'Enter the amount actually received and its reference. A partial receipt must not exceed the outstanding balance; a final settlement must match the remaining amount.', 'Choose the commission decision offered by the form: original invoice salesperson, collector or cancellation, as applicable. Check eligibility and supporting approval.', 'Save once, check the receipt reference and confirm that the invoice outstanding balance and customer profile both update. Retain the payment reference for reconciliation.'])
lead('Accounting effect','The collection debits the selected cash or bank account and credits Accounts Receivable. Eligible commission entries are linked to the collection and post the corresponding expense and payable. Collection of imported opening AR is excluded from sales commission.')
heading('Commission review')
p('Commission eligibility depends on the configured policy and collection timing. The piece basis can be proportional to the collected value. Review the linked invoice, salesperson, collection and policy before making manual adjustments. The manual commission screen supports a reason or approval reference. A return does not automatically claw back an already earned commission; management must review the commission separately.')
heading('Immediate counter sale')
steps(['Open Sales → Point of Sale. Select the customer and articles, enter quantities and confirm current prices.', 'Choose the payment account and payment details. Supply serials for every unit when serial tracking is required.', 'Review the total, then complete checkout once. The system creates an invoice and payment together and records the stock movement.', 'Check both invoice and receipt references and print the bill. If uncertain whether checkout completed, inspect the saved result before starting another sale.'])
lead('Account selection','Pay from and receive into lists intentionally show eligible cash and bank accounts rather than every Chart of Accounts entry. Expense, revenue, receivable and parent-group accounts are not money sources. Create suitable posting cash or bank accounts in the chart when more choices are required.')

page(8,'Customer profile aging and ledgers','Customer review')
steps(['Open People and Products → Customers and select the View action for the customer.', 'Check contact details, salesperson, credit terms and credit limit in the overview. Review receivables and customer credits separately before assessing net exposure.', 'Set the relevant as-of date or period. Inspect outstanding invoices and aging, including balances with missing terms.', 'Review invoices, payments, returns and order or quotation history. Open the source reference to investigate an amount rather than entering a balancing adjustment immediately.', 'Review the customer account ledger and reconciliation. Export or print the available customer statement or ledger when a customer or manager needs supporting detail.'])
heading('Interpret the balances correctly')
table(['Measure','Interpretation'],[('Outstanding invoices','Unpaid invoice amounts after applicable dated allocations and return credits'),('Customer credit','Brought-forward or excess credit that is not automatically allocated to another invoice'),('Net exposure','Receivables considered alongside separately identified customer credit'),('Aging','Due-date based groups including current, overdue bands and Terms not set'),('Ledger balance','Posted customer movements and opening balance for the selected dates')],[1.65,5.02])
p('A historical as-of view must use receipts and return credits effective by that date. A credit posted after the selected date must not erase a balance that existed earlier. Likewise, an opening journal posted on 2 November belongs to the ledger at that posting date even when its source invoice has an earlier date.')
heading('Use the dedicated customer ledger')
p('Open Finance and Reports → Customer Ledgers, select the party and date range, then review opening balance, dated debit and credit movements and closing balance. Document and journal references identify the original posted source. Print or download the ledger using the controls offered on the page.')
lead('Reconciliation','A positive customer balance represents an amount receivable from the customer. Supplier payables belong to the supplier subledger and must not be described as customer debt. Unassigned manual control-account entries may require General Ledger review because they are not attached to a customer.')

page(9,'Return individual pieces and identify them','Sales returns')
p('The return workflow supports one piece, a few pieces or repeated partial returns from an original invoice line. It preserves the original article, size, colour and selling information so the returned item can be identified later.')
steps(['Open Sales → Sales Returns, or select Return pieces on an itemized invoice. Choose the original posted invoice.', 'Enter the actual received quantity for each specific invoice line. Quantities must be whole pieces and must not exceed sold quantity less earlier returns.', 'Choose Sellable or Damaged for the received pieces. For serialized items, select the exact serials previously sold on that invoice. Resolve open warranty claims first.', 'Enter the return date and a specific reason. Review the calculated credit, article name, size, colour, quantity and condition.', 'Post once and note the unique SR reference. Inspect the return detail and original invoice balance.', 'Verify the inventory movement for sellable pieces. Print or save the return detail as PDF, or download the line-level return register when required.'])
heading('What changes after posting')
p('Sellable pieces increase the matching finished article and size stock and create a movement linked to the SR reference. Damaged pieces remain identifiable in the return register and are excluded from sellable stock. Colour is preserved on the return document, while the current stock quantity model aggregates by article and size.')
p('The credit uses original selling values and proportional invoice adjustments and tax. Cumulative rounding preserves the original total across repeated returns. Both sellable and damaged returns credit the customer under this workflow. The original sold quantities and rates remain intact.')
lead('Accounting effect','The return credits 1100 Accounts Receivable and debits 4050 Sales Returns and Allowances, with the appropriate tax reversal to 2300 when tax applies. Excess credit on a paid invoice remains visible as customer credit.')
lead('Important limits','This does not automatically pay a cash refund, transfer credit to another invoice, create a replacement sale, value returned stock cost or reverse earned commission. Opening AR imports have no article quantities and cannot support a traceable piece return. Posted returns are protected audit records.')

page(10,'Serial numbers and warranties','Item traceability')
heading('Register and sell serialized pieces')
steps(['Open Inventory → Serials and Warranty. Select the existing article and size and register unique serial numbers with the required warranty information.', 'Confirm that physical stock already exists. Registering a serial identifies a piece; it does not create additional stock.', 'When selling a tracked article, select a valid available serial for every invoiced unit. Check that the serial belongs to the correct article and size.', 'Post the invoice. The issue links the serial to the invoice and customer, and warranty coverage starts from the invoice date.', 'For a supported historical itemized invoice, use the attachment process only within its invoiced quantities. Do not attach serials to an opening receivable with no item lines.'])
heading('Record and resolve a warranty claim')
steps(['Find the sold serial and confirm its invoice, customer and coverage dates.', 'Create the claim with the reported fault and supporting details. The system checks coverage and prevents more than one open claim for the same serial.', 'Review and update the open claim using the permitted status and resolution fields. Enter a meaningful reason or outcome.', 'Close the claim once the service decision is complete. Closed records are retained; use their history when investigating subsequent returns.'])
heading('Return traceability')
p('A serialized sales return identifies the exact sold unit. A sellable serial becomes available again and its current invoice and warranty dates are cleared for a future sale, while the return keeps the historical serial link. A damaged return is marked returned_damaged. The return record is therefore essential to the history even when the serial becomes available for resale.')
lead('Operational checks','Keep the physical label and recorded serial consistent. Investigate duplicate, already issued or wrong-article serial errors instead of creating a substitute record. Serial history can restrict editing or deletion of the linked invoice to protect traceability.')
lead('Boundary','Serial and warranty functions identify units and service history. They do not establish manufacturing provenance, perform repairs automatically, add stock on registration or decide a cash refund.')

page(11,'Purchase order to supplier payment','Purchasing procedure')
p('Use Purchasing → Purchasing Overview to identify the next unfinished step. Supplier purchase orders instruct what the business buys; customer POs describe what customers request from the business.')
steps(['Create the supplier and material definitions, then open Purchase Orders and enter a draft with supplier, order date, expected date and material lines.', 'Review quantities and rates and approve the purchase order using an account with approval permission. Draft approval is a separate step from receiving stock.', 'Open Goods Received (GRN), select the approved or partly received PO and enter the quantities physically delivered, with batch information. Check the receipt date and each line balance.', 'Post the GRN. Partial receipts leave the remaining PO quantity open; further deliveries use another receipt. Over-receipt and a receipt date before the PO date are rejected.', 'Open Purchase Invoices and register the supplier bill against the posted GRN. Enter the actual supplier invoice number and due date and verify the carried-forward supplier and value.', 'Use the linked supplier payment action to prepare a payment voucher for the receipt balance. Confirm the cash or bank account, amount, date and reference before posting.', 'Check the supplier ledger and outstanding balance. Keep the PO, GRN, supplier invoice and payment references together for reconciliation.'])
heading('Stock and accounting connection')
p('The GRN increases raw material batch stock and posts the receipt-related inventory and liability journal. Registering the supplier invoice records the bill against the receipt without duplicating the stock or liability. Supplier payment reduces the relevant outstanding receipt liability and the chosen cash or bank balance.')
heading('Supported purchase return')
p('Select the original receipt and specific material or batch quantities in Purchase Returns. Enter the return date and reason. Quantities are limited by prior receipts, earlier returns and available batch stock. The supported value is capped by the unpaid supplier balance. Cancellation uses a reasoned dated reversal and restores the supported stock and liability effects.')
lead('Current limits','One supplier invoice is supported per GRN. Several GRNs cannot currently be consolidated into one invoice, and invoice price variances are not a complete three-way matching workflow. Paid supplier returns requiring a refund are not supported by this return path. Resolve differences before bill registration.')

page(12,'Inventory balances imports and movements','Stock control')
heading('Understand the two stock records')
p('Raw material stock is held by material and batch with recorded quantities and costs. Finished stock is held by article and size. Colours appear on sales and return documents but are not independent finished-stock balance dimensions. Neither a product catalogue entry nor a serial registration creates stock.')
heading('Load opening or bulk stock')
steps(['Count physical inventory and prepare the supported import rows for existing materials or articles. Use the screen instructions for field names and units.', 'Open Bulk Inventory Import, select the supported stock type and provide a clear import reference. Validate codes, sizes, batches, quantities and values before posting.', 'Review errors and correct the source data. Do not create duplicate imports to bypass a rejected row.', 'Post the validated import and check its reference, resulting balances and movement records. Review the opening journal where that stock import creates one.', 'Reconcile imported quantities to the physical count and retain the source file with the import reference.'])
heading('Daily stock movements')
table(['Business event','Expected quantity effect'],[('Posted material GRN','Increase raw material batch quantity'),('Supported purchase return','Decrease the returned material or batch quantity'),('Sales dispatch or POS','Decrease supplied finished article and size quantity'),('Sellable sales return','Increase the returned finished article and size quantity'),('Damaged sales return','No increase in sellable finished stock'),('Supported adjustment or import','Change the relevant balance with source and reason')],[2.25,4.42])
heading('Investigate a difference')
p('Open Stock Ledgers or the relevant stock movement report. Filter the item and dates and trace receipts, issues, returns, imports and adjustments to their source references. Check units and size selection before adjusting. Use the authorized adjustment workflow and a specific reason; do not overwrite stock merely to make a sale pass.')
lead('Valuation boundary','Do not assume that finished-goods selling prices are stock costs or that article quantities generate a complete cost-of-sales or margin calculation. Finished-goods costing and production valuation require further implementation and approved accounting policies.')

page(13,'Chart of Accounts and subaccounts','Accounting setup')
p('The chart supports parent groups and multiple nested account levels. Parent groups organize balances; individual posting accounts receive journal lines. Existing accounts are not automatically regrouped.')
heading('Create an account inside a group')
steps(['Open Finance and Reports → Chart of Accounts and select New group. Enter a unique code, name and account type. Keep the group active and non-posting.', 'Use the group plus shortcut to create inside it, or select the Parent account in the account editor. Choose a parent with the same account type.', 'Create the child posting account with its code and full name. Enable journal posting only when it is an actual account that should receive transactions.', 'For a money source, create an active posting asset account and mark it Cash or bank account. Select the appropriate cash-flow treatment and save.', 'Confirm the child appears beneath its parent. Inspect the account ledger and the group rolled-up balance after relevant postings.'])
heading('Example hierarchy')
table(['Level','Example name','Posting use'],[('Parent group','Cash and bank accounts','Non-posting subtotal'),('Child account','Main operating bank','Individual money source'),('Child account','Petty cash','Individual money source'),('Separate group','Office expenses','Non-posting subtotal'),('Expense child','Office rent','Expense classification')],[1.15,2.8,2.72])
p('The example names describe a possible setup; they are not a claim that these exact accounts already exist. A used posting account cannot simply become a parent. Create a separate group and move compatible accounts beneath it using the permitted reasoned edit.')
lead('Validation','Self-parenting, circular trees, mixed account types and inactive or posting parents are blocked. Groups with children cannot be converted into posting accounts or changed in ways that invalidate the tree. System and used accounts retain protected posting roles, codes and types.')
lead('Avoid double counting','A group balance includes descendants. Do not add the group subtotal to its child balances again. Group ledgers identify the original individual account on each journal line. Financial statements use underlying postings, so hierarchy changes do not rewrite the transactions.')

page(14,'Opening accounts vouchers and cash flow','Treasury and payments')
heading('Post a general account opening')
p('Use Chart of Accounts → Opening balances for an eligible active balance-sheet account. Enter a one-time debit or credit opening and date against 3990 Opening Balance Equity. The opening date must be on or before its first transaction and in an open period. Direct openings to control accounts 1100 and 2100 are blocked to avoid duplicate customer or supplier balances. Review the trial balance after loading openings.')
heading('Create and post a payment voucher')
steps(['Open Finance and Reports → Payment Vouchers. Create the appropriate expense or supplier-related voucher.', 'Select an active posting cash or bank account as the money source. Enter payee, date, amount, references and the required allocation lines or linked supplier receipt.', 'Review expense or other destination accounts and ensure the voucher matches the actual purpose. Save and review the draft before final posting.', 'Post the voucher once. Confirm the reference, posted status and journal. Supplier payments must remain within the current supported outstanding balance.', 'If a correction is required, use the supported cancellation or reversal action and a specific reason. Preserve the original reference and check the reversal date and linked balances.'])
heading('Read the cash-flow statement')
p('Open Cash Flow and select the dates and available account filters. The statement uses posted journal lines for cash and bank accounts and classifies external movements as operating, investing, financing or unclassified according to the counterpart accounts. It distinguishes opening cash, period movement and closing cash.')
p('An opening cash balance is opening cash, not operating cash income. Transfers between the selected cash accounts are not external receipts or payments. Classification should reflect the substance of the transaction: for example, equipment purchase is normally investing and loan funding financing. Review unclassified items before distributing the statement.')
lead('Why only cash or bank appears','The payment selector is a filtered view of eligible Chart of Accounts entries. It shows where money is paid from. The expense or liability account is selected in the allocation or linked transaction. Parent groups and unrelated accounts must not appear as spendable bank balances.')

page(15,'Journals recurring entries and closing','Accounting control')
heading('Manual journal procedure')
steps(['Open General Ledger and the available journal-entry action. Confirm the transaction is not already created by an invoice, collection, GRN, payroll or voucher.', 'Enter the posting date, clear description and active posting account lines. Give each line either a debit or credit, not both.', 'Check that total debits equal total credits and that the period is open. Verify source references and any required reason.', 'Post and inspect the journal and affected ledgers. System-generated journals are protected from ordinary manual edits or deletion. Correct the source through its supported workflow.'])
heading('Recurring journals')
p('Create a balanced recurring template with its description, start date and interval of 1, 3 or 12 months. Review the next due date. Use its run action on that due date, up to today, to create the journal. The next date advances using the start-day rule and the valid number of days in the target month. Repeating the same template date returns its existing journal rather than posting again.')
lead('Scheduling boundary','A recurring template is a controlled repeatable entry. Do not assume an unattended background scheduler runs it without an operator; the implemented workflow exposes a due-date run action. Stop a template with a recorded reason when it should no longer be used.')
heading('Cashier closing')
steps(['Open Cashier Closing and select the eligible cash account and business date.', 'Review the expected balance from posted movements. Count actual cash and enter the counted amount.', 'Explain any discrepancy and complete the close. Check that there is only one active closing for the account and date.', 'When a correction requires reopening, use the reasoned reopen action. Reconcile again after later or backdated movements that affect the closed day.'])
heading('Ledger interpretation')
p('General Ledger shows posted debit and credit movements and running balances. Parent ledgers include descendant posting accounts. Customer and supplier ledgers attach movements to their parties. A manual entry to a control account without a party association can cause a control-to-subledger difference; investigate that source rather than changing customer balances to conceal it.')

page(16,'Employees payroll and office costs','People and expenses')
heading('Prepare and calculate payroll')
steps(['Create employees and verify their personal identifiers, employment and payroll settings using People and Products → Employees.', 'Prepare attendance data in the supported import format. Import it and review the imported days, hours or other payroll inputs before calculation.', 'Open Payroll, choose the relevant period and calculate the run. Review each employee result, gross earnings, deductions and net amount.', 'Use the permitted payroll adjustments only with supporting evidence and a reason. Check totals and post the run when ready.', 'Export the available payroll or attendance Excel files for review and retain the approved supporting data.'])
heading('Pay a salary')
steps(['Open the Head Office Salaries or linked payroll payment view and choose the actual payroll item.', 'Select the active cash or bank account and payment date. Verify the employee, payroll reference and net amount.', 'Post the salary payment and confirm its journal and paid state. Do not mark a payroll item paid independently of the supported payment workflow.', 'If reversing a payment, use the reasoned reversal action. Check the resulting payable and cash balances and preserve the original history.'])
heading('Expenses and payables')
p('Head Office Expenses and payment vouchers support recording and reviewing office costs through their accounting links. Use supplier ledgers and All Payables for supplier obligations, and distinguish payroll payables from supplier receipt balances. Paying an already recognized obligation should settle the liability rather than record the expense a second time.')
lead('Policy review required','The presence of payroll calculation does not certify local statutory rates, taxable bases, overtime rules or employment-policy compliance. Verify each configured payroll setting and calculation with the responsible accountant before using a live payroll. Do not infer statutory approval from a successful system save.')
lead('Current data baseline','Seed employees and payroll testing records were removed during cleanup. Employee and payroll setup therefore needs real approved information before operational use. The retained login accounts are access records and are not employee payroll masters.')

page(17,'Professional reports and exports','Reporting procedure')
steps(['Open Reports or the dedicated ledger, aging, cash-flow or account screen. Select the report that matches the business question.', 'Set the period or as-of date and relevant party, account or item filters. Check whether dates represent invoice dates, posting dates, payment dates or return dates.', 'Review the on-screen results and totals. Inspect source references for unusual amounts and identify records with missing terms or incomplete source details.', 'Use the supplied Print or PDF action for the formatted report, or the offered download format. Financial statements, payroll and selected aging outputs have dedicated Excel exports; other registers may offer CSV.', 'Check the report title, company header, period, column headings, totals and footer before saving or distributing. Confirm that all filtered rows are included and that the last page is readable.'])
table(['Report family','Use and interpretation'],[('Sales and collections','Sales invoices and receipt activity; opening entries are not new turnover'),('Customer aging','Unpaid customer balances at the selected date, including missing-term exceptions'),('Customer and supplier ledgers','Opening, dated source movements and closing balance'),('Sales returns','Dated credit notes and line-level returned quantities'),('Purchasing and supplier aging','Receipts, registered bill details, payments and supported returns'),('Stock balances and movements','Quantities by the supported stock dimensions and source movements'),('Trial balance and balance sheet','Posted ledger balances and financial position'),('Profit and loss','Posted income and expense, including return contra revenue'),('Cash flow','Cash and bank movements classified by activity')],[2.0,4.67])
lead('Readiness labels','Some report categories may show readiness information where their detailed source process is incomplete. Do not present such a category as a complete operational report. In particular, a product-margin figure needs reliable finished-goods cost data.')
lead('Reconciliation','Compare Accounts Receivable with customer ledgers, supplier control balances with supplier sources, and cash closing with the cash ledger. Original sales and a separate return report answer different questions; account for return credits when assessing net revenue.')

page(18,'Daily working sequence and responsibilities','Operating routine')
heading('Start of day')
steps(['Sign in and check the correct workspace and business date. Review incomplete sales orders and purchasing steps.', 'Confirm real available stock before promising delivery. Check customer terms, outstanding balances and credit exposure.', 'Review cash or bank account selection and any due recurring journals or previous closing exceptions.'])
heading('During the day')
steps(['Create the sales order, review article names, fixed and given rates and quantities, then invoice only the actual dispatch.', 'Record customer money against the correct outstanding invoice. Keep cash, bank and payment references consistent with evidence.', 'Record supplier deliveries through GRNs before bill registration and supplier payment. Use a return document for physically returned pieces or material.', 'Check the generated reference after every post. Retain source documents and use specific reasons for changes.'])
heading('End of day')
steps(['Reconcile dispatched quantities to stock movements and the day invoices. Review sellable and damaged returns separately.', 'Reconcile customer collections and vouchers to cash or bank evidence. Complete the cashier close where applicable.', 'Review invoice outstanding balances, missing credit terms, unclassified cash flows and any control-account differences.', 'Save the required daily reports and check headers, periods, totals and complete pages. Follow the organization backup and access-review arrangements.'])
table(['Responsibility','Primary review'],[('Sales operator','Customer, article, agreed rate, ordered and supplied quantities'),('Stock operator','Physical count, batches, sizes, serials and return condition'),('Accounts staff','Dates, allocations, posting accounts, ledgers and reconciliations'),('Approver or manager','PO approval, exceptions, credit decisions and commission adjustments'),('Administrator','User access, permitted roles and operational configuration')],[1.65,5.02])

page(19,'Exceptions controls and current limits','Practical reference')
table(['Issue','Correct response'],[('Order creation uncertain','Check the success reference and saved register before resubmitting'),('Article name seems truncated','Read the full selected article detail and confirm code and size before adding'),('Insufficient stock','Verify actual stock and movements; load genuine count or receipt through the correct process'),('No cash account choice','Create or activate a permitted posting cash or bank asset account'),('Aging without due date','Review Terms not set; enter approved terms or original due date'),('Cannot edit or delete','Check linked transactions, posting protection and required reason; use the supported reversal path'),('Return blocked','Check itemized source lines, quantity remaining, serials, dates and open claims'),('Ledger difference','Trace source and unassigned manual control entries before correcting')],[2.05,4.62])
heading('Limits that affect business decisions')
bullets(['Imported opening AR contains amounts and dates, not sold article quantities. Piece returns require an itemized invoice.', 'Customer credits are visible separately; automatic cash refunds, cross-invoice credit allocation and replacement orders are not part of the current sales-return workflow.', 'Finished stock aggregates by article and size. Colour documents do not establish separate colour stock balances, and finished-cost or manufacturing valuation is not complete.', 'Supplier invoicing is one bill per GRN without a complete price-variance or multi-GRN matching process. The current purchase-return path does not settle refunds for paid receipts.', 'Commission clawback after a return requires management review. Payroll statutory policies and configurable approval limits require business validation.', 'A printed PDF or exported spreadsheet is a report snapshot. It does not change the underlying posting or establish that a transaction was approved.'])
lead('Access and privacy','Administration → Access Control manages permitted users and roles. The API enforces permissions for posting, purchasing, approval, stock and accounting actions. Keep private database backups, login data and personal customer details restricted to authorized staff. This manual intentionally excludes credentials and private backup contents.')

page(20,'Evidence maintenance and glossary','Document reference')
p('This manual was prepared from the current application structure and its implemented workflow notes. It does not treat an older roadmap as proof that a feature is absent or complete. The following references identify where maintainers can verify or revise the procedures.')
table(['Source','Coverage'],[('frontend/src/App.tsx and workflow.ts','Navigation and normal process lineup'),('backend/routes/api.php','Available endpoints and enforced action permissions'),('docs/business-workflow.md','Connected sales and purchasing procedures'),('docs/account-hierarchy.md','Parent groups, child accounts and balance rollups'),('docs/pricing-and-opening-balances.md','Fixed and given rates and opening-balance rules'),('docs/sales-returns.md','Piece returns, stock effects and credit limits'),('docs/receivables-import.md','Real AR source and import treatment'),('docs/production-data-cleanup.md','Verified retained data and cleanup baseline'),('Frontend pages and backend services','Customer profile, reporting, POS, payroll, vouchers, serials and posting behavior')],[3.0,3.67])
heading('Terms used in this manual')
table(['Term','Meaning'],[('AR','Accounts Receivable, the amount owed by customers'),('Customer PO','Customer purchase instruction received by the business'),('Supplier PO','Purchase order issued by the business to a supplier'),('GRN','Goods Received Note for actual supplier delivery'),('Given rate','Agreed selling rate used in the transaction total'),('Fixed rate','Saved catalogue reference selling price'),('Posting account','Individual account allowed to receive journal entries'),('Parent group','Non-posting group with descendant balance subtotals'),('Subledger','Party or stock detail supporting a general ledger balance'),('SR reference','Unique sales-return document reference')],[1.55,5.12])
lead('Maintain this document','Update the relevant procedure when a source screen, rule, account integration or report date basis changes. Record the version and verify a representative transaction in an isolated test environment before approving a revised operating procedure.')

doc.core_properties.title='AeroSoft360 System and Operating Manual'
doc.core_properties.subject='Implemented features and step by step business workflows'
doc.core_properties.author='AeroSoft360'
doc.core_properties.keywords='ERP, operating manual, sales, receivables, purchasing, inventory, finance'
for st in doc.styles:
 if st.type == 1:
  pr=st.element.find(qn('w:pPr'))
  if pr is not None:
   for b in list(pr.findall(qn('w:pBdr'))): pr.remove(b)
for z in doc.paragraphs:
 pr=z._p.find(qn('w:pPr'))
 if pr is not None:
  for b in list(pr.findall(qn('w:pBdr'))): pr.remove(b)
# Keep the reference chapter ending with its glossary rather than an orphan note.
for z in list(doc.paragraphs):
 if z.text.startswith('Maintain this document'):
  z._element.getparent().remove(z._element)
doc.save(OUT)
print(OUT)
