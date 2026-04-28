export function formatCurrency(amount: string | number, currency: string) {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(numericAmount);
}

export function formatDateTime(isoString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoString));
}

export function formatDuration(duration: string) {
  // Parse ISO 8601 duration (e.g. PT2H30M)
  const match = duration.match(/PT(\d+H)?(\d+M)?/);
  if (!match) return duration;
  
  const hours = match[1] ? match[1].replace('H', '') : '0';
  const minutes = match[2] ? match[2].replace('M', '') : '0';
  
  if (hours === '0') return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
