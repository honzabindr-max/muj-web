const GRADIENTS = [
  'linear-gradient(135deg,#14532D 0%,#0B3A1F 100%)',
  'linear-gradient(135deg,#3F6212 0%,#1A2E05 100%)',
  'linear-gradient(135deg,#164E63 0%,#0C2A33 100%)',
  'linear-gradient(135deg,#5B4A1F 0%,#2E2410 100%)',
];

export function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}
