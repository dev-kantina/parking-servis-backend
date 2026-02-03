import { WorkOrderStatus, WorkOrderPriority } from '../../generated/prisma';

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  NEW: 'Novi',
  ACCEPTED: 'Prihvaćen',
  IN_PROGRESS: 'U toku',
  ON_HOLD: 'Pauziran',
  COMPLETED: 'Završen',
  CANCELLED: 'Otkazan',
  DECLINED: 'Odbijen',
};

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  LOW: 'Nizak',
  MEDIUM: 'Srednji',
  HIGH: 'Visok',
  URGENT: 'Hitan',
};
