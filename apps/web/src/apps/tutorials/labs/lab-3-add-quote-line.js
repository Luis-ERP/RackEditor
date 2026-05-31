// Lab 3 — Add a Manual Quote Line

export default {
  id: 'lab-3-add-quote-line',
  title: 'Add a Manual Quote Line',
  description: 'Add a manual line item for installation labor, set cost and margin, and review how the quote total updates.',
  estimatedMinutes: 5,
  starterProject: null,

  steps: [
    {
      id: 'step-open-add-item',
      title: 'Add a manual line item',
      description: 'In the Quoter line items section, click "Add Line" or "+ Item" to open the manual line item form.',
      hint: 'Manual lines are separate from CAD-linked lines. Look for an "Add" button below the BOM table.',
      spotlight: '[data-tutorial="add-line-item"]',
    },
    {
      id: 'step-fill-item',
      title: 'Fill in the line item',
      description: 'Set Name to "Installation Labor", Cost to $500, Margin to 20%, and Quantity to 1. Save the item.',
      hint: 'Price = cost × (1 + margin). With cost $500 and 20% margin, price = $600.',
      spotlight: null,
    },
    {
      id: 'step-verify-total',
      title: 'Verify the quote total updated',
      description: 'Check that the quote subtotal increased after adding the manual line. The totals panel shows: subtotal → discounts → fees → taxable base → tax → total.',
      hint: 'The totals panel is usually at the bottom right of the Quoter page.',
      spotlight: null,
    },
  ],
};
