/**
 * Re-exports lucide-react-native icons with a permissive type cast.
 *
 * lucide-react-native v1.x ships types that reference SVGSVGElement (web) even
 * though the runtime targets react-native-svg. This wrapper casts each icon to
 * a simple React component that accepts `size`, `color`, and `fill` so the rest
 * of the codebase stays clean.
 */
import type { ComponentProps } from 'react';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = React.ComponentType<any>;

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
