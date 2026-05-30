'use client';

import { LAB_LIST } from '@/src/apps/tutorials/labRegistry';
import LabCard from '@/src/apps/tutorials/components/LabCard';
import '@/src/apps/tutorials/styles/tutorial.css';

export default function TutorialsIndexPage() {
  return (
    <div className="tutorials-page">
      <h1 className="tutorials-page-title">Labs</h1>
      <p className="tutorials-page-subtitle">
        Short guided exercises that walk you through the core RackEditor workflow.
        Start with Lab 1 — it takes about 10 minutes.
      </p>

      <div className="lab-grid">
        {LAB_LIST.map((lab) => (
          <LabCard key={lab.id} lab={lab} />
        ))}
      </div>
    </div>
  );
}
