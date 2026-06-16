declare module 'react-native-maps' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewProps } from 'react-native';

  export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }

  export interface MapViewProps extends ViewProps {
    children?: ReactNode;
    provider?: unknown;
    initialRegion?: Region;
    showsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    showsCompass?: boolean;
    mapPadding?: { top: number; right: number; bottom: number; left: number };
  }

  export default class MapView extends React.Component<MapViewProps> {
    animateToRegion(region: Region, duration?: number): void;
  }

  export const Marker: ComponentType<any>;
  export const Polyline: ComponentType<any>;
  export const PROVIDER_GOOGLE: unknown;
}
