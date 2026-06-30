export type Task = {
  id: string;
  title: string;
  weight: number;
  categoryId?: string;
  startTime?: string;
  endTime?: string;
  isRecurring: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';
  recurrenceEnd?: string;
  completed?: boolean;
  progress?: number;
};