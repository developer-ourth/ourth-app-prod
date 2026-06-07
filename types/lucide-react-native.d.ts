// lucide-react-native ships types that reference SVGSVGElement (web) but the
// runtime uses react-native-svg. This shim re-exports a compatible type so
// TypeScript doesn't complain about the `color` prop.
declare module 'lucide-react-native' {
  import type { SvgProps } from 'react-native-svg';
  import type { ComponentType } from 'react';

  export interface LucideProps extends SvgProps {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = ComponentType<LucideProps>;

  // Re-export every icon used in this project
  export const Home: LucideIcon;
  export const ShoppingBag: LucideIcon;
  export const Star: LucideIcon;
  export const Bell: LucideIcon;
  export const BellOff: LucideIcon;
  export const User: LucideIcon;
  export const Search: LucideIcon;
  export const MapPin: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Package: LucideIcon;
  export const LogOut: LucideIcon;
  export const Gift: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ArrowDown: LucideIcon;
}
