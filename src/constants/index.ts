import { WorkOrderStatus, WorkOrderPriority } from '../../generated/prisma';

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  NEW: 'Novi',
  ACCEPTED: 'Prihvaćen',
  IN_PROGRESS: 'U toku',
  ON_HOLD: 'Na čekanju',
  COMPLETED: 'Završen',
};

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  LOW: 'Nizak',
  MEDIUM: 'Srednji',
  HIGH: 'Visok',
  URGENT: 'Hitan',
};
