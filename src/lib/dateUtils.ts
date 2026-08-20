import { Period, PeriodType } from '../types';

export function getPeriodForDate(date: Date, type: PeriodType): Period {
  const year = date.getFullYear();
  const month = date.getMonth();

  let startDate: Date;
  let endDate: Date;
  let title: string;

  switch (type) {
    case 'day':
      startDate = new Date(year, month, date.getDate());
      endDate = new Date(year, month, date.getDate());
      title = `${year}年${month + 1}月${date.getDate()}日`;
      break;

    case 'week': {
      const dayOfWeek = date.getDay() || 7;
      startDate = new Date(year, month, date.getDate() - dayOfWeek + 1);
      endDate = new Date(year, month, date.getDate() - dayOfWeek + 7);
      const weekNum = Math.ceil(((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
      title = `${year}年第${weekNum}周`;
      break;
    }

    case 'month':
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0);
      title = `${year}年${month + 1}月`;
      break;

    case 'quarter': {
      const quarter = Math.floor(month / 3) + 1;
      startDate = new Date(year, (quarter - 1) * 3, 1);
      endDate = new Date(year, quarter * 3, 0);
      title = `${year}年第${quarter}季度`;
      break;
    }

    case 'half-year': {
      const half = Math.floor(month / 6) + 1;
      startDate = new Date(year, (half - 1) * 6, 1);
      endDate = new Date(year, half * 6, 0);
      title = `${year}年第${half}半年`;
      break;
    }

    case 'year':
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      title = `${year}年`;
      break;

    default:
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0);
      title = `${year}年${month + 1}月`;
  }

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    id: `${type}-${formatDate(startDate)}`,
    type,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    title,
  };
}

export function getNextPeriod(currentPeriod: Period): Period {
  const startDate = new Date(currentPeriod.startDate);
  const type = currentPeriod.type;

  let nextDate: Date;

  switch (type) {
    case 'day':
      nextDate = new Date(startDate.getTime() + 86400000);
      break;
    case 'week':
      nextDate = new Date(startDate.getTime() + 604800000);
      break;
    case 'month':
      nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
      break;
    case 'quarter':
      nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 1);
      break;
    case 'half-year':
      nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 6, 1);
      break;
    case 'year':
      nextDate = new Date(startDate.getFullYear() + 1, 0, 1);
      break;
    default:
      nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  }

  return getPeriodForDate(nextDate, type);
}

export function getPrevPeriod(currentPeriod: Period): Period {
  const startDate = new Date(currentPeriod.startDate);
  const type = currentPeriod.type;

  let prevDate: Date;

  switch (type) {
    case 'day':
      prevDate = new Date(startDate.getTime() - 86400000);
      break;
    case 'week':
      prevDate = new Date(startDate.getTime() - 604800000);
      break;
    case 'month':
      prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
      break;
    case 'quarter':
      prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 3, 1);
      break;
    case 'half-year':
      prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 6, 1);
      break;
    case 'year':
      prevDate = new Date(startDate.getFullYear() - 1, 0, 1);
      break;
    default:
      prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
  }

  return getPeriodForDate(prevDate, type);
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (startDate === endDate) {
    return `${start.getMonth() + 1}月${start.getDate()}日`;
  }
  
  if (start.getMonth() === end.getMonth()) {
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getDate()}日`;
  }
  
  return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
