Quoter generator application

The idea is to connect the quoter to the CAD editor. The app should translate the cad project format to quote line items.
From the CAD json file translate the semantics modules to the quote line items

The quote schema should look like this. Make it non-relational style
- order_number: int
- created_at: datetime
- updated_at: datetime
- created_by: str
- client:
    - organization_name: str
    - first_name: str
    - last_name: str
    - email: str
    - phone: str
- state: str options (draft, sent, rejected, closed)
- line_items: array
    - variant: attached to an entry in catalog_list beams.csv and frames.csv
        - name: str
        - sku: str
        - weight: float (kg)
    - cost: float
    - margin: float range 0 - 1
    - price: float calculated = cost * (1 + margin)
    - discount: float
    - subtotal: float calculated = price - discount
    - quantity: float
    - total: float calculated = subtotal * quantity
- tax_rates: array
    - name: str
    - rate: float range 0 - 1
- discounts: array
    - name: str
    - type: str options (percentage, fixed)
    - value: float
- shipping: float
- fees: array
    - name: str
    - type: str options (percentage, fixed)
    - value: float
- total_discounts: float calculated = aggregated(discounts)
- total_fees: float calculated = aggregated(fees)
- total_tax_rates = float calculated = aggregated(tax_rates)
- subtotal: float calculated = aggregated(line_items)
- total: float calculated = (subtotal - total_discounts + shipping + total_fees) - (1 + total_taxe_rates)
- cad:
    - project_file: str
- quote_template:
    - template_file: str
    - template_variables_mapping: object
        - [variable_key: str]: quote_key: str
- versioning: array
    - version: int
    - versions:
        - id: int
        - updated_at: 
        - updated_by: str
        - data: object quote data -- except the versioning object clearly

This information needs to be editable fields in the UI -- except for the calculated ones.
The UI should be intuitied and sectioned. 
The user should be able to swtich between versiones
The user should be able to compare different versions
The user should be able to open the 
The user should be able to switch from the CAD editor app to the quoter app and vise versa.
