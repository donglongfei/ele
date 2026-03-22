/**
 * Cron expression parser and utilities.
 * Supports standard cron format with some extensions.
 */

export class CronExpression {
  private minute: number[];
  private hour: number[];
  private dayOfMonth: number[];
  private month: number[];
  private dayOfWeek: number[];

  constructor(expression: string) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${expression}. Expected 5 fields (minute hour day month weekday)`);
    }

    this.minute = this.parseField(parts[0], 0, 59);
    this.hour = this.parseField(parts[1], 0, 23);
    this.dayOfMonth = this.parseField(parts[2], 1, 31);
    this.month = this.parseField(parts[3], 1, 12);
    this.dayOfWeek = this.parseField(parts[4], 0, 7);
  }

  private parseField(field: string, min: number, max: number): number[] {
    const values: number[] = [];

    if (field === '*') {
      for (let i = min; i <= max; i++) {
        values.push(i);
      }
      return values;
    }

    const parts = field.split(',');
    for (const part of parts) {
      if (part.includes('/')) {
        // Step notation: */5 or 1-10/2
        const [range, stepStr] = part.split('/');
        const step = parseInt(stepStr, 10);
        let start = min;
        let end = max;

        if (range !== '*') {
          if (range.includes('-')) {
            const [startStr, endStr] = range.split('-');
            start = parseInt(startStr, 10);
            end = parseInt(endStr, 10);
          } else {
            start = parseInt(range, 10);
            end = max;
          }
        }

        for (let i = start; i <= end; i += step) {
          if (!values.includes(i)) {
            values.push(i);
          }
        }
      } else if (part.includes('-')) {
        // Range notation: 1-5
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        for (let i = start; i <= end; i++) {
          if (!values.includes(i)) {
            values.push(i);
          }
        }
      } else {
        // Single value
        const val = parseInt(part, 10);
        if (!isNaN(val) && !values.includes(val)) {
          values.push(val);
        }
      }
    }

    return values.sort((a, b) => a - b);
  }

  /**
   * Get the next occurrence after the given date.
   */
  getNextOccurrence(fromDate: Date = new Date()): Date {
    const date = new Date(fromDate);
    date.setSeconds(0, 0);
    date.setMinutes(date.getMinutes() + 1);

    // Safety limit to prevent infinite loops
    const maxIterations = 366 * 24 * 60; // ~1 year in minutes
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const currentMonth = date.getMonth() + 1;
      const currentDay = date.getDate();
      const currentHour = date.getHours();
      const currentMinute = date.getMinutes();
      const currentDayOfWeek = date.getDay();

      // Check month
      if (!this.month.includes(currentMonth)) {
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        date.setMonth(date.getMonth() + 1);
        continue;
      }

      // Check day of month and day of week
      const dayOfMonthMatch = this.dayOfMonth.includes(currentDay);
      const dayOfWeekMatch = this.dayOfWeek.includes(currentDayOfWeek) ||
                             this.dayOfWeek.includes(currentDayOfWeek === 0 ? 7 : currentDayOfWeek);

      if (!dayOfMonthMatch || !dayOfWeekMatch) {
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 1);
        continue;
      }

      // Check hour
      if (!this.hour.includes(currentHour)) {
        date.setMinutes(0, 0, 0);
        date.setHours(date.getHours() + 1);
        continue;
      }

      // Check minute
      if (!this.minute.includes(currentMinute)) {
        date.setMinutes(date.getMinutes() + 1);
        continue;
      }

      return date;
    }

    throw new Error('Could not find next occurrence within 1 year');
  }

  /**
   * Validate a cron expression.
   */
  static isValid(expression: string): boolean {
    try {
      new CronExpression(expression);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Generate cron expression from simple frequency and time.
 */
export function generateCronExpression(
  frequency: 'minute' | 'hourly' | 'daily' | 'weekly' | 'monthly',
  time?: string // HH:mm format
): string {
  switch (frequency) {
    case 'minute':
      return '* * * * *';
    case 'hourly':
      return '0 * * * *';
    case 'daily':
      if (time) {
        const [hour, minute] = time.split(':');
        return `${minute} ${hour} * * *`;
      }
      return '0 0 * * *';
    case 'weekly':
      if (time) {
        const [hour, minute] = time.split(':');
        return `${minute} ${hour} * * 0`;
      }
      return '0 0 * * 0';
    case 'monthly':
      if (time) {
        const [hour, minute] = time.split(':');
        return `${minute} ${hour} 1 * *`;
      }
      return '0 0 1 * *';
    default:
      return '0 0 * * *';
  }
}

/**
 * Get human-readable description of a cron expression.
 */
export function getCronDescription(expression: string): string {
  const commonPatterns: Record<string, string> = {
    '* * * * *': 'Every minute',
    '0 * * * *': 'Every hour',
    '0 0 * * *': 'Daily at midnight',
    '0 12 * * *': 'Daily at noon',
    '0 0 * * 0': 'Weekly on Sunday',
    '0 0 1 * *': 'Monthly on the 1st',
  };

  if (commonPatterns[expression]) {
    return commonPatterns[expression];
  }

  try {
    const parts = expression.split(' ');
    if (parts[0] === '0' && parts[1] === '0' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return 'Daily at midnight';
    }
    if (parts[0] === '0' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return `Daily at ${parts[1]}:00`;
    }
    if (parts[0] !== '*' && parts[1] !== '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return `Daily at ${parts[1]}:${parts[0].padStart(2, '0')}`;
    }
    return `Custom: ${expression}`;
  } catch {
    return expression;
  }
}
