import { IOperatingHours } from '../models/Pharmacy';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export interface OperatingHoursSummary {
  isOpen: boolean;
  hoursText: string;
}

export function getPharmacyOpenState(
  operatingHours?: Record<string, IOperatingHours> | Map<string, IOperatingHours>,
  currentDate = new Date()
): OperatingHoursSummary {
  if (!operatingHours) {
    return { isOpen: true, hoursText: 'Open 24/7' };
  }
  const dayName = DAYS[currentDate.getDay()];
  const hoursMap = operatingHours instanceof Map ? operatingHours : new Map(Object.entries(operatingHours));
  const today = hoursMap.get(dayName);
  if (!today || today.closed) {
    return { isOpen: false, hoursText: 'Closed today' };
  }
  const curMin = currentDate.getHours() * 60 + currentDate.getMinutes();
  const [oH, oM] = (today.openTime || '08:00').split(':').map(Number);
  const [cH, cM] = (today.closeTime || '22:00').split(':').map(Number);
  const openMin = oH * 60 + oM;
  const closeMin = cH * 60 + cM;
  const isOpen = curMin >= openMin && curMin <= closeMin;
  return { isOpen, hoursText: (today.openTime || '08:00') + ' - ' + (today.closeTime || '22:00') };
}