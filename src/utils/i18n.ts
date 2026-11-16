/** Italian plural helpers */

export function localiCount(n: number): string {
  if (n === 1) return '1 locale';
  return `${n} locali`;
}

export function localiTrovati(n: number): string {
  if (n === 1) return '1 locale trovato';
  return `${n} locali trovati`;
}

export function risultatiCount(n: number): string {
  if (n === 1) return '1 risultato';
  return `${n} risultati`;
}
