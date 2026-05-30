'use client';

import useTutorialStore from '../hooks/useTutorialStore.js';
import TutorialSpotlight from './TutorialSpotlight.js';
import MarkdownText from './MarkdownText.js';

export default function TutorialPanel() {
  const { store, state } = useTutorialStore();

  const {
    isActive,
    activeLab,
    currentStep,
    currentStepIndex,
    totalSteps,
    collapsed,
  } = state;

  if (!isActive) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => store.setCollapsed(false)}
        className="tutorial-panel-tab"
        title="Expand tutorial panel"
        aria-label="Expand tutorial panel"
      >
        Lab
      </button>
    );
  }

  return (
    <>
      {currentStep?.spotlight && (
        <TutorialSpotlight selector={currentStep.spotlight} />
      )}

      <aside className="tutorial-panel" role="complementary" aria-label="Tutorial panel">
        <div className="tutorial-panel-header">
          <span className="tutorial-panel-title">{activeLab.title}</span>
          <div className="tutorial-panel-header-actions">
            <button
              type="button"
              onClick={() => store.setCollapsed(true)}
              aria-label="Collapse tutorial panel"
              className="tutorial-icon-btn"
              title="Collapse"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => store.exitLab()}
              aria-label="Exit lab"
              className="tutorial-icon-btn"
              title="Exit lab"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="tutorial-panel-progress">
          Step {currentStepIndex + 1} of {totalSteps}
          <div className="tutorial-progress-bar">
            <div
              className="tutorial-progress-fill"
              style={{ width: `${(currentStepIndex / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="tutorial-panel-body">
          <h3 className="tutorial-step-title">{currentStep?.title}</h3>
          <p className="tutorial-step-description">
            <MarkdownText>{currentStep?.description}</MarkdownText>
          </p>

          {currentStep?.hint && (
            <details className="tutorial-hint">
              <summary>Hint</summary>
              <p><MarkdownText>{currentStep.hint}</MarkdownText></p>
            </details>
          )}
        </div>

        <div className="tutorial-panel-footer">
          {currentStepIndex > 0 && (
            <button
              type="button"
              className="tutorial-btn-ghost"
              onClick={() => store.goBack()}
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            className="tutorial-btn-primary"
            onClick={() => store.advanceStep()}
          >
            {currentStepIndex < totalSteps - 1 ? 'Next Step →' : 'Finish Lab'}
          </button>
        </div>
      </aside>
    </>
  );
}
