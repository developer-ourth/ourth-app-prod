import React from 'react';
import {
  Home as _Home,
  ShoppingBag as _ShoppingBag,
  Star as _Star,
  Bell as _Bell,
  BellOff as _BellOff,
  User as _User,
  Search as _Search,
  MapPin as _MapPin,
  ChevronRight as _ChevronRight,
  ChevronLeft as _ChevronLeft,
  Package as _Package,
  LogOut as _LogOut,
  Gift as _Gift,
  ArrowUp as _ArrowUp,
  ArrowDown as _ArrowDown,
  UserPlus as _UserPlus,
  LogIn as _LogIn,
  ShoppingCart as _ShoppingCart,
  Tag as _Tag,
  Filter as _Filter,
  Heart as _Heart,
  AlignJustify as _AlignJustify,
  Trash2 as _Trash2,
  Minus as _Minus,
  Plus as _Plus,
  ExternalLink as _ExternalLink,
  Leaf as _Leaf,
  Pencil as _Pencil,
} from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';

type AnyIcon = React.ComponentType<{ size?: number; color?: string; fill?: string; style?: any }>;

export const Home       = _Home       as AnyIcon;
export const ShoppingBag= _ShoppingBag as AnyIcon;
export const Star       = _Star       as AnyIcon;
export const Bell       = _Bell       as AnyIcon;
export const BellOff    = _BellOff    as AnyIcon;
export const User       = _User       as AnyIcon;
export const Search     = _Search     as AnyIcon;
export const MapPin     = _MapPin     as AnyIcon;
export const ChevronRight=_ChevronRight as AnyIcon;
export const ChevronLeft =_ChevronLeft  as AnyIcon;
export const Package    = _Package    as AnyIcon;
export const LogOut     = _LogOut     as AnyIcon;
export const Gift       = _Gift       as AnyIcon;
export const ArrowUp    = _ArrowUp    as AnyIcon;
export const ArrowDown  = _ArrowDown  as AnyIcon;
export const UserPlus   = _UserPlus   as AnyIcon;
export const LogIn      = _LogIn      as AnyIcon;
export const ShoppingCart = _ShoppingCart as AnyIcon;
export const Tag          = _Tag          as AnyIcon;
export const Filter       = _Filter       as AnyIcon;
export const Heart        = _Heart        as AnyIcon;
export const AlignJustify = _AlignJustify as AnyIcon;
export const Trash2       = _Trash2       as AnyIcon;
export const Minus        = _Minus        as AnyIcon;
export const Plus         = _Plus         as AnyIcon;
export const ExternalLink = _ExternalLink as AnyIcon;
export const Leaf         = _Leaf         as AnyIcon;
export const Pencil       = _Pencil       as AnyIcon;

export const Mic: AnyIcon = ({ size = 24, color = '#000' }) =>
  React.createElement(
    Svg,
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement(Path, { d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' }),
    React.createElement(Path, { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
    React.createElement(Path, { d: 'M12 19v3' })
  );

export const Eye: AnyIcon = ({ size = 24, color = '#000' }) =>
  React.createElement(
    Svg,
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement(Path, { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }),
    React.createElement(Circle, { cx: '12', cy: '12', r: '3' })
  );

export const EyeOff: AnyIcon = ({ size = 24, color = '#000' }) =>
  React.createElement(
    Svg,
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement(Path, { d: 'M9.88 9.88a3 3 0 1 0 4.24 4.24' }),
    React.createElement(Path, { d: 'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68' }),
    React.createElement(Path, { d: 'M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61' }),
    React.createElement(Path, { d: 'M2 2l20 20' })
  );

export const CheckCircle: AnyIcon = ({ size = 24, color = '#000' }) =>
  React.createElement(
    Svg,
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement(Circle, { cx: '12', cy: '12', r: '10' }),
    React.createElement(Path, { d: 'm9 12 2 2 4-4' })
  );

export const ShieldCheck: AnyIcon = ({ size = 24, color = '#000' }) =>
  React.createElement(
    Svg,
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement(Path, { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }),
    React.createElement(Path, { d: 'm9 12 2 2 4-4' })
  );
