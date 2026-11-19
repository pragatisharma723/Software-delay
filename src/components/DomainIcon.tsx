import {
  Building2,
  HeartPulse,
  Landmark,
  ShoppingBag,
} from 'lucide-react';
import type { DomainName } from '../types/project.ts';

export function DomainIcon({
  domain,
  className = 'w-5 h-5',
  color,
}: {
  domain: DomainName;
  className?: string;
  color?: string;
}) {
  const style = color ? { color } : undefined;
  switch (domain) {
    case 'Healthcare and Medical Software':
      return <HeartPulse className={className} style={style} />;
    case 'Banking and FinTech':
      return <Landmark className={className} style={style} />;
    case 'E-commerce and Retail':
      return <ShoppingBag className={className} style={style} />;
    case 'Enterprise and Business Software':
    default:
      return <Building2 className={className} style={style} />;
  }
}
