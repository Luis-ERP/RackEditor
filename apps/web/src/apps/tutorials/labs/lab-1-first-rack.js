// Lab 1 — Build Your First Rack

export default {
  id: 'lab-1-first-rack',
  title: 'Build Your First Rack',
  description:
    'Use the Rack drawing tool to place a module, configure its frame and beam, add two beam levels, and send the result to Quoter.',
  estimatedMinutes: 10,
  starterProject: null,

  steps: [
    {
      id: 'step-activate-rack-tool',
      title: 'Activate the Rack drawing tool',
      description:
        'At the bottom-center of the canvas there is a floating toolbar. Click the **Rack** icon to activate drawing mode. The cursor will change to a crosshair.',
      hint: 'The DrawingToolbar floats at the bottom of the canvas. Look for the rack/grid icon between the Select and Wall tools.',
      spotlight: '[data-tutorial="drawing-toolbar"]',
    },
    {
      id: 'step-draw-rack',
      title: 'Draw a rack on the canvas',
      description:
        'With the Rack tool active, **click and drag** on the canvas to place bays. Each cell you cover becomes one bay. Draw at least 2 bays. There is no dialog — the rack appears immediately as you draw.',
      hint: 'Click on an empty area of the canvas and drag left or right to place multiple bays at once.',
      spotlight: null,
    },
    {
      id: 'step-configure-frame',
      title: 'Configure the frame',
      description:
        'Press **Escape** or click the **Select** tool to exit drawing mode, then click the rack on the canvas to select it. In the left **EditorPanel** (Edition tab), expand the **Frame** section and use the segmented controls to set Height, Depth, and Capacity.',
      hint: 'Try Height 144", Depth 42", Capacity Std. Changes apply immediately to the canvas.',
      spotlight: null,
    },
    {
      id: 'step-configure-beam',
      title: 'Configure the beam length',
      description:
        'In the **Beam** section, use the segmented control to select a beam length (e.g. **96 in**).',
      hint: 'Beam capacity is set per-level in the Beam Levels section below.',
      spotlight: null,
    },
    {
      id: 'step-add-levels',
      title: 'Add two beam levels',
      description:
        'In the **Beam Levels** section, click **"+ Add Beam Level"** twice. Two levels will appear in the SVG diagram. The rack status should change from INCOMPLETE to VALID.',
      hint: 'Scroll down in the EditorPanel if the Beam Levels section is not visible.',
      spotlight: null,
    },
    {
      id: 'step-send-to-quoter',
      title: 'Send to Quoter',
      description:
        'Click the **third tab** (the gear / Settings icon — "Project" tab) in the EditorPanel. Scroll to the **Quoter** subsection and click **"Send to Quoter →"**. The app will navigate to Quoter with the BOM pre-populated.',
      hint: 'The Project tab is the rightmost of the three tabs in the EditorPanel header.',
      spotlight: '[data-tutorial="send-to-quoter"]',
    },
  ],
};
