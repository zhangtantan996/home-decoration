import React from 'react';
import { Steps } from 'antd';

export interface FlowStep {
  key: string;
  title: string;
  stages: string[]; // BusinessFlow stages that map to this step
}

export const FLOW_STEPS: FlowStep[] = [
  {
    key: 'booking',
    title: '接单',
    stages: ['lead_pending', 'negotiating'],
  },
  {
    key: 'survey',
    title: '量房',
    stages: ['survey_deposit_pending'],
  },
  {
    key: 'budget',
    title: '预算',
    stages: ['design_quote_pending'],
  },
  {
    key: 'quote',
    title: '报价',
    stages: ['design_fee_paying', 'design_pending_submission'],
  },
  {
    key: 'design',
    title: '设计',
    stages: ['design_delivery_pending', 'design_acceptance_pending', 'design_pending_confirmation'],
  },
  {
    key: 'construction',
    title: '施工',
    stages: [
      'construction_party_pending',
      'construction_quote_pending',
      'ready_to_start',
      'in_construction',
      'node_acceptance_in_progress',
      'completed',
      'case_pending_generation',
      'archived',
    ],
  },
];

const TERMINAL_STAGES = ['completed', 'case_pending_generation', 'archived', 'cancelled'];

export function resolveStepIndex(currentStage: string): number {
  if (TERMINAL_STAGES.includes(currentStage)) {
    return FLOW_STEPS.length - 1;
  }
  const idx = FLOW_STEPS.findIndex(s => s.stages.includes(currentStage));
  return idx >= 0 ? idx : 0;
}

interface FlowStepperProps {
  currentStage: string;
  currentStep: number;
  onStepClick: (stepIndex: number) => void;
}

const FlowStepper: React.FC<FlowStepperProps> = ({ currentStage, currentStep, onStepClick }) => {
  const activeIndex = resolveStepIndex(currentStage);

  const items = FLOW_STEPS.map((step, i) => {
    let status: 'wait' | 'process' | 'finish' | 'error' = 'wait';
    if (i < activeIndex) status = 'finish';
    else if (i === activeIndex) status = 'process';

    if (currentStage === 'disputed') status = i === activeIndex ? 'error' : status;

    return {
      title: step.title,
      status,
      style: { cursor: 'pointer' },
    };
  });

  return (
    <Steps
      current={currentStep}
      items={items}
      onChange={onStepClick}
      size="small"
      style={{ marginBottom: 24 }}
    />
  );
};

export default FlowStepper;
