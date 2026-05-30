'use client';

import Link from 'next/link';
import useTutorialStore from '../hooks/useTutorialStore.js';

export default function LabCard({ lab }) {
  const { state } = useTutorialStore();
  const isCompleted = state.completedLabs.has(lab.id);
  const isActive = state.activeLab?.id === lab.id;

  return (
    <article className="lab-card">
      <div className="lab-card-header">
        <h2 className="lab-card-title">{lab.title}</h2>
        {isCompleted && (
          <span className="lab-card-badge lab-card-badge--done" title="Completed">
            Done
          </span>
        )}
        {isActive && (
          <span className="lab-card-badge lab-card-badge--active" title="In progress">
            Active
          </span>
        )}
      </div>

      <p className="lab-card-description">{lab.description}</p>

      <div className="lab-card-meta">
        <span>{lab.estimatedMinutes} min</span>
      </div>

      <Link href={`/tutorials/${lab.id}`} className="tutorial-btn-primary lab-card-link">
        {isCompleted ? 'Redo Lab' : isActive ? 'Continue Lab' : 'Start Lab'}
      </Link>
    </article>
  );
}
