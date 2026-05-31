// Lab 2 — Send Design to Quoter

export default {
  id: 'lab-2-send-to-quoter',
  title: 'Review the BOM in Quoter',
  description: 'Send a VALID rack design to Quoter and verify that BOM quantities match the rack configuration.',
  estimatedMinutes: 5,
  starterProject: null,

  steps: [
    {
      id: 'step-verify-valid',
      title: 'Confirm the rack is VALID',
      description: 'Back on the CAD page, confirm your rack shows VALID status (no red banner). If it shows INCOMPLETE or INVALID, fix it before continuing.',
      hint: 'The ValidationBanner appears at the top of the RackModuleEditor when the rack is selected.',
      spotlight: null,
    },
    {
      id: 'step-send',
      title: 'Send to Quoter',
      description: 'In the EditorPanel, click the **Project** tab (gear icon, third tab). Under the Quoter subsection, click **"Send to Quoter →"**. The app navigates to /quoter and loads the BOM automatically.',
      hint: 'The Project tab is the rightmost of the three tabs in the EditorPanel header.',
      spotlight: '[data-tutorial="send-to-quoter"]',
    },
    {
      id: 'step-verify-bom',
      title: 'Verify BOM quantities',
      description: 'In Quoter, check that line items are present for frames, beams, and related hardware. Verify the quantities match your design: frames = bays + 1, beams = bays × levels × 2.',
      hint: 'CAD-linked lines are shown with a CAD badge and cannot be edited directly.',
      spotlight: null,
    },
  ],
};
